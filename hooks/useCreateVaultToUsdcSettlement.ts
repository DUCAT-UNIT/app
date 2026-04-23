import { useCallback, useMemo } from 'react';
import { useCreateVault, type CreateVaultParams, type UseCreateVaultResult } from './useCreateVault';
import { useVaultCreation, useVaultCreationStore } from '../stores/vaultCreationStore';
import { useVaultSettlementStore } from '../stores/vaultSettlementStore';
import { useIssuedUnitSettlement } from './vault/useIssuedUnitSettlement';

export interface UseCreateVaultToUsdcSettlementResult extends UseCreateVaultResult {
  quoteBorrowToUsdc: (amountUsd: number) => Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }>;
  createVault: (params?: CreateVaultParams) => Promise<string | null>;
}

export function useCreateVaultToUsdcSettlement(): UseCreateVaultToUsdcSettlementResult {
  const rawCreateVault = useCreateVault({ deferSuccessTransition: true });
  const { borrowAmountUsd, setCurrentStep } = useVaultCreation();
  const { startOperation, setPhase, setIssueResult, reset: resetSettlement } = useVaultSettlementStore();
  const { quoteBorrowToUsdc, settleIssuedUnitToUsdc } = useIssuedUnitSettlement();

  const createVault = useCallback(
    async (params?: CreateVaultParams) => {
      startOperation('open', borrowAmountUsd);
      setPhase('issuing_vault');

      const issueTxid = await rawCreateVault.createVault(params);
      if (!issueTxid) {
        return null;
      }

      const latestVaultCreationState = useVaultCreationStore.getState();
      setIssueResult(issueTxid, latestVaultCreationState.vaultTxid);
      await settleIssuedUnitToUsdc('open', borrowAmountUsd);
      setCurrentStep('success');

      return issueTxid;
    },
    [
      startOperation,
      borrowAmountUsd,
      setPhase,
      rawCreateVault,
      setIssueResult,
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
