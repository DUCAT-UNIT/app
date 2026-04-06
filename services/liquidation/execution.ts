/**
 * Liquidation Execution
 *
 * Full transaction flow for claiming liquidated vaults.
 * Mirrors the web frontend's repossess.op.ts + repossess.api.ts exactly.
 *
 * Flow:
 * 1. Oracle price quote (computeLiquidationPrice → fetchPriceQuote)
 * 2. Create VaultWallet
 * 3. Build user's VaultProfile from vault history
 * 4. Compute deposit_amount from available collateral
 * 5. Build liquidation context (VaultAPI.repo.liquidation.get_ctx)
 * 6. Build vault repo context (wallet.vault.repo.ctx)
 * 7. Fetch & select UTXOs
 * 8. Create PSBTs manually, batch sign, build request
 * 9. Submit to Guardian
 */

import { CONST, VaultAPI, select_sat_utxos } from '@ducat-unit/client-sdk';
import type {
  BaseUtxo,
  GuardianSocket,
  LiquidVaultProfile,
  PriceQuote,
  SignPSBTEntry,
  VaultProfile,
  VaultWallet,
  WalletVaultRepoRequest,
} from '@ducat-unit/client-sdk';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { getGuardianClient, withGuardianTimeout, disconnectGuardian } from '../guardianService';
import { registerLiquidationTxid } from '../transactionHistoryService';
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
import { getAvailableCollateralBtc } from './calculations';

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
  /** Deficit (claim) amount in BTC */
  deficitAmountBtc: number;
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
// Main Execution (mirrors web frontend repossess.op.ts)
// ============================================================

