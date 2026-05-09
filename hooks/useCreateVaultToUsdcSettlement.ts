import { useCallback, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import {
  useCreateVault,
  type CreateVaultParams,
  type UseCreateVaultResult,
} from './useCreateVault';
import { useVaultCreation, useVaultCreationStore } from '../stores/vaultCreationStore';
import {
  persistVaultSettlementNow,
  resolveVaultSettlementRequestedAsset,
  useVaultSettlementStore,
} from '../stores/vaultSettlementStore';
import { useIssuedUnitSettlement } from './vault/useIssuedUnitSettlement';
import { formatVaultSettlementAmountInput } from '../services/vaultSettlementService';
import { getBoolean, SettingKeys } from '../services/settingsService';

export interface UseCreateVaultToUsdcSettlementResult extends UseCreateVaultResult {
  quoteBorrowToUsdc: (
    amountUsd: number
  ) => Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }>;
  createVault: (params?: CreateVaultParams) => Promise<string | null>;
}

export function useCreateVaultToUsdcSettlement(): UseCreateVaultToUsdcSettlementResult {
  const rawCreateVault = useCreateVault({ deferSuccessTransition: true });
  const { wallet, currentAccount } = useWallet();
  const { borrowAmountUsd, receiveAsset, setCurrentStep } = useVaultCreation();
  const {
    startOperation,
    setPhase,
    setIssueResult,
    completeSettlement,
    reset: resetSettlement,
  } = useVaultSettlementStore();
  const { quoteBorrowToUsdc, settleIssuedUnitToUsdc, settleIssuedUnitToTurboUnit } =
    useIssuedUnitSettlement();

  const createVault = useCallback(
    async (params?: CreateVaultParams) => {
      const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
      const requestedReceiveAsset = resolveVaultSettlementRequestedAsset(
        receiveAsset,
        usdcFeaturesEnabled
      );

      startOperation('open', borrowAmountUsd, requestedReceiveAsset, {
        accountIndex: currentAccount,
        taprootAddress: wallet?.taprootAddress ?? null,
      });
      setPhase('issuing_vault');
      await persistVaultSettlementNow();

      let issueTxid: string | null;
      try {
        issueTxid = await rawCreateVault.createVault(params);
      } catch (error) {
        resetSettlement();
        await persistVaultSettlementNow();
        throw error;
      }

      if (!issueTxid) {
        resetSettlement();
        await persistVaultSettlementNow();
        return null;
      }

      const latestVaultCreationState = useVaultCreationStore.getState();
      setIssueResult(issueTxid, latestVaultCreationState.vaultTxid);
      await persistVaultSettlementNow();
      if (requestedReceiveAsset === 'UNIT') {
        completeSettlement('UNIT', formatVaultSettlementAmountInput(borrowAmountUsd));
        await persistVaultSettlementNow();
      } else if (requestedReceiveAsset === 'USDC') {
        const settlement = await settleIssuedUnitToUsdc('open', borrowAmountUsd);
        const canComplete =
          settlement.status === 'settled' ||
          (settlement.status === 'pending_settlement' && !!settlement.bridgeSendTxid);
        if (!canComplete) {
          return issueTxid;
        }
      } else {
        const settlement = await settleIssuedUnitToTurboUnit('open', borrowAmountUsd);
        const canComplete =
          settlement.status === 'settled' ||
          (settlement.status === 'pending_settlement' && !!settlement.cashuMintSendTxid);
        if (!canComplete) {
          return issueTxid;
        }
      }
      setCurrentStep('success');

      return issueTxid;
    },
    [
      startOperation,
      borrowAmountUsd,
      receiveAsset,
      setPhase,
      rawCreateVault,
      setIssueResult,
      completeSettlement,
      resetSettlement,
      settleIssuedUnitToUsdc,
      settleIssuedUnitToTurboUnit,
      setCurrentStep,
      currentAccount,
      wallet?.taprootAddress,
    ]
  );

  const cancel = useCallback(() => {
    resetSettlement();
    rawCreateVault.cancel();
  }, [resetSettlement, rawCreateVault]);

  return useMemo(
    () => ({
      ...rawCreateVault,
      createVault,
      cancel,
      quoteBorrowToUsdc,
    }),
    [rawCreateVault, createVault, cancel, quoteBorrowToUsdc]
  );
}
