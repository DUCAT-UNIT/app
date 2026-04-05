/**
 * Liquidation Execution
 *
 * Full transaction flow for claiming liquidated vaults.
 * Follows the same pattern as existing vault operations
 * (deposit/borrow/repay/withdraw) but uses VaultAPI.repo.
 *
 * Flow:
 * 1. Oracle price quote
 * 2. Create VaultWallet
 * 3. Build user's VaultProfile from vault history
 * 4. Build liquidation context (SDK: get_ctx)
 * 5. Build vault repo context (SDK: create_ctx)
 * 6. Fetch UTXOs for funding
 * 7. Create PSBTs (SDK: create_psbt1 + create_psbt2)
 * 8. Build request (SDK: create_req)
 * 9. Submit to Guardian
 */

import { VaultAPI } from '@ducat-unit/client-sdk';
import type {
  BaseUtxo,
  GuardianSocket,
  LiquidVaultProfile,
  PriceQuote,
  VaultProfile,
  VaultWallet,
} from '@ducat-unit/client-sdk';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { getGuardianClient, withGuardianTimeout, disconnectGuardian } from '../guardianService';
import { createVaultWallet, fetchProtocolContract } from '../vaultWallet';
import {
  buildVaultProfile,
  computeVaultPrevoutFromTx,
} from '../vault/utils';
import { fetchVaultHistory } from '../vaultService';

// ============================================================
// Types
// ============================================================

export interface LiquidationExecutionParams {
  /** Liquid vault profiles to claim (from SDK get_liquid_profile) */
  liquidVaults: LiquidVaultProfile[];
  /** User's wallet info for creating VaultWallet */
  walletInfo: {
    segwitAddress: string;
    segwitPubkey: string;
    taprootAddress: string;
    taprootPubkey: string;
  };
  /** User's vault pubkey (taproot) */
  vaultPubkey: string;
  /** User's current BTC locked in vault */
  btcInVault: number;
  /** User's current UNIT debt */
  unitDebt: number;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** Vault info for building VaultProfile */
  vaultInfo: {
    creation_account: string;
    guard_pubkey: string;
    master_id: string;
  };
  /** Progress callback for UI updates */
  onProgress?: (message: string) => void;
}

export interface LiquidationExecutionResult {
  success: boolean;
  txid?: string;
  vaultTxid?: string;
  error?: string;
}

// ============================================================
// Main Execution
// ============================================================

export async function executeLiquidation(
  params: LiquidationExecutionParams
): Promise<LiquidationExecutionResult> {
  const {
    liquidVaults, walletInfo, vaultPubkey,
    btcInVault, unitDebt, feeRate, vaultInfo, onProgress,
  } = params;

  const progress = (msg: string) => {
    logger.info(`[Liquidation] ${msg}`);
    onProgress?.(msg);
  };

  let guardian: GuardianSocket | null = null;

  try {
    // ── Step 1: Oracle Price Quote ──
    progress('Fetching oracle price...');

    const liquidationPrice = unitDebt > 0 && btcInVault > 0
      ? unitDebt / btcInVault
      : 0;
    const oracleQuote: PriceQuote = await fetchPriceQuote(liquidationPrice);
    const oraclePrice = oracleQuote.latest_price;

    // Price fluctuation check (>0.5% deviation = abort)
    if (liquidationPrice > 0) {
      const fluctuation = Math.abs(oraclePrice - liquidationPrice) / Math.min(oraclePrice, liquidationPrice);
      if (fluctuation > 0.005) {
        logger.warn('[Liquidation] Price fluctuation exceeds 0.5%', {
          estimated: liquidationPrice,
          oracle: oraclePrice,
          fluctuation: `${(fluctuation * 100).toFixed(2)}%`,
        });
      }
    }

    logger.debug('[Liquidation] Oracle quote', { price: oraclePrice });

    // ── Step 2: Create VaultWallet ──
    progress('Creating wallet context...');

    const wallet: VaultWallet = await createVaultWallet(walletInfo);
    const contract = await fetchProtocolContract();

    // ── Step 3: Build User's VaultProfile ──
    progress('Building vault profile...');

    const history = await fetchVaultHistory(vaultPubkey);
    if (!history || history.length === 0) {
      throw new Error('No vault history found');
    }

    const prevout = computeVaultPrevoutFromTx(history[0]);
    if (!prevout) {
      throw new Error('Failed to compute vault prevout');
    }

    const userVaultProfile: VaultProfile = buildVaultProfile(
      vaultPubkey,
      vaultInfo,
      prevout
    );

    // ── Step 4: Build Liquidation Context ──
    progress('Building liquidation context...');

    // Mark vaults as locked for execution (get_profile needs false, get_ctx needs true)
    const lockedVaults = liquidVaults.map(v => ({
      ...v,
      rdata: { ...v.rdata, is_locked: true },
    }));

    const liquidCtx = VaultAPI.repo.liquidation.get_ctx(
      lockedVaults as LiquidVaultProfile[],
      contract
    );

    logger.debug('[Liquidation] Context', {
      vaults: liquidCtx.vault_count,
      claimedSats: liquidCtx.claimed_sats,
      claimedUnit: liquidCtx.claimed_unit,
    });

    // ── Step 5: Build Vault Repo Context ──
    progress('Preparing transaction...');

    const repoConfig = {
      sats_address: walletInfo.segwitAddress,
      deposit_amount: 0,
      tx_feerate: feeRate,
    };

    const vaultCtx = VaultAPI.repo.create_ctx(
      oracleQuote,
      contract,
      userVaultProfile,
      repoConfig
    );

    // ── Step 6: Fetch UTXOs ──
    progress('Fetching available funds...');

    const txQuote = VaultAPI.repo.get_tx_quote(repoConfig, liquidVaults.length);
    const fundingRequired = txQuote.total_cost + 350 * feeRate;
    const utxos: BaseUtxo[] = await wallet.fetch.sats_utxos(fundingRequired);

    if (!utxos?.length) {
      throw new Error('Insufficient funds for liquidation');
    }

    // ── Step 7: Create PSBTs ──
    progress('Creating transaction...');

    const psbt1 = VaultAPI.repo.create_psbt1(liquidCtx, vaultCtx, utxos);
    const psbt2 = VaultAPI.repo.create_psbt2(liquidCtx, vaultCtx, psbt1);

    // ── Step 8: Build Request ──
    progress('Signing transaction...');

    const rawRequest = VaultAPI.repo.create_req(liquidCtx, vaultCtx, psbt1, psbt2);

    // Add wallet metadata required by Guardian
    const request = {
      ...rawRequest,
      contract_id: wallet.contract_id,
      network: wallet.network,
    };

    // ── Step 9: Submit to Guardian ──
    progress('Submitting to network...');

    guardian = await getGuardianClient(vaultPubkey);
    const guardSub = await guardian.req.vault.repo(request);

    // Wait for Guardian response with timeout
    await new Promise(resolve => setTimeout(resolve, 350));
    const guardRes = await withGuardianTimeout(
      guardSub.resolve(60000),
      60000 + 10000
    ) as { vault_txid: string };

    progress('Liquidation complete!');
    await disconnectGuardian();

    const txid = guardRes.vault_txid;

    return { success: true, txid, vaultTxid: txid };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Liquidation failed';
    logger.warn('[Liquidation] Failed', { error: msg });

    if (guardian) {
      try { await disconnectGuardian(); } catch { /* */ }
    }

    return { success: false, error: msg };
  }
}
