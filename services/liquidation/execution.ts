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
 * 8. Create one repo PSBT, sign it, build request
 * 9. Submit to Guardian
 */

import {
  VaultAPI,
  select_sat_utxos,
} from '@ducat-unit/client-sdk';
import {
  create_vault_action_quote,
  filter_price_contracts,
  get_price_commit_hashes,
} from '@ducat-unit/client-sdk/lib';
import type {
  BaseUtxo,
  GuardianSocket,
  LiquidVaultProfile,
  PriceContract,
  PriceQuote,
  ProtocolProfile,
  VaultActionConfig,
  VaultProfile,
  VaultTrimRequestConfig,
  VaultTrimRequestCtx,
  VaultWallet,
  WalletVaultRepoRequest,
} from '@ducat-unit/client-sdk';
import type {
  LiquidVaultProfile as CoreLiquidVaultProfile,
  PriceQuote as CorePriceQuote,
  VaultProfile as CoreVaultProfile,
} from '@ducat-unit/core';
import { PSBT, TX } from '@ducat-unit/client-sdk/util';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { getGuardianClient, withGuardianTimeout, disconnectGuardian } from '../guardianService';
import { registerLiquidationTxid } from '../transactionHistoryService';
import { createVaultWallet, fetchProtocolContract } from '../vaultWallet';
import {
  setPendingVaultSigningOperation,
  clearPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';
import { signPsbtRaw } from '../signing';
import {
  buildVaultProfile,
  computeVaultPrevoutFromTx,
  resolveLatestUnspentVaultPrevout,
} from '../vault/utils';
import {
  fetchVaultHistory,
  selectLatestUsableVaultHistoryTransaction,
} from '../vaultService';
import { computeLiquidationPrice } from '../../utils/vaultUtils';
import { getAvailableCollateralBtc } from './calculations';
import { COIN_SIZE, SWAP_PSBT_FEE_BUFFER_BPS, SWAP_PSBT_MIN_FEE_BUFFER_SATS } from './constants';
import {
  fetchSwapPsbt,
  createSwapPayload,
  calculateSwapBtcAmount,
  finalizeSwapPsbt,
  validateSwapPsbtUnitPayout,
} from './swapService';
import { assertLiquidVaultProfilesUnspent } from './spendability';

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
    vault_id?: string;
    creation_account: string;
    guard_pubkey: string;
    master_id: string;
  };
  /** Deficit (claim) amount in BTC */
  deficitAmountBtc: number;
  /** Progress callback for UI updates */
  onProgress?: (message: string) => void;
  /** Enable BTC→UNIT auto-swap after repo (default true) */
  enableSwap?: boolean;
  /** Called after the signed repo request is built but before submitting it to the guardian. */
  onRequestCreated?: (requestInfo: {
    txid: string;
    vaultTxid: string;
    request: WalletVaultRepoRequest;
    swapPsbtHex?: string;
  }) => Promise<void>;
}

export interface LiquidationExecutionResult {
  success: boolean;
  txid?: string;
  vaultTxid?: string;
  error?: string;
  /** Signed+finalized swap PSBT hex, ready to broadcast after repo TX confirms */
  swapPsbtHex?: string;
  /** Swap transaction ID (set after broadcast) */
  swapTxid?: string;
}

function extractRepoRequestTxid(request: WalletVaultRepoRequest): string {
  const txRequest = request as WalletVaultRepoRequest & {
    vault_txid?: string;
    repo_txid?: string;
    liquid_txid?: string;
  };

  return txRequest.vault_txid || txRequest.repo_txid || txRequest.liquid_txid || '';
}

type RepoRequestWithTransactions = WalletVaultRepoRequest & {
  liquid_psbt?: string;
  liquid_txhex?: string;
  liquid_txid?: string;
  vault_psbt?: string;
  vault_txhex?: string;
  vault_txid?: string;
};

type LiquidationAction = 'repo' | 'trim';

type LiquidVaultProfileWithSelection = LiquidVaultProfile & {
  claimAmountBtc?: number;
  claimAmountDiff?: number;
  claimAmountPartial?: number;
};

type LatestRepoVaultContext = {
  __create_psbts?: (
    fundInputs?: BaseUtxo[],
    extra?: { liquid_profiles?: LiquidVaultProfile[] }
  ) => string[];
  __latest_ctx?: unknown;
};