export async function executeLiquidation(
  params: LiquidationExecutionParams
): Promise<LiquidationExecutionResult> {
  const {
    liquidVaults, walletInfo, vaultPubkey,
    btcInVault, unitDebt, feeRate, vaultInfo,
    deficitAmountBtc, onProgress,
  } = params;

  const progress = (msg: string) => {
    logger.info(`[Liquidation] ${msg}`);
    onProgress?.(msg);
  };

  let guardian: GuardianSocket | null = null;

  try {
    // ── Step 1: Oracle Price Quote ──
    // (matches web: liquidation.helpers.tsx:143-144)
    progress('Fetching oracle price...');

    const liquidationPrice = computeLiquidationPrice(unitDebt, btcInVault);
    const oracleQuote: PriceQuote = await fetchPriceQuote(liquidationPrice);
    const bitcoinPrice = oracleQuote.latest_price;

    logger.debug('[Liquidation] Oracle quote', {
      price: bitcoinPrice,
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

    // ── Step 4: Compute deposit_amount ──
    // (matches web: liquidation.helpers.tsx:183-184)
    const availableCollateral = getAvailableCollateralBtc(bitcoinPrice, btcInVault, unitDebt);
    const depositAmountBtc = availableCollateral > deficitAmountBtc
      ? 0
      : deficitAmountBtc - availableCollateral;
    const depositAmountSats = Math.floor(depositAmountBtc * 100_000_000);

    logger.debug('[Liquidation] Deposit calc', {
      deficitAmountBtc,
      availableCollateral,
      depositAmountBtc,
      depositAmountSats,
    });

    // ── Step 5: Build Liquidation Context ──
    // (matches web: repossess.op.ts:84 — NO is_locked modification)
    progress('Building liquidation context...');

    const liquidCtx = VaultAPI.repo.liquidation.get_ctx(
      liquidVaults,
      contract
    );

    logger.debug('[Liquidation] Context', {
      vaultCount: liquidCtx.vault_count,
      claimedSats: liquidCtx.claimed_sats,
      claimedUnit: liquidCtx.claimed_unit,
    });

    // ── Step 6: Build Vault Repo Context ──
    // (matches web: repossess.op.ts:74-77, 88)
    progress('Preparing transaction...');

    const vaultConfig = {
      deposit_amount: depositAmountSats,
      tx_feerate: feeRate,
    };

    const vaultCtx = wallet.vault.repo.ctx(
      oracleQuote,
      userVaultProfile,
      vaultConfig
    );

    // ── Step 7: Fetch & Select UTXOs ──
    // (matches web: repossess.op.ts:91-99 — fetch all, then select)
    progress('Fetching available funds...');

    const txQuote = wallet.vault.repo.quote(vaultCtx, liquidVaults.length);
    const allUtxos: BaseUtxo[] = await wallet.fetch.sats_utxos();
    const utxos = select_sat_utxos(allUtxos, txQuote.total_cost);

    logger.debug('[Liquidation] UTXOs', {
      totalAvailable: allUtxos.length,
      selected: utxos.length,
      totalCost: txQuote.total_cost,
    });

    if (!utxos?.length) {
      throw new Error('Insufficient funds for liquidation');
    }

    // ── Step 8: Create PSBTs, Batch Sign, Build Request ──
    // (matches web: repossess.api.ts:32-61, 63-75, 82-93)
    progress('Signing transaction...');

    // Create PSBTs manually (same as web repoCreatePsbtsBatch)
    const psbt1Raw = VaultAPI.repo.create_psbt1(liquidCtx, vaultCtx, utxos);
    const psbt2Raw = VaultAPI.repo.create_psbt2(liquidCtx, vaultCtx, psbt1Raw);

    // Build manifests (same as web repossess.api.ts:34-50)
    const vinVaultIdx = CONST.TXMAP.repo.vault_tx.vin.vault;
    const vinConnIdx = CONST.TXMAP.repo.vault_tx.vin.conn;
    const vinFundIdx = liquidCtx.liquid_vaults.length;
    const utxoInputs = utxos.map((_: BaseUtxo, idx: number) => vinFundIdx + idx);

    const utxoManifest: Record<string, number[]> = {
      [wallet.acct.sats.address]: utxoInputs,
    };
    const vaultManifest: Record<string, number[]> = {
      [wallet.acct.vault.address]: [vinVaultIdx, vinConnIdx],
    };

    const batchRequest: SignPSBTEntry[] = [
      [psbt1Raw, utxoManifest],
      [psbt2Raw, vaultManifest],
    ];

    // Set signing context for security validation
    setPendingVaultSigningOperation({
      action: 'repo',
      liquidCtx,
      vaultCtx,
      satsUtxos: utxos,
    });

    let signedPsbts: string[];
    try {
      signedPsbts = await wallet.sign.batch(batchRequest);
    } finally {
      clearPendingVaultSigningOperation();
    }

    const psbt1 = signedPsbts[0];
    const psbt2 = signedPsbts[1];

    // Build request (same as web repossess.api.ts:82-93)
    const req = VaultAPI.repo.create_req(liquidCtx, vaultCtx, psbt1, psbt2);
    const request: WalletVaultRepoRequest = {
      ...req,
      contract_id: wallet.contract_id,
      network: wallet.network,
    };

    // ── Step 9: Submit to Guardian ──
    // (matches web: repossess.op.ts:214-224)
    progress('Submitting to network...');

    guardian = await getGuardianClient(vaultPubkey);
    const guardSub = guardian.req.vault.repo(request);
    guardSub.on('info', (info: string) => logger.debug(`[Liquidation] Guardian: ${info}`));
    const guardRes = await withGuardianTimeout(
      guardSub.resolve(60_000),
      70_000
    ) as { vault_txid?: string; repo_txid?: string; liquid_txid?: string };

    const txid = guardRes.vault_txid || guardRes.repo_txid || guardRes.liquid_txid || '';
    if (txid) {
      await registerLiquidationTxid(txid);
    }
    logger.info('[Liquidation] Guardian response', {
      txid,
      fullResponse: JSON.stringify(guardRes),
    });

    progress('Liquidation complete!');
    await disconnectGuardian();

    return { success: true, txid, vaultTxid: txid };
  } catch (error: unknown) {
    let msg: string;
    if (error instanceof Error) {
      msg = error.message;
    } else if (typeof error === 'string') {
      msg = error;
    } else if (error && typeof error === 'object') {
      msg = JSON.stringify(error);
    } else {
      msg = String(error);
    }
    logger.warn('[Liquidation] Failed', { error: msg, type: typeof error, raw: String(error) });

    if (guardian) {
      try { await disconnectGuardian(); } catch { /* */ }
    }

    return { success: false, error: msg };
  }
}
