import { useCallback, useMemo, useState } from 'react';
import type { RuneUtxo } from '@ducat-unit/client-sdk';
import { useCashuOperations } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { getBalance as getCashuBalance } from '../../services/cashu/cashuBalanceService';
import {
  checkMeltQuote,
  requestMelt,
  completeMelt,
  type MeltQuote,
  type MeltQuoteResult,
} from '../../services/cashu/cashuWalletService';
import { requestRedemption } from '../../services/evmBridgeService';
import { getRedemptionStatus } from '../../services/bridgeApiService';
import { getBoolean, SettingKeys } from '../../services/settingsService';
import {
  withVaultBuildTimeout,
  withVaultBuildTimeoutFn,
} from '../../services/vault/operationTimeout';
import {
  clearPreferredRepayUnitTxids,
  setPreferredRepayUnitTxids,
} from '../../services/vault/repay';
import { createVaultWallet } from '../../services/vaultWalletService';
import { getAddressUtxoUrl, getOrdOutputUrl, VAULT_CONFIG } from '../../utils/constants';
import { getJsonWithNativeTimeout } from '../../utils/nativeHttp';
import { logger } from '../../utils/logger';
import { useRepay, useRepayStore } from '../../stores/repayStore';
import {
  persistVaultSettlementNow,
  shouldPreserveVaultSettlementRecovery,
  useVaultSettlementStore,
} from '../../stores/vaultSettlementStore';
import {
  formatVaultSettlementAmountInput,
  quoteVaultRepaySettlement,
  waitForRedemptionRelease,
} from '../../services/vaultSettlementService';
import { useRepayVault, type UseRepayVaultResult } from './useRepayVault';

const RELEASED_UNIT_UTXO_TIMEOUT_MS = 15_000;
const RELEASED_UNIT_DIRECT_TIMEOUT_MS = 8_000;
const RELEASED_UNIT_VISIBILITY_TIMEOUT_MS = 180_000;
const RELEASED_UNIT_VISIBILITY_POLL_MS = 5_000;
const RAW_REPAY_LOAD_TIMEOUT_MS = 15_000;
const TURBO_REPAY_BALANCE_TIMEOUT_MS = 8_000;
const TURBO_REPAY_MELT_QUOTE_TIMEOUT_MS = 15_000;
const TURBO_REPAY_QUOTE_TIMEOUT_MS = 20_000;
const USDC_REPAY_QUOTE_TIMEOUT_MS = 30_000;
const RAW_REPAY_MISSING_INPUT_MAX_ATTEMPTS = 4;
const RAW_REPAY_MISSING_INPUT_RETRY_MS = 15_000;
const TURBO_REPAY_PENDING_MELT_QUOTE_TIMEOUT_MS = 45_000;
const TURBO_REPAY_PENDING_MELT_QUOTE_POLL_MS = 3_000;
const CASHU_MINT_WITHDRAWAL_FAILURE = 'Withdrawal failed - your ecash tokens remain valid';
const LOCAL_PENDING_SETTLEMENT_ERROR =
  'A vault settlement is still pending. Resume or reset it before starting another.';
const TURBOUNIT_MINT_WITHDRAWAL_FAILURE_MESSAGE =
  'The TurboUNIT mint could not broadcast the UNIT withdrawal. Your TurboUNIT remains in your wallet. Try a smaller amount or try again later.';
const ACCEPTED_MELT_STATES = new Set(['PAID']);
const FAILED_MELT_STATES = new Set(['FAILED', 'EXPIRED', 'CANCELED', 'CANCELLED']);

type RecoverableMeltQuote = MeltQuote & {
  txid?: string | null;
  outpoint?: string | null;
  payment_preimage?: string | null;
};

interface AddressUtxoResponse {
  txid: string;
  vout: number;
  value: number;
}

interface OrdReleasedOutputResponse {
  runes?: Record<string, { amount: number | string; divisibility: number; symbol: string }> | null;
  spent?: boolean;
  transaction?: string;
  value?: number;
}

function formatSmallestUnitAmount(amount: number): string {
  return formatVaultSettlementAmountInput(amount / 100);
}

function getRepayDisplayError(message: string): string {
  if (message.includes(CASHU_MINT_WITHDRAWAL_FAILURE)) {
    return TURBOUNIT_MINT_WITHDRAWAL_FAILURE_MESSAGE;
  }
  return message;
}

function getLatestRawRepayError(fallbackError: string | null): string {
  return useRepayStore.getState().error || fallbackError || 'Vault repay failed';
}

function isLocalPendingSettlementError(error: unknown): boolean {
  return error instanceof Error && error.message === LOCAL_PENDING_SETTLEMENT_ERROR;
}

function isMissingInputsError(message: string): boolean {
  return /missing[-\s]inputs/i.test(message);
}

function isSameRepayAmount(storedAmountUsd: number, repayAmountUsd: number): boolean {
  return Math.round(storedAmountUsd * 100) === Math.round(repayAmountUsd * 100);
}

async function waitForRetryDelay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
}

async function loadRawRepayVaultData(
  rawRepay: UseRepayVaultResult,
  source: 'direct_unit' | 'settlement_release'
): Promise<boolean> {
  useRepayStore.getState().setProcessingStep(source === 'settlement_release' ? 3 : 1);
  const startedAt = Date.now();
  logger.info('[VaultRepayFromUsdc] Refreshing vault data before raw repay', { source });

  const loaded = await withVaultBuildTimeout(
    rawRepay.loadVaultData(),
    'Timed out preparing the repay request. Please try again.',
    RAW_REPAY_LOAD_TIMEOUT_MS
  );

  logger.info('[VaultRepayFromUsdc] Vault data refresh finished before raw repay', {
    source,
    durationMs: Date.now() - startedAt,
    loaded,
  });

  return loaded;
}