type GuardianVaultRequestSubscription<T> = {
  on?: (event: string, handler: (...args: unknown[]) => void) => unknown;
  resolve?: (timeoutMs?: number) => Promise<T>;
  send?: (timeoutMs?: number) => Promise<T | { ok: boolean; data?: T; reason?: unknown }>;
};

type GuardianSocketWithInternalClient = GuardianSocket & {
  _client?: {
    request?: {
      vault?: {
        trim?: (
          request: WalletVaultRepoRequest
        ) => GuardianVaultRequestSubscription<GuardianVaultResponse>;
      };
    };
  };
};

type GuardianVaultResponse = {
  vault_txid?: string;
  repo_txid?: string;
  liquid_txid?: string;
};

type VaultContextWithValidationOptions = {
  validation_options?: {
    warn_only_high_fees?: boolean;
    [key: string]: unknown;
  };
};

function allowHighFeeValidationWarnings<T>(ctx: T): T {
  if (!ctx || typeof ctx !== 'object') {
    return ctx;
  }

  const ctxWithOptions = ctx as VaultContextWithValidationOptions;
  ctxWithOptions.validation_options = {
    ...ctxWithOptions.validation_options,
    warn_only_high_fees: true,
  };

  return ctx;
}

function isPartialLiquidVault(profile: LiquidVaultProfile): boolean {
  const selected = profile as LiquidVaultProfileWithSelection;

  if (typeof selected.claimAmountDiff === 'number' && selected.claimAmountDiff > 0) {
    return true;
  }

  if (
    typeof selected.claimAmountPartial === 'number'
    && typeof selected.claimAmountBtc === 'number'
  ) {
    return selected.claimAmountPartial > 0
      && selected.claimAmountPartial < selected.claimAmountBtc;
  }

  return false;
}

function splitLiquidationActions(liquidVaults: LiquidVaultProfile[]): {
  fullVaults: LiquidVaultProfile[];
  partialVault?: LiquidVaultProfile;
} {
  const fullVaults: LiquidVaultProfile[] = [];
  let partialVault: LiquidVaultProfile | undefined;

  for (const vault of liquidVaults) {
    if (isPartialLiquidVault(vault)) {
      if (partialVault) {
        throw new Error('Only one partial liquidation can be submitted at a time');
      }
      partialVault = vault;
      continue;
    }

    fullVaults.push(vault);
  }

  return { fullVaults, partialVault };
}

function firstProtocolMemberPubkey(contract: ProtocolProfile, group: number): string {
  return contract.proto_members?.find((member) => member.group === group)?.pubkey
    ?? contract.proto_members?.[0]?.pubkey
    ?? '';
}

function toCorePriceQuote(quote: PriceQuote, contract: ProtocolProfile): CorePriceQuote {
  const runtimeQuote = quote as PriceQuote & {
    base_price?: number;
    base_stamp?: number;
    chain_network?: PriceContract['chain_network'];
    oracle_pubkey?: string;
    rate_min?: number;
    rate_max?: number;
    rate_thold?: number;
    step_size?: number;
  };
  const basePrice = runtimeQuote.base_price ?? quote.latest_price ?? quote.quote_price;
  const baseStamp = runtimeQuote.base_stamp ?? quote.latest_stamp ?? quote.quote_stamp;

  if (!basePrice || !baseStamp) {
    throw new Error('Oracle quote is missing base price data');
  }

  return {
    base_price: basePrice,
    base_stamp: baseStamp,
    chain_network: runtimeQuote.chain_network ?? contract.chain_network ?? 'mutiny',
    oracle_pubkey: runtimeQuote.oracle_pubkey ?? firstProtocolMemberPubkey(contract, 22),
    rate_max: runtimeQuote.rate_max ?? 0,
    rate_min: runtimeQuote.rate_min ?? 0,
    rate_thold: runtimeQuote.rate_thold ?? 0,
    step_size: runtimeQuote.step_size ?? 1,
  };
}

function getQuotePriceContracts(quote: PriceQuote): PriceContract[] {
  const runtimeQuote = quote as PriceQuote & {
    contracts?: PriceContract[];
    price_contracts?: PriceContract[];
  };

  return runtimeQuote.price_contracts ?? runtimeQuote.contracts ?? [];
}

