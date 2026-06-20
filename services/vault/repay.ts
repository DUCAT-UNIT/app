/**
 * Vault Repay Operations
 */

import type {
  BaseUtxo,
  GuardianSocket,
  PriceQuote,
  RuneUtxo,
  UnitAccountResponse,
  VaultProfile,
  VaultRepayCtx,
  VaultRepayResponse,
  VaultWallet,
  WalletVaultRepayConfig,
  WalletVaultRepayRequest,
} from '@ducat-unit/client-sdk';
import {
  getAddressUtxoUrl,
  getOrdOutputUrl,
  VAULT_CONFIG,
  BITCOIN_TX,
} from '../../utils/constants';
import { getJsonWithNativeTimeout } from '../../utils/nativeHttp';
import { getErrorMessage } from '../../utils/errorUtils';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { MAX_QUOTE_AGE_SECONDS } from '../oracleService';
import { withVaultOperationLock, Utxo } from './utils';
import { withVaultBuildTimeout } from './operationTimeout';
import {
  clearPendingVaultSigningOperation,
  setPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';
import { resolveVaultActionPriceQuote } from './priceQuote';

const REPAY_REQUEST_BUILD_TIMEOUT_MS = 225_000;
const PREFERRED_UNIT_DIRECT_TIMEOUT_MS = 8_000;
const PREFERRED_UNIT_DIRECT_WAIT_MS = 180_000;
const PREFERRED_UNIT_DIRECT_RETRY_MS = 2_000;
const PREFERRED_UNIT_FETCH_TIMEOUT_MS =
  PREFERRED_UNIT_DIRECT_WAIT_MS + PREFERRED_UNIT_DIRECT_TIMEOUT_MS + 7_000;

export interface CreateRepayReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  utxos?: Utxo[];
}

interface AddressUtxoResponse {
  txid: string;
  vout: number;
  value: number;
}

interface OrdRuneRecord {
  amount: number | string;
  divisibility: number;
  symbol: string;
}

interface OrdOutputResponse {
  inscriptions?: string[];
  runes?: Record<string, OrdRuneRecord> | null;
  script_pubkey?: string;
  spent?: boolean;
  transaction?: string;
  value?: number;
}

let preferredRepayUnitTxids: Set<string> | null = null;

export function setPreferredRepayUnitTxids(txids: string[]): void {
  preferredRepayUnitTxids = new Set(txids.filter((txid) => txid.trim().length > 0));
}

export function clearPreferredRepayUnitTxids(): void {
  preferredRepayUnitTxids = null;
}

/**
 * Creates a repay configuration object
 * @param repayAmountUnit - UNIT amount to repay (in UNIT, not cents)
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Repay configuration
 */
