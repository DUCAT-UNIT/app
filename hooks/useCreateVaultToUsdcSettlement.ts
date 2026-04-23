import { useCallback, useMemo } from 'react';
import { useCreateVault, type CreateVaultParams, type UseCreateVaultResult } from './useCreateVault';
import { useVaultCreation, useVaultCreationStore } from '../stores/vaultCreationStore';
import { useVaultSettlementStore } from '../stores/vaultSettlementStore';
import { useIssuedUnitSettlement } from './vault/useIssuedUnitSettlement';
import { formatVaultSettlementAmountInput } from '../services/vaultSettlementService';

export interface UseCreateVaultToUsdcSettlementResult extends UseCreateVaultResult {
  quoteBorrowToUsdc: (amountUsd: number) => Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }>;
  createVault: (params?: CreateVaultParams) => Promise<string | null>;
}

export function useCreateVaultToUsdcSettlement(): UseCreateVaultToUsdcSettlementResult {
  const rawCreateVault = useCreateVault({ deferSuccessTransition: true });
  const { borrowAmountUsd, receiveAsset, setCurrentStep } = useVaultCreation();
  const {
    startOperation,
    setPhase,
    setIssueResult,
    completeSettlement,
    reset: resetSettlement,
  } = useVaultSettlementStore();
  const { quoteBorrowToUsdc, settleIssuedUnitToUsdc } = useIssuedUnitSettlement();

  const createVault = useCallback(
    async (params?: CreateVaultParams) => {
      startOperation('open', borrowAmountUsd, receiveAsset);
      setPhase('issuing_vault');

      const issueTxid = await rawCreateVault.createVault(params);
      if (!issueTxid) {
        return null;
      }

      const latestVaultCreationState = useVaultCreationStore.getState();
      setIssueResult(issueTxid, latestVaultCreationState.vaultTxid);
      if (receiveAsset === 'UNIT') {
        completeSettlement('UNIT', formatVaultSettlementAmountInput(borrowAmountUsd));
      } else {
        await settleIssuedUnitToUsdc('open', borrowAmountUsd);
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
      settleIssuedUnitToUsdc,
      setCurrentStep,
    ],
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
    [rawCreateVault, createVault, cancel, quoteBorrowToUsdc],
  );
}