function selectActionPriceContracts(
  contract: ProtocolProfile,
  actionConfig: VaultActionConfig,
  oracleQuote: PriceQuote
): PriceContract[] {
  const priceContracts = getQuotePriceContracts(oracleQuote);
  if (priceContracts.length === 0) {
    return [];
  }

  const actionQuote = create_vault_action_quote(actionConfig);
  const commitHashes = get_price_commit_hashes(
    contract,
    actionQuote,
    [toCorePriceQuote(oracleQuote, contract)]
  );
  const filtered = filter_price_contracts(priceContracts, commitHashes);

  return filtered.length > 0 ? filtered : priceContracts;
}

function getGuardPubkey(contract: ProtocolProfile, vaultProfile: VaultProfile): string {
  return vaultProfile.guard_pubkey
    ?? vaultProfile.guard_pk
    ?? firstProtocolMemberPubkey(contract, 21);
}

function createTrimConfig(params: {
  contract: ProtocolProfile;
  feeRate: number;
  liquidVault: LiquidVaultProfile;
  oracleQuote: PriceQuote;
  userVaultProfile: VaultProfile;
  wallet: VaultWallet;
}): VaultTrimRequestConfig {
  const { contract, feeRate, liquidVault, oracleQuote, userVaultProfile, wallet } = params;
  const baseConfig: Omit<VaultTrimRequestConfig, 'price_contracts'> = {
    change_address: wallet.acct.sats.address,
    guard_pubkey: getGuardPubkey(contract, userVaultProfile),
    liquid_profiles: [liquidVault as CoreLiquidVaultProfile],
    price_quotes: [toCorePriceQuote(oracleQuote, contract)],
    proto_profile: contract,
    txfee_rate: feeRate,
    txfee_reserve: 0,
    validation_options: {
      warn_only_high_fees: true,
    },
    vault_action: 'trim',
    vault_profile: userVaultProfile as CoreVaultProfile,
  };

  return {
    ...baseConfig,
    price_contracts: selectActionPriceContracts(contract, baseConfig, oracleQuote),
  };
}

function createUnsignedTrimPsbt(params: {
  contract: ProtocolProfile;
  feeRate: number;
  liquidVault: LiquidVaultProfile;
  oracleQuote: PriceQuote;
  userVaultProfile: VaultProfile;
  wallet: VaultWallet;
}): { psbt: string; trimCtx: VaultTrimRequestCtx } {
  const trimConfig = createTrimConfig(params);
  const trimCtx = allowHighFeeValidationWarnings(VaultAPI.trim.create_ctx(trimConfig));
  const psbt = VaultAPI.trim.create_psbt(trimCtx);

  if (!psbt) {
    throw new Error('Failed to build trim PSBT');
  }

  return { psbt, trimCtx };
}

function createUnsignedLatestRepoPsbt(
  repoCtx: LatestRepoVaultContext,
  liquidVaults: LiquidVaultProfile[],
  fundInputs: BaseUtxo[]
): { psbt: string; latestCtx: unknown } {
  if (typeof repoCtx.__create_psbts !== 'function') {
    throw new Error('Latest repo PSBT builder is unavailable');
  }

  const [psbt] = repoCtx.__create_psbts(fundInputs, { liquid_profiles: liquidVaults });
  if (!psbt) {
    throw new Error('Failed to build repo PSBT');
  }
  if (!repoCtx.__latest_ctx) {
    throw new Error('Failed to build latest repo context');
  }

  return { psbt, latestCtx: allowHighFeeValidationWarnings(repoCtx.__latest_ctx) };
}

function normalizeRepoRequestTxids(request: WalletVaultRepoRequest): WalletVaultRepoRequest {
  const txRequest = request as RepoRequestWithTransactions;
  const normalized: RepoRequestWithTransactions = { ...txRequest };

  if (normalized.liquid_psbt) {
    normalized.liquid_txhex = PSBT.get.txhex(normalized.liquid_psbt);
    normalized.liquid_txid = TX.get_txid(normalized.liquid_txhex);
  } else if (normalized.liquid_txhex) {
    normalized.liquid_txid = TX.get_txid(normalized.liquid_txhex);
  }

  if (normalized.vault_psbt) {
    normalized.vault_txhex = PSBT.get.txhex(normalized.vault_psbt);
    normalized.vault_txid = TX.get_txid(normalized.vault_txhex);
  } else if (normalized.vault_txhex) {
    normalized.vault_txid = TX.get_txid(normalized.vault_txhex);
  }

  return normalized as WalletVaultRepoRequest;
}

