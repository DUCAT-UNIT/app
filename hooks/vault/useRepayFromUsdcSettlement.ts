import { useCallback, useMemo, useState } from 'react';
import { useBalance, useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
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

export interface UseRepayFromUsdcSettlementResult extends UseRepayVaultResult {
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
  } = store;
  const { wallet, currentAccount } = useWallet();
  const { fetchBalance } = useBalance();
  const { fetchTransactionHistory } = useTransactionHistory();
  const [isSettling, setIsSettling] = useState(false);

  const {
    kind: settlementKind,
    redemptionId: persistedRedemptionId,
    startOperation,
    setPhase,
    setRepayQuote,
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

  const quoteRepayFromUsdc = useCallback(
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
        setRepayQuote('0', '0');
        return {
          requiredUsdcIn: '0',
          estimatedSepoliaFeeEth: '0',
        };
      }

      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (!usdcFeaturesEnabled) {
        setRepayStoreQuote(null, null);
        setRepayQuote(null, null);
        throw new Error('Not enough spendable UNIT to repay this amount.');
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
      setRepayQuote(quote.requiredUsdcIn, quote.estimatedSepoliaFeeEth);

      return quote;
    },
    [currentAccount, hasSpendableDirectUnitBalance, setRepayQuote, setRepayStoreQuote, wallet?.taprootAddress],
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
      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      if (!canRepayDirectly && !usdcFeaturesEnabled) {
        throw new Error('Not enough spendable UNIT to repay this amount.');
      }

      const requestedPayoutAsset = canRepayDirectly ? 'UNIT' : 'USDC';
      startOperation('repay', repayAmountUsd, requestedPayoutAsset);
      logger.debug('[VaultRepayFromUsdc] Starting repay settlement', {
        currentAccount,
        repayAmountUsd,
        requestedPayoutAsset,
        destinationTaprootAddress: wallet.taprootAddress,
      });

      const quote = canRepayDirectly
        ? { requiredUsdcIn: '0', estimatedSepoliaFeeEth: '0' }
        : await quoteRepayFromUsdc(repayAmountUsd);
      const amountInput = formatVaultSettlementAmountInput(repayAmountUsd);
      logger.debug('[VaultRepayFromUsdc] Quote locked for execution', {
        currentAccount,
        repayAmountUsd,
        amountInput,
        requiredUsdcIn: quote.requiredUsdcIn,
        canRepayDirectly,
      });

      if (!canRepayDirectly) {
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

      completeSettlement(requestedPayoutAsset, quote.requiredUsdcIn);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to repay from USDC';
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        scope: 'useRepayFromUsdcSettlement',
      });
      if (!message.includes('Not enough spendable UNIT')) {
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
    hasSpendableDirectUnitBalance,
    markNeedsRetry,
    persistedRedemptionId,
    quoteRepayFromUsdc,
    rawRepay,
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
      quoteRepayFromUsdc,
      isLoading: rawRepay.isLoading || isSettling,
      error: storeError || rawRepay.error,
    }),
    [rawRepay, repay, cancel, quoteRepayFromUsdc, isSettling, storeError],
  );
}