function refreshCashuBalanceAfterMelt(
  refreshCashuBalance: () => Promise<unknown>,
  context: { currentAccount: number; source: 'recovered_melt' | 'new_melt' }
): void {
  void Promise.resolve()
    .then(refreshCashuBalance)
    .then(() => {
      logger.debug('[VaultRepayFromUsdc] TurboUNIT balance refreshed after melt', context);
    })
    .catch((error) => {
      logger.debug('[VaultRepayFromUsdc] TurboUNIT balance refresh skipped after melt', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

function getMeltQuoteState(quote: Pick<MeltQuote, 'paid' | 'state'>): string {
  if (typeof quote.state === 'string' && quote.state.trim()) {
    return quote.state.toUpperCase();
  }
  return quote.paid === true ? 'PAID' : 'UNKNOWN';
}

function isAcceptedMeltQuote(quote: Pick<MeltQuote, 'paid' | 'state'>): boolean {
  return quote.paid === true || ACCEPTED_MELT_STATES.has(getMeltQuoteState(quote));
}

function isFailedMeltQuote(quote: Pick<MeltQuote, 'paid' | 'state'>): boolean {
  return FAILED_MELT_STATES.has(getMeltQuoteState(quote));
}

function normalizeRecoverableMeltTxid(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.split(':')[0] || trimmed;
}

function getSubmittedMeltTxid(quote: RecoverableMeltQuote): string | null {
  return normalizeRecoverableMeltTxid(quote.txid) || normalizeRecoverableMeltTxid(quote.outpoint);
}

function getRecoverableMeltTxid(quote: RecoverableMeltQuote, fallbackQuoteId: string): string {
  const submittedTxid = getSubmittedMeltTxid(quote);
  if (submittedTxid) return submittedTxid;
  return quote.payment_preimage || quote.quote || fallbackQuoteId;
}

function getRecoverableMeltTotal(quote: MeltQuote): number | null {
  const amount = quote.amount ?? 0;
  const fee = quote.fee ?? quote.fee_reserve ?? 0;
  const total = amount + fee;
  return total > 0 ? total : null;
}

function isPendingMeltConfirmationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const meltState = (error as Error & { meltState?: unknown }).meltState;
  return (
    (typeof meltState === 'string' && meltState.toUpperCase() === 'PENDING') ||
    /State:\s*PENDING\b/i.test(error.message)
  );
}

function getSubmittedMeltTxidFromError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const meltError = error as Error & {
    meltResponse?: RecoverableMeltQuote | null;
    meltTxid?: unknown;
  };
  const directTxid =
    typeof meltError.meltTxid === 'string'
      ? normalizeRecoverableMeltTxid(meltError.meltTxid)
      : null;
  if (directTxid) return directTxid;
  return meltError.meltResponse ? getSubmittedMeltTxid(meltError.meltResponse) : null;
}

async function waitForSubmittedMeltQuote(quoteId: string): Promise<RecoverableMeltQuote> {
  const deadline = Date.now() + TURBO_REPAY_PENDING_MELT_QUOTE_TIMEOUT_MS;
  let lastState = 'UNKNOWN';

  while (Date.now() <= deadline) {
    const quote = (await checkMeltQuote(quoteId)) as RecoverableMeltQuote;
    lastState = getMeltQuoteState(quote);

    if (isAcceptedMeltQuote(quote) || getSubmittedMeltTxid(quote)) {
      return quote;
    }

    if (isFailedMeltQuote(quote)) {
      throw new Error(`TurboUNIT melt failed. State: ${lastState}.`);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await waitForRetryDelay(Math.min(TURBO_REPAY_PENDING_MELT_QUOTE_POLL_MS, remainingMs));
  }

  throw new Error(
    `TurboUNIT melt is still processing. Return to repay shortly to finish vault repayment. Last mint state: ${lastState}.`
  );
}

function getRuneUtxoAmount(utxo: RuneUtxo): number {
  const runeAmount = utxo.runes?.get(VAULT_CONFIG.RUNE_LABEL)?.amount;
  if (typeof runeAmount === 'number') {
    return runeAmount;
  }

  const legacyAmount = (utxo as RuneUtxo & { amount?: unknown }).amount;
  return typeof legacyAmount === 'number' ? legacyAmount : 0;
}

function normalizeRuneUtxos(
  unitUtxos: RuneUtxo[] | Map<string, RuneUtxo> | null | undefined
): RuneUtxo[] {
  if (Array.isArray(unitUtxos)) {
    return unitUtxos;
  }

  if (unitUtxos instanceof Map) {
    return [...unitUtxos.values()];
  }

  return [];
}

function hasSpendableUnitUtxo(
  unitUtxos: RuneUtxo[] | Map<string, RuneUtxo> | null | undefined,
  requiredAmount: number,
  requiredTxid?: string | null
): boolean {
  const normalizedUtxos = normalizeRuneUtxos(unitUtxos);
  const spendableUtxos = requiredTxid
    ? normalizedUtxos.filter((utxo) => utxo.txid === requiredTxid)
    : normalizedUtxos;
  return (
    spendableUtxos.reduce((total, utxo) => total + getRuneUtxoAmount(utxo), 0) >= requiredAmount
  );
}

function getSpendableUnitAmount(
  unitUtxos: RuneUtxo[] | Map<string, RuneUtxo> | null | undefined,
  requiredTxid?: string | null
): number {
  const normalizedUtxos = normalizeRuneUtxos(unitUtxos);
  const spendableUtxos = requiredTxid
    ? normalizedUtxos.filter((utxo) => utxo.txid === requiredTxid)
    : normalizedUtxos;
  return spendableUtxos.reduce((total, utxo) => total + getRuneUtxoAmount(utxo), 0);
}

function getReleasedOutputRuneAmount(output: OrdReleasedOutputResponse): number {
  if (output.spent || !output.runes) {
    return 0;
  }

  const runeAmount = output.runes[VAULT_CONFIG.RUNE_LABEL]?.amount;
  return runeAmount === undefined ? 0 : Number(runeAmount);
}

async function fetchReleasedUnitAmountByTxid(
  taprootAddress: string,
  requiredTxid: string
): Promise<{ outputCount: number; spendableAmount: number }> {
  const addressUtxos = await getJsonWithNativeTimeout<AddressUtxoResponse[]>(
    getAddressUtxoUrl(taprootAddress),
    {
      timeout: RELEASED_UNIT_DIRECT_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    }
  );
  const releasedOutputs = addressUtxos.filter((utxo) => utxo.txid === requiredTxid);
  let spendableAmount = 0;

  for (const output of releasedOutputs) {
    const ordOutput = await getJsonWithNativeTimeout<OrdReleasedOutputResponse>(
      getOrdOutputUrl(`${output.txid}:${output.vout}`),
      {
        timeout: RELEASED_UNIT_DIRECT_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      }
    );
    spendableAmount += getReleasedOutputRuneAmount(ordOutput);
  }

  return {
    outputCount: releasedOutputs.length,
    spendableAmount,
  };
}

interface TurboRepayQuote {
  meltAmount: number;
  quote: MeltQuoteResult | null;
  total: number;
  fee: number;
}

export interface UseRepayFromUsdcSettlementResult extends UseRepayVaultResult {
  quoteRepaySettlement: (amountUsd: number) => Promise<{
    fundingAsset: 'UNIT' | 'TURBOUNIT' | 'USDC';
    requiredUsdcIn: string;
    estimatedSepoliaFeeEth: string;
    requiredTurboUnitIn: string;
    estimatedTurboUnitFee: string;
  }>;
  quoteRepayFromUsdc: (amountUsd: number) => Promise<{
    requiredUsdcIn: string;
    estimatedSepoliaFeeEth: string;
  }>;
}

export function useRepayFromUsdcSettlement(): UseRepayFromUsdcSettlementResult {
  const rawRepay = useRepayVault();
  const store = useRepay();
  const {
    repayAmountUsd,
    repayFundingAsset,
    estimatedUsdcIn,
    estimatedSepoliaFeeEth,
    error: storeError,
    setError,
    setRepayQuote: setRepayStoreQuote,
    setTurboRepayQuote,
  } = store;
  const { wallet, currentAccount } = useWallet();
  const { refresh: refreshCashuBalance } = useCashuOperations();
  const [isSettling, setIsSettling] = useState(false);

  const {
    kind: settlementKind,
    phase: settlementPhase,
    faceValueUsd: settlementFaceValueUsd,
    requestedPayoutAsset: persistedRequestedPayoutAsset,
    redemptionId: persistedRedemptionId,
    cashuMeltQuoteId: persistedCashuMeltQuoteId,
    cashuMeltTxid: persistedCashuMeltTxid,
    startOperation,
    setPhase,
    setRepayQuote,
    setCashuMeltQuote,
    setCashuMeltTxid,
    setRedemptionResult,
    completeSettlement,
    markNeedsRetry,
    reset: resetSettlement,
  } = useVaultSettlementStore();

  const hasSpendableDirectUnitBalance = useCallback(
    async (amountUsd: number) => {
      if (
        !wallet?.segwitAddress ||
        !wallet?.segwitPubkey ||
        !wallet?.taprootAddress ||
        !wallet?.taprootPubkey
      ) {
        throw new Error('Wallet not connected');
      }

      const vaultWallet = await createVaultWallet({
        segwitAddress: wallet.segwitAddress,
        segwitPubkey: wallet.segwitPubkey,
        taprootAddress: wallet.taprootAddress,
        taprootPubkey: wallet.taprootPubkey,
      });

      const requiredAmount = Math.round(amountUsd * 100);
      const unitUtxos = await vaultWallet.fetch.rune_utxos(VAULT_CONFIG.RUNE_LABEL, requiredAmount);

      return Boolean(unitUtxos && unitUtxos.length > 0);
    },
    [wallet?.segwitAddress, wallet?.segwitPubkey, wallet?.taprootAddress, wallet?.taprootPubkey]
  );

  const getRequiredTurboMeltAmount = useCallback((amountUsd: number): number => {
    return Math.round(amountUsd * 100);
  }, []);

  const getTurboRepayQuote = useCallback(
    async (amountUsd: number): Promise<TurboRepayQuote | null> => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      const quoteStartedAt = Date.now();
      const meltAmount = getRequiredTurboMeltAmount(amountUsd);
      logger.info('[VaultRepayFromUsdc] Preparing TurboUNIT repay quote', {
        currentAccount,
        amountUsd,
        meltAmount,
      });

      if (meltAmount <= 0) {
        logger.info('[VaultRepayFromUsdc] TurboUNIT quote skipped; repay amount is zero', {
          currentAccount,
          amountUsd,
          durationMs: Date.now() - quoteStartedAt,
        });
        return {
          meltAmount: 0,
          quote: null,
          total: 0,
          fee: 0,
        };
      }

      const balanceStartedAt = Date.now();
      const cashuBalance = await withVaultBuildTimeoutFn(
        () => getCashuBalance(),
        'Timed out loading TurboUNIT balance. Please try again.',
        TURBO_REPAY_BALANCE_TIMEOUT_MS
      );
      logger.info('[VaultRepayFromUsdc] TurboUNIT balance ready for repay quote', {
        currentAccount,
        amountUsd,
        meltAmount,
        cashuBalance,
        durationMs: Date.now() - balanceStartedAt,
      });

      if (cashuBalance < meltAmount) {
        logger.info('[VaultRepayFromUsdc] TurboUNIT balance cannot cover repay amount', {
          currentAccount,
          amountUsd,
          meltAmount,
          cashuBalance,
        });
        return null;
      }

      const meltQuoteStartedAt = Date.now();
      const quote = await withVaultBuildTimeoutFn(
        () => requestMelt(wallet.taprootAddress, meltAmount),
        'Timed out preparing TurboUNIT melt quote. Please try again.',
        TURBO_REPAY_MELT_QUOTE_TIMEOUT_MS
      );
      logger.info('[VaultRepayFromUsdc] TurboUNIT melt quote ready', {
        currentAccount,
        amountUsd,
        meltAmount,
        quoteId: quote.quoteId,
        total: quote.total,
        fee: quote.fee,
        durationMs: Date.now() - meltQuoteStartedAt,
      });

      if (cashuBalance < quote.total) {
        logger.info('[VaultRepayFromUsdc] TurboUNIT balance cannot cover quote total', {
          currentAccount,
          amountUsd,
          meltAmount,
          cashuBalance,
          quoteTotal: quote.total,
        });
        return null;
      }

      logger.info('[VaultRepayFromUsdc] TurboUNIT repay quote ready', {
        currentAccount,
        amountUsd,
        meltAmount,
        quoteId: quote.quoteId,
        total: quote.total,
        fee: quote.fee,
        durationMs: Date.now() - quoteStartedAt,
      });

      return {
        meltAmount,
        quote,
        total: quote.total,
        fee: quote.fee,
      };
    },
    [currentAccount, getRequiredTurboMeltAmount, wallet?.taprootAddress]
  );

  const quoteUsdcRepaySettlement = useCallback(
    async (amountUsd: number) => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (!usdcFeaturesEnabled) {
        setRepayStoreQuote(null, null);
        setTurboRepayQuote(null, null);
        setRepayQuote(null, null);
        setError('Sepolia USDC repay is not enabled.');
        throw new Error('Sepolia USDC repay is not enabled.');
      }

      logger.debug('[VaultRepayFromUsdc] Sepolia USDC funding selected, quoting repay', {
        currentAccount,
        amountUsd,
        destinationTaprootAddress: wallet.taprootAddress,
      });
      const quote = await withVaultBuildTimeoutFn(
        () => quoteVaultRepaySettlement(currentAccount, amountUsd, wallet.taprootAddress),
        'Timed out preparing Sepolia USDC repay quote. Please try again.',
        USDC_REPAY_QUOTE_TIMEOUT_MS
      );
      logger.debug('[VaultRepayFromUsdc] Quote ready', {
        currentAccount,
        amountUsd,
        requiredUsdcIn: quote.requiredUsdcIn,
        estimatedSepoliaFeeEth: quote.estimatedSepoliaFeeEth,
      });

      setRepayStoreQuote(quote.requiredUsdcIn, quote.estimatedSepoliaFeeEth);
      setTurboRepayQuote(null, null);
      setRepayQuote(quote.requiredUsdcIn, quote.estimatedSepoliaFeeEth);
      setError(null);

      return {
        fundingAsset: 'USDC' as const,
        requiredUsdcIn: quote.requiredUsdcIn,
        estimatedSepoliaFeeEth: quote.estimatedSepoliaFeeEth,
        requiredTurboUnitIn: '0',
        estimatedTurboUnitFee: '0',
      };
    },
    [
      currentAccount,
      setError,
      setRepayQuote,
      setRepayStoreQuote,
      setTurboRepayQuote,
      wallet?.taprootAddress,
    ]
  );

  const quoteRepaySettlement = useCallback(
    async (amountUsd: number) => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      if (repayFundingAsset === 'UNIT') {
        const canRepayDirectly = await hasSpendableDirectUnitBalance(amountUsd);
        if (!canRepayDirectly) {
          setRepayStoreQuote(null, null);
          setTurboRepayQuote(null, null);
          setRepayQuote(null, null);
          setError('Not enough spendable UNIT to repay this amount.');
          throw new Error('Not enough spendable UNIT to repay this amount.');
        }

        logger.debug(
          '[VaultRepayFromUsdc] Direct UNIT funding selected, skipping settlement quote',
          {
            currentAccount,
            amountUsd,
          }
        );
        setRepayStoreQuote('0', '0');
        setTurboRepayQuote('0', '0');
        setRepayQuote('0', '0');
        setError(null);
        return {
          fundingAsset: 'UNIT' as const,
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
          requiredTurboUnitIn: '0',
          estimatedTurboUnitFee: '0',
        };
      }

      if (repayFundingAsset === 'TURBOUNIT') {
        const turboQuote = await withVaultBuildTimeoutFn(
          () => getTurboRepayQuote(amountUsd),
          'Timed out preparing TurboUNIT repay quote. Please try again.',
          TURBO_REPAY_QUOTE_TIMEOUT_MS
        );
        if (!turboQuote) {
          setRepayStoreQuote(null, null);
          setTurboRepayQuote(null, null);
          setRepayQuote(null, null);
          setError('Not enough UNIT plus TurboUNIT to repay this amount.');
          throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
        }

        const requiredTurboUnitIn = formatSmallestUnitAmount(turboQuote.total);
        const estimatedTurboUnitFee = formatSmallestUnitAmount(turboQuote.fee);
        logger.info('[VaultRepayFromUsdc] TurboUNIT funding selected, using Cashu melt quote', {
          currentAccount,
          amountUsd,
          meltAmount: turboQuote.meltAmount,
          quoteId: turboQuote.quote?.quoteId ?? null,
          total: turboQuote.total,
          fee: turboQuote.fee,
        });
        setRepayStoreQuote('0', '0');
        setTurboRepayQuote(requiredTurboUnitIn, estimatedTurboUnitFee);
        setRepayQuote('0', '0');
        setError(null);
        return {
          fundingAsset: 'TURBOUNIT' as const,
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
          requiredTurboUnitIn,
          estimatedTurboUnitFee,
        };
      }

      return quoteUsdcRepaySettlement(amountUsd);
    },
    [
      currentAccount,
      getTurboRepayQuote,
      hasSpendableDirectUnitBalance,
      quoteUsdcRepaySettlement,
      repayFundingAsset,
      setError,
      setRepayQuote,
      setRepayStoreQuote,
      setTurboRepayQuote,
      wallet?.taprootAddress,
    ]
  );

  const quoteRepayFromUsdc = useCallback(
    async (amountUsd: number) => {
      const quote = await quoteRepaySettlement(amountUsd);
      return {
        requiredUsdcIn: quote.requiredUsdcIn,
        estimatedSepoliaFeeEth: quote.estimatedSepoliaFeeEth,
      };
    },
    [quoteRepaySettlement]
  );

  const waitForSpendableReleasedUnit = useCallback(
    async (amountUsd: number, requiredTxid?: string | null) => {
      if (
        !wallet?.segwitAddress ||
        !wallet?.segwitPubkey ||
        !wallet?.taprootAddress ||
        !wallet?.taprootPubkey
      ) {
        throw new Error('Wallet not connected');
      }

      const vaultWallet = await createVaultWallet({
        segwitAddress: wallet.segwitAddress,
        segwitPubkey: wallet.segwitPubkey,
        taprootAddress: wallet.taprootAddress,
        taprootPubkey: wallet.taprootPubkey,
      });

      const requiredAmount = Math.round(amountUsd * 100);
      let lastError: unknown = null;

      const deadline = Date.now() + (requiredTxid
        ? RELEASED_UNIT_VISIBILITY_TIMEOUT_MS
        : RELEASED_UNIT_UTXO_TIMEOUT_MS);
      let attempt = 0;

      while (true) {
        attempt += 1;

        if (requiredTxid) {
          try {
            const releasedUnit = await withVaultBuildTimeoutFn(
              () => fetchReleasedUnitAmountByTxid(wallet.taprootAddress, requiredTxid),
              'Timed out checking released UNIT output.',
              RELEASED_UNIT_UTXO_TIMEOUT_MS
            );
            logger.info('[VaultRepayFromUsdc] Checked released UNIT output directly', {
              attempt,
              currentAccount,
              requiredAmount,
              requiredTxid,
              spendableAmount: releasedUnit.spendableAmount,
              outputCount: releasedUnit.outputCount,
            });

            if (releasedUnit.spendableAmount >= requiredAmount) {
              logger.info('[VaultRepayFromUsdc] Released UNIT available for raw repay', {
                currentAccount,
                attempt,
                requiredAmount,
                requiredTxid,
                spendableAmount: releasedUnit.spendableAmount,
                outputCount: releasedUnit.outputCount,
              });
              return;
            }
          } catch (error) {
            lastError = error;
            logger.info('[VaultRepayFromUsdc] Direct released UNIT output check failed', {
              attempt,
              currentAccount,
              requiredTxid,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        try {
          const unitUtxos = await withVaultBuildTimeoutFn(
            () =>
              requiredTxid
                ? vaultWallet.fetch.rune_utxos(VAULT_CONFIG.RUNE_LABEL)
                : vaultWallet.fetch.rune_utxos(VAULT_CONFIG.RUNE_LABEL, requiredAmount),
            'Timed out checking released UNIT UTXOs.',
            RELEASED_UNIT_UTXO_TIMEOUT_MS
          );
          const typedUnitUtxos = normalizeRuneUtxos(unitUtxos as RuneUtxo[] | Map<string, RuneUtxo>);
          const spendableAmount = getSpendableUnitAmount(typedUnitUtxos, requiredTxid);

          logger.info('[VaultRepayFromUsdc] Checked released UNIT spendability', {
            attempt,
            currentAccount,
            requiredAmount,
            requiredTxid,
            spendableAmount,
            utxoCount: typedUnitUtxos.length,
          });

          if (hasSpendableUnitUtxo(typedUnitUtxos, requiredAmount, requiredTxid)) {
            return;
          }
        } catch (error) {
          lastError = error;
          logger.info('[VaultRepayFromUsdc] Released UNIT spendability check failed', {
            attempt,
            currentAccount,
            requiredTxid,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        const remainingMs = deadline - Date.now();
        if (!requiredTxid || remainingMs <= 0) {
          break;
        }

        const retryMs = Math.min(RELEASED_UNIT_VISIBILITY_POLL_MS, remainingMs);
        logger.info('[VaultRepayFromUsdc] Waiting for released UNIT output visibility', {
          attempt,
          currentAccount,
          requiredTxid,
          retryMs,
        });
        await waitForRetryDelay(retryMs);
      }

      throw lastError instanceof Error
        ? lastError
        : new Error(
            requiredTxid
              ? 'Released UNIT output is not visible yet. Please try again.'
              : 'Released UNIT is not yet spendable for repay'
          );
    },
    [
      currentAccount,
      wallet?.segwitAddress,
      wallet?.segwitPubkey,
      wallet?.taprootAddress,
      wallet?.taprootPubkey,
    ]
  );

  const repay = useCallback(async () => {
    if (!wallet?.taprootAddress) {
      setError('Wallet not connected');
      return null;
    }

    let activeRequestedPayoutAsset = repayFundingAsset;

    setIsSettling(true);
    setError(null);

    try {
      const canResumePersistedRepay =
        settlementKind === 'repay' && isSameRepayAmount(settlementFaceValueUsd, repayAmountUsd);
      const hasPersistedTurboMelt =
        canResumePersistedRepay && (!!persistedCashuMeltTxid || !!persistedCashuMeltQuoteId);
      const requestedPayoutAsset =
        canResumePersistedRepay && (hasPersistedTurboMelt || persistedRedemptionId)
          ? persistedRequestedPayoutAsset
          : repayFundingAsset;
      activeRequestedPayoutAsset = requestedPayoutAsset;
      // Direct UNIT spendability is already checked while quoting the confirm screen.
      // Repeating that UTXO fetch here keeps the processing screen on step 1 before
      // the raw repay operation can publish its own progress.
      const canRepayDirectly = requestedPayoutAsset === 'UNIT';
      const turboQuote =
        requestedPayoutAsset === 'TURBOUNIT' && !hasPersistedTurboMelt
          ? await withVaultBuildTimeoutFn(
              () => getTurboRepayQuote(repayAmountUsd),
              'Timed out preparing TurboUNIT repay quote. Please try again.',
              TURBO_REPAY_QUOTE_TIMEOUT_MS
            )
          : null;
      const canRepayWithTurboUnit =
        requestedPayoutAsset === 'TURBOUNIT' && (!!turboQuote || hasPersistedTurboMelt);
      if (requestedPayoutAsset === 'TURBOUNIT' && !canRepayWithTurboUnit) {
        throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
      }
      if (requestedPayoutAsset === 'USDC') {
        const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
        if (!usdcFeaturesEnabled) {
          throw new Error('Sepolia USDC repay is not enabled.');
        }
      }

      if (requestedPayoutAsset === 'UNIT') {
        activeRequestedPayoutAsset = 'UNIT';
        logger.info('[VaultRepayFromUsdc] Direct UNIT funding selected, executing raw repay', {
          currentAccount,
          repayAmountUsd,
        });
        if (!shouldPreserveVaultSettlementRecovery(settlementPhase)) {
          resetSettlement();
        }

        const loaded = await loadRawRepayVaultData(rawRepay, 'direct_unit');
        if (!loaded) {
          throw new Error('Unable to refresh vault data before repay');
        }

        logger.info('[VaultRepayFromUsdc] Starting raw vault repay', {
          currentAccount,
          fundingAsset: 'UNIT',
        });
        const result = await rawRepay.repay();
        if (!result) {
          throw new Error(getLatestRawRepayError(rawRepay.error));
        }

        return result;
      }

      try {
        startOperation('repay', repayAmountUsd, requestedPayoutAsset, {
          accountIndex: currentAccount,
          taprootAddress: wallet.taprootAddress,
        });
      } catch (operationError) {
        if (!isLocalPendingSettlementError(operationError)) {
          throw operationError;
        }

        logger.info('[VaultRepayFromUsdc] Resetting blocked local settlement before repay retry', {
          currentAccount,
          previousFaceValueUsd: settlementFaceValueUsd,
          repayAmountUsd,
          requestedPayoutAsset,
        });
        resetSettlement();
        await persistVaultSettlementNow();
        startOperation('repay', repayAmountUsd, requestedPayoutAsset, {
          accountIndex: currentAccount,
          taprootAddress: wallet.taprootAddress,
        });
      }
      await persistVaultSettlementNow();
      logger.debug('[VaultRepayFromUsdc] Starting repay settlement', {
        currentAccount,
        repayAmountUsd,
        requestedPayoutAsset,
        destinationTaprootAddress: wallet.taprootAddress,
      });

      let turboSettlementAmount = turboQuote ? formatSmallestUnitAmount(turboQuote.total) : '0';
      const cachedUsdcQuote =
        requestedPayoutAsset === 'USDC' && estimatedUsdcIn && estimatedSepoliaFeeEth
          ? {
              fundingAsset: 'USDC' as const,
              requiredUsdcIn: estimatedUsdcIn,
              estimatedSepoliaFeeEth,
              requiredTurboUnitIn: '0',
              estimatedTurboUnitFee: '0',
            }
          : null;
      const quote =
        requestedPayoutAsset === 'USDC'
          ? (cachedUsdcQuote ?? (await quoteUsdcRepaySettlement(repayAmountUsd)))
          : {
              fundingAsset: requestedPayoutAsset,
              requiredUsdcIn: '0',
              estimatedSepoliaFeeEth: '0',
              requiredTurboUnitIn: turboSettlementAmount,
              estimatedTurboUnitFee: turboQuote ? formatSmallestUnitAmount(turboQuote.fee) : '0',
            };
      if (cachedUsdcQuote) {
        setRepayQuote(cachedUsdcQuote.requiredUsdcIn, cachedUsdcQuote.estimatedSepoliaFeeEth);
        await persistVaultSettlementNow();
        logger.info('[VaultRepayFromUsdc] Using cached Sepolia USDC repay quote for execution', {
          currentAccount,
          repayAmountUsd,
          requiredUsdcIn: cachedUsdcQuote.requiredUsdcIn,
          estimatedSepoliaFeeEth: cachedUsdcQuote.estimatedSepoliaFeeEth,
        });
      }
      const amountInput = formatVaultSettlementAmountInput(repayAmountUsd);
      logger.debug('[VaultRepayFromUsdc] Quote locked for execution', {
        currentAccount,
        repayAmountUsd,
        amountInput,
        requiredUsdcIn: quote.requiredUsdcIn,
        requiredTurboUnitIn: quote.requiredTurboUnitIn,
        canRepayDirectly,
      });

      let requiredMeltTxid: string | null = null;
      if (requestedPayoutAsset === 'TURBOUNIT') {
        let hasSubmittedTurboMelt = false;
        let turboMeltTxid: string | null = persistedCashuMeltTxid;

        if (canResumePersistedRepay && persistedCashuMeltTxid) {
          hasSubmittedTurboMelt = true;
          logger.debug('[VaultRepayFromUsdc] Resuming existing TurboUNIT melt', {
            currentAccount,
            cashuMeltTxid: persistedCashuMeltTxid,
          });
        } else if (canResumePersistedRepay && persistedCashuMeltQuoteId) {
          setPhase('melting_turbo_repay');
          let persistedMeltQuote: RecoverableMeltQuote;
          try {
            persistedMeltQuote = (await checkMeltQuote(
              persistedCashuMeltQuoteId
            )) as RecoverableMeltQuote;
          } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)), {
              scope: 'useRepayFromUsdcSettlement.recoverTurboMeltQuote',
              quoteId: persistedCashuMeltQuoteId,
            });
            throw new Error(
              'Unable to check pending TurboUNIT withdrawal status. Try again when the mint is reachable.'
            );
          }

          const submittedMeltTxid = getSubmittedMeltTxid(persistedMeltQuote);
          if (isAcceptedMeltQuote(persistedMeltQuote) || submittedMeltTxid) {
            const recoveredTxid =
              submittedMeltTxid ||
              getRecoverableMeltTxid(persistedMeltQuote, persistedCashuMeltQuoteId);
            const recoveredTotal = getRecoverableMeltTotal(persistedMeltQuote);
            if (recoveredTotal !== null) {
              turboSettlementAmount = formatSmallestUnitAmount(recoveredTotal);
            }
            setCashuMeltTxid(recoveredTxid);
            turboMeltTxid = recoveredTxid;
            await persistVaultSettlementNow();
            refreshCashuBalanceAfterMelt(refreshCashuBalance, {
              currentAccount,
              source: 'recovered_melt',
            });
            hasSubmittedTurboMelt = true;
            logger.debug('[VaultRepayFromUsdc] Recovered accepted TurboUNIT melt quote', {
              currentAccount,
              quoteId: persistedCashuMeltQuoteId,
              txid: recoveredTxid,
              state: persistedMeltQuote.state,
              submittedBeforePaid: !isAcceptedMeltQuote(persistedMeltQuote),
            });
          } else {
            logger.debug('[VaultRepayFromUsdc] Pending TurboUNIT melt quote was not accepted', {
              currentAccount,
              quoteId: persistedCashuMeltQuoteId,
              state: persistedMeltQuote.state,
            });
          }
        }

        if (!hasSubmittedTurboMelt) {
          const activeTurboQuote =
            turboQuote ??
            (await withVaultBuildTimeoutFn(
              () => getTurboRepayQuote(repayAmountUsd),
              'Timed out preparing TurboUNIT repay quote. Please try again.',
              TURBO_REPAY_QUOTE_TIMEOUT_MS
            ));
          if (!activeTurboQuote) {
            throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
          }
          if (activeTurboQuote.quote && activeTurboQuote.meltAmount > 0) {
            setPhase('melting_turbo_repay');
            useRepayStore.getState().setProcessingStep(2);
            const quoteId = activeTurboQuote.quote.quoteId;
            const quoteTotal = activeTurboQuote.quote.total;
            turboSettlementAmount = formatSmallestUnitAmount(quoteTotal);
            setCashuMeltQuote(quoteId);
            await persistVaultSettlementNow();
            let meltTxid: string | null = null;
            try {
              const meltResult = await completeMelt(quoteId, quoteTotal);
              meltTxid = normalizeRecoverableMeltTxid(meltResult.txid) || meltResult.txid;
            } catch (error) {
              if (!isPendingMeltConfirmationError(error)) {
                throw error;
              }

              meltTxid = getSubmittedMeltTxidFromError(error);
              let recoveredQuote: RecoverableMeltQuote | null = null;
              if (!meltTxid) {
                logger.info(
                  '[VaultRepayFromUsdc] TurboUNIT melt pending without txid; polling quote',
                  {
                    currentAccount,
                    quoteId,
                  }
                );
                recoveredQuote = await waitForSubmittedMeltQuote(quoteId);
                meltTxid =
                  getSubmittedMeltTxid(recoveredQuote) ||
                  (isAcceptedMeltQuote(recoveredQuote)
                    ? getRecoverableMeltTxid(recoveredQuote, quoteId)
                    : null);
              }

              if (recoveredQuote) {
                const recoveredTotal = getRecoverableMeltTotal(recoveredQuote);
                if (recoveredTotal !== null) {
                  turboSettlementAmount = formatSmallestUnitAmount(recoveredTotal);
                }
              }

              if (!meltTxid) {
                throw new Error(
                  'TurboUNIT melt was submitted but the mint did not return a release transaction id.'
                );
              }

              logger.info(
                '[VaultRepayFromUsdc] TurboUNIT melt pending; continuing with submitted txid',
                {
                  currentAccount,
                  quoteId,
                  txid: meltTxid,
                  state:
                    recoveredQuote?.state ?? (error as Error & { meltState?: string }).meltState,
                }
              );
            }

            setCashuMeltTxid(meltTxid);
            turboMeltTxid = meltTxid;
            await persistVaultSettlementNow();
            refreshCashuBalanceAfterMelt(refreshCashuBalance, {
              currentAccount,
              source: 'new_melt',
            });
            hasSubmittedTurboMelt = true;
            logger.debug('[VaultRepayFromUsdc] TurboUNIT melt submitted', {
              currentAccount,
              quoteId,
              txid: meltTxid,
              meltAmount: activeTurboQuote.meltAmount,
            });
          }
        }

        if (hasSubmittedTurboMelt) {
          requiredMeltTxid = turboMeltTxid;
          setPhase('waiting_turbo_release');
          useRepayStore.getState().setProcessingStep(3);
        } else {
          throw new Error('TurboUNIT melt was not submitted for repay.');
        }
      } else if (!canRepayDirectly) {
        if (canResumePersistedRepay && persistedRedemptionId) {
          logger.debug('[VaultRepayFromUsdc] Resuming existing redemption', {
            currentAccount,
            redemptionId: persistedRedemptionId,
          });
          setPhase('waiting_redemption_release');
          const redemption = await getRedemptionStatus(persistedRedemptionId);
          const released =
            redemption.status === 'released' || redemption.status === 'failed'
              ? redemption
              : await waitForRedemptionRelease(persistedRedemptionId);
          logger.debug('[VaultRepayFromUsdc] Existing redemption release status', {
            currentAccount,
            releaseId: persistedRedemptionId,
            status: released.status,
          });
          if (released.status === 'failed') {
            throw new Error(released.error || 'UNIT release failed');
          }
        } else {
          setPhase('swapping_repay');
          const redemptionExecution = await requestRedemption(
            currentAccount,
            amountInput,
            wallet.taprootAddress,
            'USDC',
            quote.requiredUsdcIn,
            async (submission) => {
              setRedemptionResult(submission.releaseId, submission.burnTxHash);
              await persistVaultSettlementNow();
            }
          );
          logger.debug('[VaultRepayFromUsdc] Redemption execution submitted', {
            currentAccount,
            releaseId: redemptionExecution.releaseId,
            burnTxHash: redemptionExecution.burnTxHash,
            preparationSwapTxHash: redemptionExecution.preparationSwap?.swapTxHash,
          });

          setRedemptionResult(redemptionExecution.releaseId, redemptionExecution.burnTxHash);
          await persistVaultSettlementNow();

          setPhase('waiting_redemption_release');
          const released = await waitForRedemptionRelease(redemptionExecution.releaseId);
          logger.debug('[VaultRepayFromUsdc] Redemption release status', {
            currentAccount,
            releaseId: redemptionExecution.releaseId,
            status: released.status,
          });
          if (released.status === 'failed') {
            throw new Error(released.error || 'UNIT release failed');
          }
        }
      }

      setPhase('repaying_vault');
      useRepayStore.getState().setProcessingStep(requiredMeltTxid ? 3 : 2);
      await waitForSpendableReleasedUnit(repayAmountUsd, requiredMeltTxid);
      logger.debug('[VaultRepayFromUsdc] Released UNIT became spendable', {
        currentAccount,
        repayAmountUsd,
        requiredMeltTxid,
      });

      const loaded = await loadRawRepayVaultData(rawRepay, 'settlement_release');
      if (!loaded) {
        throw new Error('Unable to refresh vault data before repay');
      }
      logger.info('[VaultRepayFromUsdc] Vault data refreshed, executing raw repay', {
        currentAccount,
      });
      let result: Awaited<ReturnType<typeof rawRepay.repay>> = null;
      let lastRawRepayError = 'Vault repay failed';
      const maxRawRepayAttempts = requiredMeltTxid ? RAW_REPAY_MISSING_INPUT_MAX_ATTEMPTS : 1;

      for (let attempt = 1; attempt <= maxRawRepayAttempts; attempt += 1) {
        if (attempt > 1) {
          setPhase('repaying_vault');
          await persistVaultSettlementNow();
        }
        useRepayStore.getState().setCurrentStep('processing');
        useRepayStore.getState().setError(null);
        useRepayStore.getState().setProcessingStep(4);

        if (requiredMeltTxid) {
          setPreferredRepayUnitTxids([requiredMeltTxid]);
        }

        try {
          result = await rawRepay.repay();
        } finally {
          if (requiredMeltTxid) {
            clearPreferredRepayUnitTxids();
          }
        }

        if (result) {
          break;
        }

        lastRawRepayError = getLatestRawRepayError(rawRepay.error);
        if (
          !requiredMeltTxid ||
          !isMissingInputsError(lastRawRepayError) ||
          attempt >= maxRawRepayAttempts
        ) {
          throw new Error(lastRawRepayError);
        }

        logger.info(
          '[VaultRepayFromUsdc] Raw repay rejected with missing inputs; waiting for TurboUNIT release propagation',
          {
            currentAccount,
            attempt,
            maxAttempts: maxRawRepayAttempts,
            requiredMeltTxid,
            retryMs: RAW_REPAY_MISSING_INPUT_RETRY_MS,
          }
        );
        setPhase('waiting_turbo_release');
        useRepayStore.getState().setCurrentStep('processing');
        useRepayStore.getState().setError(null);
        useRepayStore.getState().setProcessingStep(3);
        await persistVaultSettlementNow();
        await waitForRetryDelay(RAW_REPAY_MISSING_INPUT_RETRY_MS);

        try {
          await waitForSpendableReleasedUnit(repayAmountUsd, requiredMeltTxid);
        } catch (releaseError) {
          logger.info('[VaultRepayFromUsdc] Retry release visibility check did not pass yet', {
            currentAccount,
            requiredMeltTxid,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }
      }

      if (!result) {
        throw new Error(lastRawRepayError);
      }

      logger.debug('[VaultRepayFromUsdc] Raw repay completed', {
        currentAccount,
        txid: result.txid,
        vaultTxid: result.vaultTxid,
      });

      completeSettlement(
        requestedPayoutAsset,
        requestedPayoutAsset === 'TURBOUNIT' ? turboSettlementAmount : quote.requiredUsdcIn
      );
      await persistVaultSettlementNow();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to repay';
      const displayMessage = getRepayDisplayError(message);
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        scope: 'useRepayFromUsdcSettlement',
      });
      if (
        activeRequestedPayoutAsset !== 'UNIT' &&
        !message.includes('Not enough spendable UNIT') &&
        !message.includes('Not enough UNIT plus TurboUNIT') &&
        !message.includes('Sepolia USDC repay is not enabled')
      ) {
        markNeedsRetry(displayMessage);
        await persistVaultSettlementNow();
      }
      setError(displayMessage);
      return null;
    } finally {
      setIsSettling(false);
    }
  }, [
    completeSettlement,
    currentAccount,
    getTurboRepayQuote,
    estimatedSepoliaFeeEth,
    estimatedUsdcIn,
    markNeedsRetry,
    persistedCashuMeltQuoteId,
    persistedCashuMeltTxid,
    persistedRequestedPayoutAsset,
    persistedRedemptionId,
    quoteUsdcRepaySettlement,
    rawRepay,
    refreshCashuBalance,
    repayFundingAsset,
    resetSettlement,
    setCashuMeltQuote,
    setCashuMeltTxid,
    setPhase,
    setRedemptionResult,
    startOperation,
    settlementFaceValueUsd,
    settlementKind,
    settlementPhase,
    repayAmountUsd,
    setError,
    waitForSpendableReleasedUnit,
    wallet?.taprootAddress,
  ]);

  const cancel = useCallback(() => {
    resetSettlement();
    rawRepay.cancel();
  }, [rawRepay, resetSettlement]);

  return useMemo(
    () => ({
      ...rawRepay,
      repay,
      cancel,
      quoteRepaySettlement,
      quoteRepayFromUsdc,
      isLoading: rawRepay.isLoading || isSettling,
      error: storeError || rawRepay.error,
    }),
    [rawRepay, repay, cancel, quoteRepaySettlement, quoteRepayFromUsdc, isSettling, storeError]
  );
}