function assertRepoRequestTxidsConsistent(request: WalletVaultRepoRequest): void {
  const txRequest = request as RepoRequestWithTransactions;

  if (txRequest.liquid_psbt) {
    const computedLiquidTxhex = PSBT.get.txhex(txRequest.liquid_psbt);
    if (txRequest.liquid_txhex && computedLiquidTxhex !== txRequest.liquid_txhex) {
      throw new Error('Repo liquidation request Tx1 hex does not match its signed PSBT');
    }
  }

  if (txRequest.vault_psbt) {
    const computedVaultTxhex = PSBT.get.txhex(txRequest.vault_psbt);
    if (txRequest.vault_txhex && computedVaultTxhex !== txRequest.vault_txhex) {
      throw new Error('Repo liquidation request vault Tx hex does not match its signed PSBT');
    }
  }

  const txRequestWithHex = request as WalletVaultRepoRequest & {
    liquid_txhex?: string;
    vault_txhex?: string;
  };

  if (txRequestWithHex.liquid_txhex) {
    const computedLiquidTxid = TX.get_txid(txRequestWithHex.liquid_txhex);
    if (computedLiquidTxid !== txRequest.liquid_txid) {
      throw new Error('Repo liquidation request Tx1 ID does not match its signed transaction');
    }
  }

  if (txRequestWithHex.vault_txhex) {
    const computedVaultTxid = TX.get_txid(txRequestWithHex.vault_txhex);
    if (computedVaultTxid !== txRequest.vault_txid) {
      throw new Error('Repo liquidation request vault Tx ID does not match its signed transaction');
    }
  }
}

function createGuardianVaultSubscription(
  guardian: GuardianSocket,
  action: LiquidationAction,
  request: WalletVaultRepoRequest
): GuardianVaultRequestSubscription<GuardianVaultResponse> {
  if (action === 'repo') {
    return guardian.req.vault.repo(request);
  }

  const compatTrim = (guardian.req.vault as {
    trim?: (
      request: WalletVaultRepoRequest
    ) => GuardianVaultRequestSubscription<GuardianVaultResponse>;
  }).trim;
  if (typeof compatTrim === 'function') {
    return compatTrim(request);
  }

  const rawTrim = (guardian as GuardianSocketWithInternalClient)._client?.request?.vault?.trim;
  if (typeof rawTrim !== 'function') {
    throw new Error('Guardian trim request API is unavailable');
  }

  const rawSub = rawTrim(request);
  return {
    on: (...args) => rawSub.on?.(...args),
    resolve: async (timeoutMs?: number) => {
      if (typeof rawSub.resolve === 'function') {
        return rawSub.resolve(timeoutMs);
      }
      if (typeof rawSub.send !== 'function') {
        throw new Error('Guardian trim subscription cannot be resolved');
      }

      const response = await rawSub.send(timeoutMs);
      if (
        response
        && typeof response === 'object'
        && 'ok' in response
        && response.ok === false
      ) {
        throw new Error(String(response.reason));
      }
      if (
        response
        && typeof response === 'object'
        && 'ok' in response
        && response.ok === true
      ) {
        return response.data as GuardianVaultResponse;
      }

      return response as GuardianVaultResponse;
    },
  };
}

async function resolveGuardianVaultSubscription(
  sub: GuardianVaultRequestSubscription<GuardianVaultResponse>
): Promise<GuardianVaultResponse> {
  if (typeof sub.resolve === 'function') {
    return withGuardianTimeout(sub.resolve(60_000), 70_000);
  }

  if (typeof sub.send !== 'function') {
    throw new Error('Guardian subscription cannot be resolved');
  }

  const response = await withGuardianTimeout(sub.send(60_000), 70_000);
  if (
    response
    && typeof response === 'object'
    && 'ok' in response
    && response.ok === false
  ) {
    throw new Error(String(response.reason));
  }
  if (
    response
    && typeof response === 'object'
    && 'ok' in response
    && response.ok === true
  ) {
    return response.data as GuardianVaultResponse;
  }

  return response as GuardianVaultResponse;
}

// ============================================================
// Main Execution (mirrors web frontend repossess.op.ts)
// ============================================================

