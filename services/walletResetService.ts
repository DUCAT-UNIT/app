import { deleteWalletData } from './secureStorageService';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { resetDisplayPreferencesStore } from '../stores/displayPreferencesStore';
import { resetLiquidationFlowStore } from '../stores/liquidationFlowStore';
import { resetNotificationStore } from '../stores/notificationStore';
import { resetOperationJournalStore } from '../stores/operationJournalStore';
import { resetPendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { resetPendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { resetPriceStore } from '../stores/priceStore';
import { resetSendFlowStore } from '../stores/sendFlowStore';
import { resetSwapDiagnosticsStore } from '../stores/swapDiagnosticsStore';
import { resetEvmTransactionCheckpointStore } from '../stores/evmTransactionCheckpointStore';
import { useBorrowStore } from '../stores/borrowStore';
import { useDepositStore } from '../stores/depositStore';
import { useRepayStore } from '../stores/repayStore';
import { useTokenProcessingStore } from '../stores/tokenProcessingStore';
import { useTurboProcessingStore } from '../stores/turboProcessingStore';
import { useVaultSettlementStore } from '../stores/vaultSettlementStore';
import { resetVaultCreationStore } from '../stores/vaultCreationStore';
import { useWithdrawStore } from '../stores/withdrawStore';

interface PerformFullWalletResetParams {
  clearICloudBackup?: boolean;
  preservePinAuth?: boolean;
  clearVaultCredentials?: (() => Promise<void> | void) | undefined;
  resetWallet?: (() => Promise<void> | void) | undefined;
  resetAuth?: (() => void) | undefined;
  setSeedConfirmed?: ((value: boolean) => void) | undefined;
}

const resetRuntimeStores = async () => {
  resetNotificationStore();
  resetOperationJournalStore();
  resetDisplayPreferencesStore();
  resetPriceStore();
  resetPendingTransactionsStore();
  resetPendingVaultTransactionStore();
  resetSendFlowStore();
  resetVaultCreationStore();
  resetLiquidationFlowStore();
  resetSwapDiagnosticsStore();
  resetEvmTransactionCheckpointStore();
  useBorrowStore.getState().reset();
  useDepositStore.getState().reset();
  useRepayStore.getState().reset();
  useWithdrawStore.getState().reset();
  useVaultSettlementStore.getState().reset();
  useTokenProcessingStore.getState().reset();
  await useTurboProcessingStore.getState().clearState();
};

export const performFullWalletReset = async ({
  clearICloudBackup = false,
  preservePinAuth = false,
  clearVaultCredentials,
  resetWallet,
  resetAuth,
  setSeedConfirmed,
}: PerformFullWalletResetParams = {}): Promise<void> => {
  await deleteWalletData(clearICloudBackup, { preservePinAuth });
  await resetOnboardingState();

  if (clearVaultCredentials) {
    await clearVaultCredentials();
  }

  if (resetWallet) {
    await Promise.resolve(resetWallet());
  }

  await resetRuntimeStores();

  if (setSeedConfirmed) {
    setSeedConfirmed(false);
  }

  if (resetAuth) {
    resetAuth();
  }
};
