import { useCallback, useMemo } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useBorrow } from '../../stores/borrowStore';
import {
  persistVaultSettlementNow,
  resolveVaultSettlementRequestedAsset,
  useVaultSettlementStore,
} from '../../stores/vaultSettlementStore';
import { useBorrowVault, type UseBorrowVaultResult } from './useBorrowVault';
import { useIssuedUnitSettlement } from './useIssuedUnitSettlement';
import { formatVaultSettlementAmountInput } from '../../services/vaultSettlementService';
import { getBoolean, SettingKeys } from '../../services/settingsService';

export interface UseBorrowToUsdcSettlementResult extends UseBorrowVaultResult {
  quoteBorrowToUsdc: (
    amountUsd: number
  ) => Promise<{ estimatedUsdcOut: string; minimumUsdcOut: string }>;
}

export function useBorrowToUsdcSettlement(): UseBorrowToUsdcSettlementResult {
  const store = useBorrow();
  const { wallet, currentAccount } = useWallet();
  const rawBorrow = useBorrowVault({ deferSuccessTransition: true });
  const {
    startOperation,
    setPhase,
    setIssueResult,
    completeSettlement,
    reset: resetSettlement,
  } = useVaultSettlementStore();
  const { quoteBorrowToUsdc, settleIssuedUnitToUsdc, settleIssuedUnitToTurboUnit } =
    useIssuedUnitSettlement();

  const borrow = useCallback(async () => {
    const usdcFeaturesEnabled = await getBoolean(SettingKeys.USDC_FEATURES_ENABLED, false);
    const requestedReceiveAsset = resolveVaultSettlementRequestedAsset(
      store.receiveAsset,
      usdcFeaturesEnabled
    );

    startOperation('borrow', store.borrowAmountUsd, requestedReceiveAsset, {
      accountIndex: currentAccount,
      taprootAddress: wallet?.taprootAddress ?? null,
    });
    setPhase('issuing_vault');
    await persistVaultSettlementNow();

    const result = await rawBorrow.borrow();
    if (!result) {
      return null;
    }

    setIssueResult(result.txid, result.vaultTxid);
    await persistVaultSettlementNow();
    if (requestedReceiveAsset === 'UNIT') {
      completeSettlement('UNIT', formatVaultSettlementAmountInput(store.borrowAmountUsd));
      await persistVaultSettlementNow();
    } else if (requestedReceiveAsset === 'USDC') {
      const settlement = await settleIssuedUnitToUsdc('borrow', store.borrowAmountUsd);
      const canComplete =
        settlement.status === 'settled' ||
        (settlement.status === 'pending_settlement' && !!settlement.bridgeSendTxid);
      if (!canComplete) {
        return result;
      }
    } else {
      const settlement = await settleIssuedUnitToTurboUnit('borrow', store.borrowAmountUsd);
      const canComplete =
        settlement.status === 'settled' ||
        (settlement.status === 'pending_settlement' && !!settlement.cashuMintSendTxid);
      if (!canComplete) {
        return result;
      }
    }
    store.setCurrentStep('success');

    return result;
  }, [
    startOperation,
    store,
    setPhase,
    rawBorrow,
    setIssueResult,
    completeSettlement,
    settleIssuedUnitToUsdc,
    settleIssuedUnitToTurboUnit,
    currentAccount,
    wallet?.taprootAddress,
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
    [rawBorrow, borrow, cancel, quoteBorrowToUsdc]
  );
}
