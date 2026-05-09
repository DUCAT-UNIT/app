import { useCallback, useMemo, useState } from 'react';
import { useCashuOperations } from '../../contexts/CashuContext';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { getBalance as getCashuBalance } from '../../services/cashu/cashuBalanceService';
import {
  checkMeltQuote,
  type MeltQuote,
} from '../../services/cashu/cashuMintClient';
import {
  requestMelt,
  completeMelt,
  type MeltQuoteResult,
} from '../../services/cashu/cashuWalletService';
import { requestRedemption } from '../../services/evmBridgeService';
import { getRedemptionStatus } from '../../services/bridgeApiService';
import { getBoolean, SettingKeys } from '../../services/settingsService';
import { createVaultWallet } from '../../services/vaultWalletService';
import { VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { useRepay } from '../../stores/repayStore';
import {
  persistVaultSettlementNow,
  useVaultSettlementStore,
} from '../../stores/vaultSettlementStore';
import {
  formatVaultSettlementAmountInput,
  quoteVaultRepaySettlement,
  waitForRedemptionRelease,
} from '../../services/vaultSettlementService';
import { useRepayVault, type UseRepayVaultResult } from './useRepayVault';

const RELEASED_UNIT_RETRY_MS = 5_000;
const RELEASED_UNIT_TIMEOUT_MS = 180_000;
const CASHU_MINT_WITHDRAWAL_FAILURE = 'Withdrawal failed - your ecash tokens remain valid';
const TURBOUNIT_MINT_WITHDRAWAL_FAILURE_MESSAGE =
  'The TurboUNIT mint could not broadcast the UNIT withdrawal. Your TurboUNIT remains in your wallet. Try a smaller amount or try again later.';
const ACCEPTED_MELT_STATES = new Set(['PAID', 'PENDING']);

type RecoverableMeltQuote = MeltQuote & {
  txid?: string | null;
  outpoint?: string | null;
  payment_preimage?: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
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

function isAcceptedMeltQuote(quote: Pick<MeltQuote, 'paid' | 'state'>): boolean {
  return (
    quote.paid === true ||
    (typeof quote.state === 'string' && ACCEPTED_MELT_STATES.has(quote.state.toUpperCase()))
  );
}

function getRecoverableMeltTxid(quote: RecoverableMeltQuote, fallbackQuoteId: string): string {
  if (quote.txid) return quote.txid;
  if (quote.outpoint) return quote.outpoint.split(':')[0] || quote.outpoint;
  return quote.payment_preimage || quote.quote || fallbackQuoteId;
}

function getRecoverableMeltTotal(quote: MeltQuote): number | null {
  const amount = quote.amount ?? 0;
  const fee = quote.fee ?? quote.fee_reserve ?? 0;
  const total = amount + fee;
  return total > 0 ? total : null;
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
    availableDirectUnitBalance,
    error: storeError,
    setError,
    setRepayQuote: setRepayStoreQuote,
    setTurboRepayQuote,
  } = store;
  const { wallet, currentAccount } = useWallet();
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { refresh: refreshCashuBalance } = useCashuOperations();
  const [isSettling, setIsSettling] = useState(false);

  const {
    kind: settlementKind,
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

  const getRequiredTurboMeltAmount = useCallback(
    (amountUsd: number): number => {
      const requiredAmount = Math.round(amountUsd * 100);
      const availableDirectUnitAmount = Math.max(
        0,
        Math.round((availableDirectUnitBalance || 0) * 100)
      );
      return Math.max(0, requiredAmount - availableDirectUnitAmount);
    },
    [availableDirectUnitBalance]
  );

  const getTurboRepayQuote = useCallback(
    async (amountUsd: number): Promise<TurboRepayQuote | null> => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      const meltAmount = getRequiredTurboMeltAmount(amountUsd);
      if (meltAmount <= 0) {
        return {
          meltAmount: 0,
          quote: null,
          total: 0,
          fee: 0,
        };
      }

      const cashuBalance = await getCashuBalance();
      if (cashuBalance < meltAmount) {
        return null;
      }

      const quote = await requestMelt(wallet.taprootAddress, meltAmount);
      if (cashuBalance < quote.total) {
        return null;
      }

      return {
        meltAmount,
        quote,
        total: quote.total,
        fee: quote.fee,
      };
    },
    [getRequiredTurboMeltAmount, wallet?.taprootAddress]
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
      const quote = await quoteVaultRepaySettlement(
        currentAccount,
        amountUsd,
        wallet.taprootAddress
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
        const turboQuote = await getTurboRepayQuote(amountUsd);
        if (!turboQuote) {
          setRepayStoreQuote(null, null);
          setTurboRepayQuote(null, null);
          setRepayQuote(null, null);
          setError('Not enough UNIT plus TurboUNIT to repay this amount.');
          throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
        }

        const requiredTurboUnitIn = formatSmallestUnitAmount(turboQuote.total);
        const estimatedTurboUnitFee = formatSmallestUnitAmount(turboQuote.fee);
        logger.debug('[VaultRepayFromUsdc] TurboUNIT funding selected, using Cashu melt quote', {
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
      const deadline = Date.now() + RELEASED_UNIT_TIMEOUT_MS;
      let lastError: unknown = null;

      while (Date.now() < deadline) {
        try {
          await fetchBalance().catch(() => undefined);
          await fetchTransactionHistory().catch(() => undefined);

          const unitUtxos = await vaultWallet.fetch.rune_utxos(
            VAULT_CONFIG.RUNE_LABEL,
            requiredAmount
          );

          if (unitUtxos && unitUtxos.length > 0) {
            return;
          }
        } catch (error) {
          lastError = error;
        }

        await delay(RELEASED_UNIT_RETRY_MS);
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Released UNIT is not yet spendable for repay');
    },
    [
      fetchBalance,
      fetchTransactionHistory,
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

    setIsSettling(true);
    setError(null);

    try {
      const hasPersistedTurboMelt =
        settlementKind === 'repay' && (!!persistedCashuMeltTxid || !!persistedCashuMeltQuoteId);
      const requestedPayoutAsset =
        settlementKind === 'repay' && (hasPersistedTurboMelt || persistedRedemptionId)
          ? persistedRequestedPayoutAsset
          : repayFundingAsset;
      const canRepayDirectly =
        requestedPayoutAsset === 'UNIT'
          ? await hasSpendableDirectUnitBalance(repayAmountUsd)
          : false;
      const turboQuote =
        requestedPayoutAsset === 'TURBOUNIT' && !hasPersistedTurboMelt
          ? await getTurboRepayQuote(repayAmountUsd)
          : null;
      const canRepayWithTurboUnit =
        requestedPayoutAsset === 'TURBOUNIT' && (!!turboQuote || hasPersistedTurboMelt);
      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (requestedPayoutAsset === 'UNIT' && !canRepayDirectly) {
        throw new Error('Not enough spendable UNIT to repay this amount.');
      }
      if (requestedPayoutAsset === 'TURBOUNIT' && !canRepayWithTurboUnit) {
        throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
      }
      if (requestedPayoutAsset === 'USDC' && !usdcFeaturesEnabled) {
        throw new Error('Sepolia USDC repay is not enabled.');
      }

      startOperation('repay', repayAmountUsd, requestedPayoutAsset, {
        accountIndex: currentAccount,
        taprootAddress: wallet.taprootAddress,
      });
      await persistVaultSettlementNow();
      logger.debug('[VaultRepayFromUsdc] Starting repay settlement', {
        currentAccount,
        repayAmountUsd,
        requestedPayoutAsset,
        destinationTaprootAddress: wallet.taprootAddress,
      });

      let turboSettlementAmount = turboQuote ? formatSmallestUnitAmount(turboQuote.total) : '0';
      const quote =
        requestedPayoutAsset === 'USDC'
          ? await quoteUsdcRepaySettlement(repayAmountUsd)
          : {
              fundingAsset: requestedPayoutAsset,
              requiredUsdcIn: '0',
              estimatedSepoliaFeeEth: '0',
              requiredTurboUnitIn: turboSettlementAmount,
              estimatedTurboUnitFee: turboQuote ? formatSmallestUnitAmount(turboQuote.fee) : '0',
            };
      const amountInput = formatVaultSettlementAmountInput(repayAmountUsd);
      logger.debug('[VaultRepayFromUsdc] Quote locked for execution', {
        currentAccount,
        repayAmountUsd,
        amountInput,
        requiredUsdcIn: quote.requiredUsdcIn,
        requiredTurboUnitIn: quote.requiredTurboUnitIn,
        canRepayDirectly,
      });

      if (requestedPayoutAsset === 'TURBOUNIT') {
        let hasSubmittedTurboMelt = false;

        if (settlementKind === 'repay' && persistedCashuMeltTxid) {
          hasSubmittedTurboMelt = true;
          logger.debug('[VaultRepayFromUsdc] Resuming existing TurboUNIT melt', {
            currentAccount,
            cashuMeltTxid: persistedCashuMeltTxid,
          });
        } else if (settlementKind === 'repay' && persistedCashuMeltQuoteId) {
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

          if (isAcceptedMeltQuote(persistedMeltQuote)) {
            const recoveredTxid = getRecoverableMeltTxid(
              persistedMeltQuote,
              persistedCashuMeltQuoteId
            );
            const recoveredTotal = getRecoverableMeltTotal(persistedMeltQuote);
            if (recoveredTotal !== null) {
              turboSettlementAmount = formatSmallestUnitAmount(recoveredTotal);
            }
            setCashuMeltTxid(recoveredTxid);
            await persistVaultSettlementNow();
            await refreshCashuBalance().catch(() => undefined);
            hasSubmittedTurboMelt = true;
            logger.debug('[VaultRepayFromUsdc] Recovered accepted TurboUNIT melt quote', {
              currentAccount,
              quoteId: persistedCashuMeltQuoteId,
              txid: recoveredTxid,
              state: persistedMeltQuote.state,
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
          const activeTurboQuote = turboQuote ?? (await getTurboRepayQuote(repayAmountUsd));
          if (!activeTurboQuote) {
            throw new Error('Not enough UNIT plus TurboUNIT to repay this amount.');
          }
          if (activeTurboQuote.quote && activeTurboQuote.meltAmount > 0) {
            setPhase('melting_turbo_repay');
            const quoteId = activeTurboQuote.quote.quoteId;
            const quoteTotal = activeTurboQuote.quote.total;
            turboSettlementAmount = formatSmallestUnitAmount(quoteTotal);
            setCashuMeltQuote(quoteId);
            await persistVaultSettlementNow();
            const meltResult = await completeMelt(quoteId, quoteTotal);
            setCashuMeltTxid(meltResult.txid);
            await persistVaultSettlementNow();
            await refreshCashuBalance().catch(() => undefined);
            hasSubmittedTurboMelt = true;
            logger.debug('[VaultRepayFromUsdc] TurboUNIT melt submitted', {
              currentAccount,
              quoteId,
              txid: meltResult.txid,
              meltAmount: activeTurboQuote.meltAmount,
            });
          }
        }

        if (hasSubmittedTurboMelt) {
          setPhase('waiting_turbo_release');
        }
      } else if (!canRepayDirectly) {
        if (settlementKind === 'repay' && persistedRedemptionId) {
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
            quote.requiredUsdcIn
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
      await waitForSpendableReleasedUnit(repayAmountUsd);
      logger.debug('[VaultRepayFromUsdc] Released UNIT became spendable', {
        currentAccount,
        repayAmountUsd,
      });

      const loaded = await rawRepay.loadVaultData();
      if (!loaded) {
        throw new Error('Unable to refresh vault data before repay');
      }
      logger.debug('[VaultRepayFromUsdc] Vault data refreshed, executing raw repay', {
        currentAccount,
      });

      const result = await rawRepay.repay();
      if (!result) {
        throw new Error(rawRepay.error || 'Vault repay failed');
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
    hasSpendableDirectUnitBalance,
    markNeedsRetry,
    persistedCashuMeltQuoteId,
    persistedCashuMeltTxid,
    persistedRequestedPayoutAsset,
    persistedRedemptionId,
    quoteRepaySettlement,
    quoteUsdcRepaySettlement,
    rawRepay,
    refreshCashuBalance,
    repayFundingAsset,
    setCashuMeltQuote,
    setCashuMeltTxid,
    setPhase,
    setRedemptionResult,
    startOperation,
    settlementKind,
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