export function createRepayConfig(
  repayAmountUnit: number,
  feeRate: number
): WalletVaultRepayConfig {
  logger.debug('[VaultOps] Creating repay config:', { repayAmountUnit, feeRate });

  const config: WalletVaultRepayConfig = {
    deposit_amount: 0, // No deposit when repaying
    repay_amount: Number((repayAmountUnit * 100).toFixed(0)), // Convert to cents
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Repay config created:', config);
  return config;
}

function getRuneUtxoAmount(utxo: RuneUtxo): number {
  const runeAmount = utxo.runes?.get(VAULT_CONFIG.RUNE_LABEL)?.amount;
  if (typeof runeAmount === 'number') {
    return runeAmount;
  }

  const legacyAmount = (utxo as RuneUtxo & { amount?: unknown }).amount;
  return typeof legacyAmount === 'number' ? legacyAmount : 0;
}

function getRuneUtxosAmount(utxos: RuneUtxo[]): number {
  return utxos.reduce((total, utxo) => total + getRuneUtxoAmount(utxo), 0);
}

function getOutpoint(utxo: Pick<RuneUtxo, 'txid' | 'vout'>): string {
  return `${utxo.txid}:${utxo.vout}`;
}

function selectRuneUtxosForAmount(utxos: RuneUtxo[], amount: number): RuneUtxo[] {
  const selected: RuneUtxo[] = [];
  let total = 0;

  for (const utxo of utxos) {
    const utxoAmount = getRuneUtxoAmount(utxo);
    if (utxoAmount <= 0) continue;

    selected.push(utxo);
    total += utxoAmount;
    if (total >= amount) {
      return selected;
    }
  }

  throw new Error(
    `Preferred TurboUNIT melt UTXO does not cover repay amount: ${total} < ${amount}`
  );
}

function createRuneUtxoFromOrdOutput(
  outpoint: AddressUtxoResponse,
  output: OrdOutputResponse
): RuneUtxo | null {
  if (output.spent || !output.runes) {
    return null;
  }

  const script = output.script_pubkey;
  const value = output.value ?? outpoint.value;
  if (!script || typeof value !== 'number') {
    return null;
  }

  const runes = new Map(
    Object.entries(output.runes).map(([rune, record]) => [
      rune,
      {
        amount: Number(record.amount),
        divisibility: record.divisibility,
        symbol: record.symbol,
      },
    ])
  );

  return {
    records: output.inscriptions ?? [],
    runes,
    script,
    txid: output.transaction ?? outpoint.txid,
    value,
    vout: outpoint.vout,
  };
}

async function fetchPreferredUnitUtxosDirect(
  wallet: VaultWallet,
  preferredTxids: Set<string>
): Promise<RuneUtxo[]> {
  const addressUtxos = await getJsonWithNativeTimeout<AddressUtxoResponse[]>(
    getAddressUtxoUrl(wallet.acct.runes.address),
    {
      timeout: PREFERRED_UNIT_DIRECT_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    }
  );
  const preferredOutputs = addressUtxos.filter((utxo) => preferredTxids.has(utxo.txid));
  const preferredUnitUtxos: RuneUtxo[] = [];

  for (const output of preferredOutputs) {
    const ordOutput = await getJsonWithNativeTimeout<OrdOutputResponse>(
      getOrdOutputUrl(`${output.txid}:${output.vout}`),
      {
        timeout: PREFERRED_UNIT_DIRECT_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      }
    );
    const runeUtxo = createRuneUtxoFromOrdOutput(output, ordOutput);
    if (runeUtxo) {
      preferredUnitUtxos.push(runeUtxo);
    }
  }

  return preferredUnitUtxos;
}

function mergeRuneUtxosByOutpoint(...groups: RuneUtxo[][]): RuneUtxo[] {
  const merged = new Map<string, RuneUtxo>();

  for (const group of groups) {
    for (const utxo of group) {
      merged.set(getOutpoint(utxo), utxo);
    }
  }

  return [...merged.values()];
}

async function fetchPreferredRepayUnitUtxos(
  wallet: VaultWallet,
  repayAmount: number,
  preferredTxids: Set<string>
): Promise<RuneUtxo[]> {
  const deadline = Date.now() + PREFERRED_UNIT_DIRECT_WAIT_MS;
  let attempt = 0;
  let lastError: unknown = null;
  let lastPreferredUtxos: RuneUtxo[] = [];

  while (Date.now() < deadline) {
    attempt += 1;

    try {
      const allUnitUtxos = await wallet.fetch.rune_utxos(VAULT_CONFIG.RUNE_LABEL);
      const preferredFromWallet = allUnitUtxos.filter((utxo) => preferredTxids.has(utxo.txid));
      let directPreferred: RuneUtxo[] = [];

      if (getRuneUtxosAmount(preferredFromWallet) < repayAmount) {
        directPreferred = await fetchPreferredUnitUtxosDirect(wallet, preferredTxids);
      }

      lastPreferredUtxos = mergeRuneUtxosByOutpoint(preferredFromWallet, directPreferred);
      const preferredAmount = getRuneUtxosAmount(lastPreferredUtxos);

      logger.info('[VaultOps] Checked preferred TurboUNIT melt UTXOs for repay', {
        attempt,
        preferredTxids: [...preferredTxids],
        walletPreferredCount: preferredFromWallet.length,
        directPreferredCount: directPreferred.length,
        preferredAmount,
        repayAmount,
      });

      if (preferredAmount >= repayAmount) {
        return selectRuneUtxosForAmount(lastPreferredUtxos, repayAmount);
      }
    } catch (error) {
      lastError = error;
      logger.info('[VaultOps] Preferred TurboUNIT melt UTXO check failed', {
        attempt,
        preferredTxids: [...preferredTxids],
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('[VaultOps] Preferred TurboUNIT melt UTXO not ready, retrying', {
      attempt,
      preferredTxids: [...preferredTxids],
      retryMs: PREFERRED_UNIT_DIRECT_RETRY_MS,
    });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, PREFERRED_UNIT_DIRECT_RETRY_MS);
    });
  }

  if (lastError instanceof Error && lastPreferredUtxos.length === 0) {
    throw lastError;
  }

  throw new Error(
    `Preferred TurboUNIT melt UTXO does not cover repay amount: ${getRuneUtxosAmount(
      lastPreferredUtxos
    )} < ${repayAmount}`
  );
}

async function fetchRepayUnitUtxos(wallet: VaultWallet, repayAmount: number): Promise<RuneUtxo[]> {
  if (!preferredRepayUnitTxids || preferredRepayUnitTxids.size === 0) {
    return wallet.fetch.rune_utxos(VAULT_CONFIG.RUNE_LABEL, repayAmount);
  }

  logger.info('[VaultOps] Using preferred TurboUNIT melt UTXOs for repay', {
    preferredTxids: [...preferredRepayUnitTxids],
    repayAmount,
  });

  return fetchPreferredRepayUnitUtxos(wallet, repayAmount, preferredRepayUnitTxids);
}

function getRepayUnitFetchTimeoutMs(): number | undefined {
  return preferredRepayUnitTxids && preferredRepayUnitTxids.size > 0
    ? PREFERRED_UNIT_FETCH_TIMEOUT_MS
    : undefined;
}

async function createSequentialRepayRequest(
  wallet: VaultWallet,
  vaultCtx: VaultRepayCtx,
  satsUtxos: BaseUtxo[],
  unitUtxos: RuneUtxo[]
): Promise<WalletVaultRepayRequest> {
  const startedAt = Date.now();
  logger.info('[VaultOps] Building latest repay request', {
    satsUtxosCount: satsUtxos.length,
    unitUtxosCount: unitUtxos.length,
  });

  const request = await wallet.vault.repay.req(vaultCtx, satsUtxos, unitUtxos);
  logger.info('[VaultOps] Latest repay request built', {
    durationMs: Date.now() - startedAt,
  });

  return {
    ...request,
    contract_id: wallet.contract_id,
    network: wallet.network,
  } as WalletVaultRepayRequest;
}

/**
 * Reserves UNIT amount from Guardian for repay operation
 * @param gclient - Connected Guardian socket
 * @param repayConfig - Repay configuration
 * @param vaultPubkey - Vault public key (taproot)
 * @returns Unit account response with mint account info
 */
export async function guardianRepayReserve(
  gclient: GuardianSocket,
  repayConfig: WalletVaultRepayConfig,
  vaultPubkey: string
): Promise<UnitAccountResponse> {
  logger.debug('[VaultOps] Reserving UNIT from guardian for repay:', {
    amount: repayConfig.repay_amount,
    vaultPubkey,
  });

  const acctRes = await withGuardianTimeout(
    gclient.req.unit
      .reserve({
        unit_amount: repayConfig.repay_amount,
        vault_action: 'repay',
        vault_pubkey: vaultPubkey,
      })
      .resolve(30_000)
  );

  logger.debug('[VaultOps] UNIT reserved for repay:', acctRes);
  return acctRes as UnitAccountResponse;
}

/**
 * Creates a vault repay request with PSBT for signing
 * @param wallet - VaultWallet instance
 * @param repayConfig - Repay configuration
 * @param acctRes - Unit account response from guardian
 * @param options - Options including oracle quote and vault profile
 * @returns Vault repay request with PSBT
 */
export async function createVaultReqRepay(
  wallet: VaultWallet,
  repayConfig: WalletVaultRepayConfig,
  acctRes: UnitAccountResponse,
  options: CreateRepayReqOptions
): Promise<WalletVaultRepayRequest> {
  // SECURITY: Serialize vault operations to prevent concurrent UTXO usage
  return withVaultOperationLock(
    () =>
      withVaultBuildTimeout(
        buildVaultReqRepay(wallet, repayConfig, acctRes, options),
        'Timed out building the repay transaction. Please try again.',
        REPAY_REQUEST_BUILD_TIMEOUT_MS
      ),
    options.vaultProfile.vault_pk || '__default__'
  ); // end withVaultOperationLock
}

async function buildVaultReqRepay(
  wallet: VaultWallet,
  repayConfig: WalletVaultRepayConfig,
  acctRes: UnitAccountResponse,
  options: CreateRepayReqOptions
): Promise<WalletVaultRepayRequest> {
  logger.info('[VaultOps] Creating repay request', {
    repayAmount: repayConfig.repay_amount,
    feeRate: options.feeRate,
  });

  try {
    const { feeRate, oracleQuote, vaultProfile } = options;

    // SECURITY: Re-validate oracle price freshness before building transaction.
    const quoteAgeSec = Math.floor(Date.now() / 1000) - oracleQuote.latest_stamp;
    if (quoteAgeSec > MAX_QUOTE_AGE_SECONDS) {
      throw new Error(
        `Oracle price is stale (${Math.floor(quoteAgeSec / 60)} min old). Please go back and refresh.`
      );
    }

    logger.debug('[VaultOps] Repay context inputs:', {
      mintAccount: !!acctRes.mint_account,
      oracleQuote: !!oracleQuote,
      vaultProfile: {
        acct_id: vaultProfile.acct_id,
        guard_pk: vaultProfile.guard_pk?.substring(0, 20) + '...',
        master_id: vaultProfile.master_id,
        vault_pk: vaultProfile.vault_pk?.substring(0, 20) + '...',
        hasRdata: !!vaultProfile.rdata,
        hasUtxo: !!vaultProfile.utxo,
      },
      repayAmount: repayConfig.repay_amount,
    });

    // Create repay context
    const contextStartedAt = Date.now();
    let vaultCtx: VaultRepayCtx = wallet.vault.repay.ctx(
      acctRes.mint_account,
      oracleQuote,
      vaultProfile,
      repayConfig
    );
    logger.info('[VaultOps] Repay context ready', {
      durationMs: Date.now() - contextStartedAt,
      repayAmount: vaultCtx.repay_amount,
    });

    // Get transaction quote
    const quoteStartedAt = Date.now();
    const txQuote = wallet.vault.repay.quote(vaultCtx);
    logger.info('[VaultOps] Repay tx quote ready', {
      durationMs: Date.now() - quoteStartedAt,
      totalCost: txQuote.total_cost,
    });

    // Get sats UTXOs for transaction fees
    let satsUtxos = options.utxos;
    if (!satsUtxos) {
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
      const satsStartedAt = Date.now();
      satsUtxos = await withVaultBuildTimeout(
        wallet.fetch.sats_utxos(costWithVins),
        'Timed out fetching BTC UTXOs for repay. Please try again.'
      );
      logger.info('[VaultOps] BTC UTXOs ready for repay', {
        durationMs: Date.now() - satsStartedAt,
        count: satsUtxos?.length ?? 0,
      });
    }

    if (!satsUtxos || satsUtxos.length === 0) {
      throw new Error('No sats UTXOs available for repay transaction fees');
    }

    // Get UNIT UTXOs for burning (required for repay)
    // NOTE: rune_utxos may include UTXOs that are in pending transactions.
    // The Guardian will reject double-spend attempts, but the error message may be confusing.
    logger.debug('[VaultOps] Fetching UNIT UTXOs for repay (no spent-filter available via SDK)', {
      requiredAmount: vaultCtx.repay_amount,
    });
    const unitStartedAt = Date.now();
    const unitUtxos = await withVaultBuildTimeout(
      fetchRepayUnitUtxos(wallet, vaultCtx.repay_amount),
      'Timed out fetching UNIT UTXOs for repay. Please try again.',
      getRepayUnitFetchTimeoutMs()
    );
    logger.info('[VaultOps] UNIT UTXOs ready for repay', {
      durationMs: Date.now() - unitStartedAt,
      count: unitUtxos?.length ?? 0,
    });

    if (!unitUtxos || unitUtxos.length === 0) {
      throw new Error('No UNIT UTXOs available to repay. Make sure you have enough UNIT tokens.');
    }

    logger.debug('[VaultOps] UTXOs for repay:', {
      satsUtxosCount: satsUtxos.length,
      unitUtxosCount: unitUtxos.length,
    });

    const requestOracleQuote = await resolveVaultActionPriceQuote({
      actionName: 'repay',
      vaultCtx,
      oracleQuote,
      fundUtxos: satsUtxos,
      unitUtxos,
    });
    if (requestOracleQuote !== oracleQuote) {
      vaultCtx = wallet.vault.repay.ctx(
        acctRes.mint_account,
        requestOracleQuote,
        vaultProfile,
        repayConfig
      );
    }

    logger.info('[VaultOps] Signing repay request', {
      signingMode: 'latest-sdk',
      satsUtxosCount: satsUtxos.length,
      unitUtxosCount: unitUtxos.length,
    });

    let repayReq: WalletVaultRepayRequest;
    setPendingVaultSigningOperation({
      action: 'repay',
      ctx: vaultCtx,
      satsUtxos,
      unitUtxos,
    });
    try {
      const signingStartedAt = Date.now();
      repayReq = await withVaultBuildTimeout(
        createSequentialRepayRequest(wallet, vaultCtx, satsUtxos, unitUtxos),
        'Timed out building the repay transaction. Please try again.'
      );
      logger.info('[VaultOps] Repay request signed', {
        durationMs: Date.now() - signingStartedAt,
        signingMode: 'latest-sdk',
      });
    } finally {
      clearPendingVaultSigningOperation();
    }

    logger.debug('[VaultOps] Repay request created:', {
      sats_inputs_count: repayReq.sats_inputs?.length,
    });

    return repayReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create repay request:', {
      error: getErrorMessage(error, 'Unknown repay request build error'),
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}

/**
 * Submits signed repay request to Guardian
 * @param gclient - Connected Guardian socket
 * @param repayReq - Signed repay request
 * @returns Transaction IDs (issue and vault)
 */
export async function guardianSendReqRepay(
  gclient: GuardianSocket,
  repayReq: WalletVaultRepayRequest
): Promise<{ txid: string; vault_txid: string }> {
  logger.debug('[VaultOps] Submitting repay request to guardian...');

  try {
    const submitStartedAt = Date.now();
    const guardSub = gclient.req.vault.repay(repayReq);
    logger.info('[VaultOps] Repay request submitted to guardian', {
      durationMs: Date.now() - submitStartedAt,
    });

    const guardRes = (await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + BITCOIN_TX.TX_TIMEOUT_BUFFER
    )) as VaultRepayResponse;

    const txid = guardRes.repay_txid;
    const vault_txid = guardRes.vault_txid;

    logger.info('[VaultOps] Repay guardian response ready', {
      durationMs: Date.now() - submitStartedAt,
      txid,
      vault_txid,
    });

    return {
      txid: txid ?? vault_txid ?? '',
      vault_txid: vault_txid ?? txid ?? '',
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error, 'Unknown guardian repay submit error');
    logger.error('[VaultOps] Failed to submit repay request:', {
      message: errorMessage,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}
