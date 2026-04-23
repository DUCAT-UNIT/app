import { useCallback, useMemo } from 'react';
import { useBorrow } from '../../stores/borrowStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { useBorrowVault, type UseBorrowVaultResult } from './useBorrowVault';
import { useIssuedUnitSettlement } from './useIssuedUnitSettlement';

export interface UseBorrowToUsdcSettlementResult extends UseBorrowVaultResult {
  quoteBorrowToUsdc: (amountUsd: number) => Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }>;
}

export function useBorrowToUsdcSettlement(): UseBorrowToUsdcSettlementResult {
  const store = useBorrow();
  const rawBorrow = useBorrowVault({ deferSuccessTransition: true });
  const { startOperation, setPhase, setIssueResult, reset: resetSettlement } = useVaultSettlementStore();
  const { quoteBorrowToUsdc, settleIssuedUnitToUsdc } = useIssuedUnitSettlement();

  const borrow = useCallback(async () => {
    startOperation('borrow', store.borrowAmountUsd);
    setPhase('issuing_vault');

    const result = await rawBorrow.borrow();
    if (!result) {
      return null;
    }

    setIssueResult(result.txid, result.vaultTxid);
    await settleIssuedUnitToUsdc('borrow', store.borrowAmountUsd);
    store.setCurrentStep('success');

    return result;
  }, [
    startOperation,
    store,
    setPhase,
    rawBorrow,
    setIssueResult,
    settleIssuedUnitToUsdc,
  ]);

  const cancel = useCallback(() => {
    resetSettlement();
    rawBorrow.cancel();
  }, [resetSettlement, rawBorrow]);

  return useMemo(
    () => ({
      ...rawBorrow,
      borrow,
      cancel,
      quoteBorrowToUsdc,
    }),
    [rawBorrow, borrow, cancel, quoteBorrowToUsdc],
  );
}
