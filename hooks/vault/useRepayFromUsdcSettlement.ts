import { useCallback, useMemo, useState } from 'react';
import { useCashuOperations } from '../../contexts/CashuContext';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { getBalance as getCashuBalance } from '../../services/cashu/cashuBalanceService';
import { requestMelt, completeMelt, type MeltQuoteResult } from '../../services/cashu/cashuWalletService';
import { requestRedemption } from '../../services/evmBridgeService';
import { getRedemptionStatus } from '../../services/bridgeApiService';
import { getBoolean, SettingKeys } from '../../services/settingsService';
import { createVaultWallet } from '../../services/vaultWalletService';
import { VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { useRepay } from '../../stores/repayStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import {
  formatVaultSettlementAmountInput,
  quoteVaultRepaySettlement,
  waitForRedemptionRelease,
} from '../../services/vaultSettlementService';
import { useRepayVault, type UseRepayVaultResult } from './useRepayVault';

const RELEASED_UNIT_RETRY_MS = 5_000;
const RELEASED_UNIT_TIMEOUT_MS = 180_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?: () => void }).unref?.();
  });
}

function formatSmallestUnitAmount(amount: number): string {
  return formatVaultSettlementAmountInput(amount / 100);
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
    redemptionId: persistedRedemptionId,
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
      if (!wallet?.segwitAddress || !wallet?.segwitPubkey || !wallet?.taprootAddress || !wallet?.taprootPubkey) {
        throw new Error('Wallet not connected');
      }

      const vaultWallet = await createVaultWallet({
        segwitAddress: wallet.segwitAddress,
        segwitPubkey: wallet.segwitPubkey,
        taprootAddress: wallet.taprootAddress,
        taprootPubkey: wallet.taprootPubkey,
      });

      const requiredAmount = Math.round(amountUsd * 100);
      const unitUtxos = await vaultWallet.fetch.rune_utxos(
        VAULT_CONFIG.RUNE_LABEL,
        requiredAmount,
      );

      return Boolean(unitUtxos && unitUtxos.length > 0);
    },
    [
      wallet?.segwitAddress,
      wallet?.segwitPubkey,
      wallet?.taprootAddress,
      wallet?.taprootPubkey,
    ],
  );

  const getTurboRepayQuote = useCallback(
    async (amountUsd: number): Promise<MeltQuoteResult | null> => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      const requiredAmount = Math.round(amountUsd * 100);
      const cashuBalance = await getCashuBalance();
      if (cashuBalance < requiredAmount) {
        return null;
      }

      const quote = await requestMelt(wallet.taprootAddress, requiredAmount);
      if (cashuBalance < quote.total) {
        return null;
      }

      return quote;
    },
    [wallet?.taprootAddress],
  );

  const quoteRepaySettlement = useCallback(
    async (amountUsd: number) => {
      if (!wallet?.taprootAddress) {
        throw new Error('Wallet not connected');
      }

      const canRepayDirectly = await hasSpendableDirectUnitBalance(amountUsd);
      if (canRepayDirectly) {
        logger.debug('[VaultRepayFromUsdc] Direct UNIT funding available, skipping Sepolia quote', {
          currentAccount,
          amountUsd,
        });
        setRepayStoreQuote('0', '0');
        setTurboRepayQuote('0', '0');
        setRepayQuote('0', '0');
        return {
          fundingAsset: 'UNIT' as const,
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
          requiredTurboUnitIn: '0',
          estimatedTurboUnitFee: '0',
        };
      }

      const turboQuote = await getTurboRepayQuote(amountUsd);
      if (turboQuote) {
        const requiredTurboUnitIn = formatSmallestUnitAmount(turboQuote.total);
        const estimatedTurboUnitFee = formatSmallestUnitAmount(turboQuote.fee);
        logger.debug('[VaultRepayFromUsdc] TurboUNIT funding available, using Cashu melt quote', {
          currentAccount,
          amountUsd,
          quoteId: turboQuote.quoteId,
          total: turboQuote.total,
          fee: turboQuote.fee,
        });
        setRepayStoreQuote('0', '0');
        setTurboRepayQuote(requiredTurboUnitIn, estimatedTurboUnitFee);
        setRepayQuote('0', '0');
        return {
          fundingAsset: 'TURBOUNIT' as const,
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
          requiredTurboUnitIn,
          estimatedTurboUnitFee,
        };
      }

      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (!usdcFeaturesEnabled) {
        setRepayStoreQuote(null, null);
        setTurboRepayQuote(null, null);
        setRepayQuote(null, null);
        throw new Error('Not enough spendable UNIT or TurboUNIT to repay this amount.');
      }

      logger.debug('[VaultRepayFromUsdc] Quoting repay', {
        currentAccount,
        amountUsd,
        destinationTaprootAddress: wallet.taprootAddress,
      });
      const quote = await quoteVaultRepaySettlement(
        currentAccount,
        amountUsd,
        wallet.taprootAddress,
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
      getTurboRepayQuote,
      hasSpendableDirectUnitBalance,
      setRepayQuote,
      setRepayStoreQuote,
      setTurboRepayQuote,
      wallet?.taprootAddress,
    ],
  );

  const quoteRepayFromUsdc = useCallback(
    async (amountUsd: number) => {
      const quote = await quoteRepaySettlement(amountUsd);
      return {
        requiredUsdcIn: quote.requiredUsdcIn,
        estimatedSepoliaFeeEth: quote.estimatedSepoliaFeeEth,
      };
    },
    [quoteRepaySettlement],
  );

  const waitForSpendableReleasedUnit = useCallback(
    async (amountUsd: number) => {
      if (!wallet?.segwitAddress || !wallet?.segwitPubkey || !wallet?.taprootAddress || !wallet?.taprootPubkey) {
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
            requiredAmount,
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
    ],
  );

  const repay = useCallback(async () => {
    if (!wallet?.taprootAddress) {
      setError('Wallet not connected');
      return null;
    }

    setIsSettling(true);
    setError(null);

    try {
      const canRepayDirectly = await hasSpendableDirectUnitBalance(repayAmountUsd);
      const turboQuote = canRepayDirectly ? null : await getTurboRepayQuote(repayAmountUsd);
      const canRepayWithTurboUnit = !!turboQuote || (
        settlementKind === 'repay' &&
        !!persistedCashuMeltTxid
      );
      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (!canRepayDirectly && !canRepayWithTurboUnit && !usdcFeaturesEnabled) {
        throw new Error('Not enough spendable UNIT or TurboUNIT to repay this amount.');
      }

      const requestedPayoutAsset = canRepayDirectly
        ? 'UNIT'
        : canRepayWithTurboUnit
          ? 'TURBOUNIT'
          : 'USDC';
      startOperation('repay', repayAmountUsd, requestedPayoutAsset);
      logger.debug('[VaultRepayFromUsdc] Starting repay settlement', {
        currentAccount,
        repayAmountUsd,
        requestedPayoutAsset,
        destinationTaprootAddress: wallet.taprootAddress,
      });

      const quote = requestedPayoutAsset === 'USDC'
        ? await quoteRepaySettlement(repayAmountUsd)
        : {
          fundingAsset: requestedPayoutAsset,
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
          requiredTurboUnitIn: turboQuote ? formatSmallestUnitAmount(turboQuote.total) : '0',
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
        if (settlementKind === 'repay' && persistedCashuMeltTxid) {
          logger.debug('[VaultRepayFromUsdc] Resuming existing TurboUNIT melt', {
            currentAccount,
            cashuMeltTxid: persistedCashuMeltTxid,
          });
        } else {
          setPhase('melting_turbo_repay');
          const activeTurboQuote = turboQuote ?? await getTurboRepayQuote(repayAmountUsd);
          if (!activeTurboQuote) {
            throw new Error('Not enough TurboUNIT to repay this amount.');
          }
          const quoteId = activeTurboQuote.quoteId;
          const quoteTotal = activeTurboQuote.total;
          setCashuMeltQuote(quoteId);
          const meltResult = await completeMelt(quoteId, quoteTotal);
          setCashuMeltTxid(meltResult.txid);
          await refreshCashuBalance().catch(() => undefined);
          logger.debug('[VaultRepayFromUsdc] TurboUNIT melt submitted', {
            currentAccount,
            quoteId,
            txid: meltResult.txid,
          });
        }

        setPhase('waiting_turbo_release');
      } else if (!canRepayDirectly) {
        if (settlementKind === 'repay' && persistedRedemptionId) {
          logger.debug('[VaultRepayFromUsdc] Resuming existing redemption', {
            currentAccount,
            redemptionId: persistedRedemptionId,
          });
          setPhase('waiting_redemption_release');
          const redemption = await getRedemptionStatus(persistedRedemptionId);
          const released = redemption.status === 'released' || redemption.status === 'failed'
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
          );
          logger.debug('[VaultRepayFromUsdc] Redemption execution submitted', {
            currentAccount,
            releaseId: redemptionExecution.releaseId,
            burnTxHash: redemptionExecution.burnTxHash,
            preparationSwapTxHash: redemptionExecution.preparationSwap?.swapTxHash,
          });

          setRedemptionResult(redemptionExecution.releaseId, redemptionExecution.burnTxHash);

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
        requestedPayoutAsset === 'TURBOUNIT' ? quote.requiredTurboUnitIn : quote.requiredUsdcIn,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to repay';
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        scope: 'useRepayFromUsdcSettlement',
      });
      if (!message.includes('Not enough spendable UNIT') && !message.includes('Not enough TurboUNIT')) {
        markNeedsRetry(message);
      }
      setError(message);
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
    persistedCashuMeltTxid,
    persistedRedemptionId,
    quoteRepaySettlement,
    rawRepay,
    refreshCashuBalance,
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
    [rawRepay, repay, cancel, quoteRepaySettlement, quoteRepayFromUsdc, isSettling, storeError],
  );
}
