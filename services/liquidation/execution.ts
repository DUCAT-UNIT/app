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
  setPendingVaultSigningOperation,
  clearPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';
import {
  buildVaultProfile,
  computeVaultPrevoutFromTx,
} from '../vault/utils';
import { fetchVaultHistory } from '../vaultService';
import { computeLiquidationPrice } from '../../utils/vaultUtils';

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

    const liquidationPrice = computeLiquidationPrice(unitDebt, btcInVault);
    const oracleQuote: PriceQuote = await fetchPriceQuote(liquidationPrice);

    logger.debug('[Liquidation] Oracle quote', {
      price: oracleQuote.latest_price,
      threshold: liquidationPrice,
    });

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
      deposit_amount: 0,
      tx_feerate: feeRate,
    };

    const vaultCtx = wallet.vault.repo.ctx(
      oracleQuote,
      userVaultProfile,
      repoConfig
    );

    // ── Step 6: Fetch UTXOs ──
    progress('Fetching available funds...');

    const txQuote = VaultAPI.repo.get_tx_quote(
      { ...repoConfig, sats_address: walletInfo.segwitAddress },
      liquidVaults.length
    );
    const fundingRequired = txQuote.total_cost + 350 * feeRate;
    const utxos: BaseUtxo[] = await wallet.fetch.sats_utxos(fundingRequired);

    if (!utxos?.length) {
      throw new Error('Insufficient funds for liquidation');
    }

    // ── Step 7: Create, Sign PSBTs & Build Request ──
    progress('Signing transaction...');

    setPendingVaultSigningOperation({
      action: 'repo',
      liquidCtx,
      vaultCtx,
      satsUtxos: utxos,
    });

    let request;
    try {
      request = await wallet.vault.repo.req(liquidCtx, vaultCtx, utxos);
    } finally {
      clearPendingVaultSigningOperation();
    }

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

    const txid = guardRes.vault_txid;
    logger.info('[Liquidation] Guardian response received', {
      vault_txid: txid,
      fullResponse: JSON.stringify(guardRes),
    });

    progress('Liquidation complete!');
    await disconnectGuardian();

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