export async function executeLiquidation(
  params: LiquidationExecutionParams
): Promise<LiquidationExecutionResult> {
  const {
    liquidVaults,
    walletInfo,
    vaultPubkey,
    btcInVault,
    unitDebt,
    feeRate,
    vaultInfo,
    deficitAmountBtc,
    onProgress,
    enableSwap = true,
    onRequestCreated,
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

    const history = await fetchVaultHistory(
      vaultPubkey,
      vaultInfo.vault_id ? { vaultId: vaultInfo.vault_id } : {}
    );
    if (!history || history.length === 0) {
      throw new Error('No vault history found');
    }

    const latestHistoryTx = selectLatestUsableVaultHistoryTransaction(history);
    if (!latestHistoryTx) {
      throw new Error('No usable vault history transaction found');
    }

    const prevout = computeVaultPrevoutFromTx(latestHistoryTx);
    if (!prevout) {
      throw new Error('Failed to compute vault prevout');
    }

    const resolvedPrevout = await resolveLatestUnspentVaultPrevout(prevout);
    if (resolvedPrevout.replaced) {
      logger.warn('[Liquidation] Using on-chain vault prevout ahead of validator history', {
        hopCount: resolvedPrevout.hopCount,
        sourceTxids: resolvedPrevout.sourceTxids,
        latestTxid: resolvedPrevout.prevout.utxo.txid,
        latestVout: resolvedPrevout.prevout.utxo.vout,
      });
    }

    const userVaultProfile: VaultProfile = buildVaultProfile(
      vaultPubkey,
      vaultInfo,
      resolvedPrevout.prevout
    );

    // ── Step 4: Compute deposit_amount ──
    // (matches web: liquidation.helpers.tsx:183-184)
    const availableCollateral = getAvailableCollateralBtc(bitcoinPrice, btcInVault, unitDebt);
    const depositAmountBtc = Math.max(0, deficitAmountBtc - availableCollateral);
    const depositAmountSats = Math.max(0, Math.ceil(depositAmountBtc * COIN_SIZE - 1e-6));

    logger.debug('[Liquidation] Deposit calc', {
      deficitAmountBtc,
      availableCollateral,
      depositAmountBtc,
      depositAmountSats,
    });

    const { fullVaults, partialVault } = splitLiquidationActions(liquidVaults);
    if (partialVault && fullVaults.length > 0) {
      throw new Error(
        'Mixed partial and full liquidation is not supported in a single mobile request yet.'
      );
    }

    const action: LiquidationAction = partialVault ? 'trim' : 'repo';
    const actionLiquidVaults = partialVault ? [partialVault] : fullVaults;
    if (actionLiquidVaults.length === 0) {
      throw new Error('No liquidation vaults selected');
    }
    await assertLiquidVaultProfilesUnspent(actionLiquidVaults);

    // ── Step 5: Build Liquidation Context ──
    // (matches web: repossess.op.ts:84 — NO is_locked modification)
    progress('Building liquidation context...');

    const liquidCtx = VaultAPI.repo.liquidation.get_ctx(actionLiquidVaults, contract);

    logger.debug('[Liquidation] Context', {
      action,
      vaultCount: liquidCtx.vault_count,
      claimedSats: liquidCtx.claimed_sats,
      claimedUnit: liquidCtx.claimed_unit,
    });

    // ── Step 6: Build Vault Action Context ──
    // (matches web: repossess.op.ts:74-77, 88)
    progress('Preparing transaction...');

    let allUtxos: BaseUtxo[] = [];
    let utxos: BaseUtxo[] = [];
    let repoVaultCtx: LatestRepoVaultContext | undefined;
    let unsignedActionPsbt: string;
    let latestActionCtx: unknown;
    let trimActionCtx: VaultTrimRequestCtx | undefined;

    if (action === 'repo') {
      const vaultConfig = {
        deposit_amount: depositAmountSats,
        tx_feerate: feeRate,
        liquid_profiles: actionLiquidVaults,
        validation_options: {
          warn_only_high_fees: true,
        },
      };

      repoVaultCtx = wallet.vault.repo.ctx(
        oracleQuote,
        userVaultProfile,
        vaultConfig
      ) as LatestRepoVaultContext;

      // matches web: repossess.op.ts:91-99 — fetch all, then select
      progress('Fetching available funds...');

      const txQuote = wallet.vault.repo.quote(repoVaultCtx, actionLiquidVaults.length);
      allUtxos = await wallet.fetch.sats_utxos();
      utxos = select_sat_utxos(allUtxos, txQuote.total_cost);

      logger.debug('[Liquidation] UTXOs', {
        totalAvailable: allUtxos.length,
        selected: utxos?.length ?? 0,
        totalCost: txQuote.total_cost,
      });

      if (!utxos?.length) {
        throw new Error('Insufficient funds for liquidation');
      }

      progress('Building transactions...');

      const repoPsbt = createUnsignedLatestRepoPsbt(
        repoVaultCtx,
        actionLiquidVaults,
        utxos
      );
      unsignedActionPsbt = repoPsbt.psbt;
      latestActionCtx = repoPsbt.latestCtx;
    } else {
      progress('Building transactions...');

      const trimPsbt = createUnsignedTrimPsbt({
        contract,
        feeRate,
        liquidVault: actionLiquidVaults[0],
        oracleQuote,
        userVaultProfile,
        wallet,
      });
      unsignedActionPsbt = trimPsbt.psbt;
      latestActionCtx = trimPsbt.trimCtx;
      trimActionCtx = trimPsbt.trimCtx;
    }

    // ── Step 8a: Extract change UTXO from the repo PSBT for swap ──
    let swapPsbtHex: string | undefined;
    let swapData: Awaited<ReturnType<typeof fetchSwapPsbt>> = null;
    let maxSwapSpendSats = 0;

    if (enableSwap && action === 'repo') {
      try {
        progress('Preparing swap...');

        const pdata = PSBT.parse(unsignedActionPsbt);
        const changeOutputIndex = 1 + actionLiquidVaults.length;
        const changeUtxo: BaseUtxo = PSBT.extract.utxo(pdata, changeOutputIndex);

        // Calculate swap amounts
        const swapClaimedUnit = liquidCtx.claimed_unit / 100;
        const swapBtcAmount = calculateSwapBtcAmount(swapClaimedUnit, bitcoinPrice);

        logger.debug('[Liquidation] Swap calc', {
          claimedUnitCents: liquidCtx.claimed_unit,
          swapClaimedUnit,
          swapBtcAmount,
          bitcoinPrice,
        });

        // Get remaining wallet UTXOs (all minus repo-selected) for swap funding
        const remainingUtxos = allUtxos.filter(
          (u) => !utxos.some((r) => r.txid === u.txid && r.vout === u.vout)
        );

        // Check if change UTXO covers swap, otherwise add extra UTXOs
        const swapAmountSats = Math.floor(swapBtcAmount * 100_000_000);
        const swapFeeBufferSats = Math.max(
          SWAP_PSBT_MIN_FEE_BUFFER_SATS,
          Math.ceil((swapAmountSats * SWAP_PSBT_FEE_BUFFER_BPS) / 10_000)
        );
        maxSwapSpendSats = swapAmountSats + swapFeeBufferSats;
        const needExtra = maxSwapSpendSats > changeUtxo.value;
        const extraUtxos = needExtra
          ? select_sat_utxos(remainingUtxos, maxSwapSpendSats - changeUtxo.value)
          : [];

        // Fetch swap PSBT from faucet API
        const swapPayload = createSwapPayload({
          changeUtxo,
          extraUtxos,
          swapBtcAmount,
          swapClaimedUnit,
          btcPrice: bitcoinPrice,
          paymentAddress: wallet.acct.sats.address,
          ordinalsAddress: wallet.acct.vault.address,
          vaultTxId:
            liquidCtx.liquid_vaults[0]?.root_txid
            || liquidCtx.liquid_vaults[0]?.coin_id?.split(':')[0]
            || liquidCtx.liquid_vaults[0]?.utxo?.txid
            || '',
        });

        swapData = await fetchSwapPsbt(swapPayload);

        if (swapData) {
          validateSwapPsbtUnitPayout(swapData.psbt, {
            expectedUnitAmount: swapPayload.unit_amt,
            expectedUnitAddress: wallet.acct.vault.address,
          });
          logger.info('[Liquidation] Swap PSBT received', {
            userInputs: swapData.user_input_indices,
            maxSpendSats: maxSwapSpendSats,
          });
        } else {
          logger.warn('[Liquidation] Swap PSBT not available, proceeding without swap');
        }
      } catch (swapErr: unknown) {
        logger.warn('[Liquidation] Swap preparation failed, proceeding without swap', {
          error: swapErr instanceof Error ? swapErr.message : String(swapErr),
        });
        swapData = null;
      }
    }

    // ── Step 8b: Sign action PSBT ──
    progress('Signing transaction...');

    if (action === 'repo') {
      if (!repoVaultCtx) {
        throw new Error('Missing repo signing context');
      }

      setPendingVaultSigningOperation({
        action: 'repo',
        liquidCtx,
        vaultCtx: repoVaultCtx,
        satsUtxos: utxos,
      });
    } else {
      if (!trimActionCtx) {
        throw new Error('Missing trim signing context');
      }

      setPendingVaultSigningOperation({
        action: 'trim',
        ctx: trimActionCtx,
      });
    }

    let signedActionPsbt: string;
    try {
      signedActionPsbt = await wallet.sign.psbt(unsignedActionPsbt);
    } finally {
      clearPendingVaultSigningOperation();
    }

    // Sign swap PSBT separately using raw signing (no vault security context needed)
    if (swapData) {
      try {
        const swapManifest: Record<string, number[]> = {
          [wallet.acct.sats.address]: swapData.user_input_indices,
        };
        // Swap PSBTs include faucet outputs, so bound net wallet spend instead of
        // requiring every output to be one of our addresses.
        const signedSwapPsbt = await signPsbtRaw(swapData.psbt, swapManifest, {
          recipient: wallet.acct.sats.address,
          allowOpReturn: true,
          externalSpend: {
            returnAddresses: [wallet.acct.sats.address, wallet.acct.vault.address],
            requiredOutputAddresses: [wallet.acct.vault.address],
            maxSpendSats: maxSwapSpendSats,
          },
        });
        swapPsbtHex = finalizeSwapPsbt(signedSwapPsbt, wallet.acct.vault.address);
        logger.info('[Liquidation] Swap PSBT signed and finalized', {
          hexLength: swapPsbtHex.length,
        });
      } catch (swapSignErr: unknown) {
        logger.warn('[Liquidation] Swap PSBT signing/finalization failed', {
          error: swapSignErr instanceof Error ? swapSignErr.message : String(swapSignErr),
        });
        swapPsbtHex = undefined;
      }
    }

    // ── Step 9: Build request and submit ──
    const requestBuilder = action === 'repo'
      ? VaultAPI.repo.create_request
      : VaultAPI.trim.create_request;
    const req = (requestBuilder as unknown as (
      ctx: unknown,
      signedPsbt: string
    ) => WalletVaultRepoRequest)(latestActionCtx, signedActionPsbt);
    const request: WalletVaultRepoRequest = normalizeRepoRequestTxids({
      ...req,
      contract_id: wallet.contract_id,
      network: wallet.network,
    });
    assertRepoRequestTxidsConsistent(request);

    const requestTxid = extractRepoRequestTxid(request);
    if (requestTxid && onRequestCreated) {
      await onRequestCreated({
        txid: requestTxid,
        vaultTxid: requestTxid,
        request,
        ...(swapPsbtHex ? { swapPsbtHex } : {}),
      });
    }

    // ── Step 10: Submit to Guardian ──
    // (matches web: repossess.op.ts:214-224)
    progress('Submitting to network...');

    guardian = await getGuardianClient(vaultPubkey);
    const guardSub = createGuardianVaultSubscription(guardian, action, request);
    guardSub.on?.('info', (info: unknown) => logger.debug(`[Liquidation] Guardian: ${info}`));
    const guardRes = await resolveGuardianVaultSubscription(guardSub);

    const txid = guardRes.vault_txid || guardRes.repo_txid || guardRes.liquid_txid || '';
    if (txid) {
      await registerLiquidationTxid(txid);
    }
    logger.info('[Liquidation] Guardian response', {
      txid,
      responseKeys: Object.keys(guardRes),
    });

    progress('Liquidation complete!');
    await disconnectGuardian();

    return { success: true, txid, vaultTxid: txid, swapPsbtHex };
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
      try {
        await disconnectGuardian();
      } catch {
        /* */
      }
    }

    return { success: false, error: msg };
  }
}
