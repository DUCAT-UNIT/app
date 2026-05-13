const mockClearTurboState = jest.fn();
const mockResetBorrow = jest.fn();
const mockResetDeposit = jest.fn();
const mockResetRepay = jest.fn();
const mockResetWithdraw = jest.fn();
const mockResetVaultSettlement = jest.fn();
const mockResetTokenProcessing = jest.fn();

jest.mock('../secureStorageService', () => ({
  deleteWalletData: jest.fn(),
}));

jest.mock('../../utils/onboardingHelpers', () => ({
  resetOnboardingState: jest.fn(),
}));

jest.mock('../../stores/displayPreferencesStore', () => ({ resetDisplayPreferencesStore: jest.fn() }));
jest.mock('../../stores/liquidationFlowStore', () => ({ resetLiquidationFlowStore: jest.fn() }));
jest.mock('../../stores/notificationStore', () => ({ resetNotificationStore: jest.fn() }));
jest.mock('../../stores/operationJournalStore', () => ({ resetOperationJournalStore: jest.fn() }));
jest.mock('../../stores/pendingTransactionsStore', () => ({ resetPendingTransactionsStore: jest.fn() }));
jest.mock('../../stores/pendingVaultTransactionStore', () => ({ resetPendingVaultTransactionStore: jest.fn() }));
jest.mock('../../stores/priceStore', () => ({ resetPriceStore: jest.fn() }));
jest.mock('../../stores/sendFlowStore', () => ({ resetSendFlowStore: jest.fn() }));
jest.mock('../../stores/swapDiagnosticsStore', () => ({ resetSwapDiagnosticsStore: jest.fn() }));
jest.mock('../../stores/evmTransactionCheckpointStore', () => ({ resetEvmTransactionCheckpointStore: jest.fn() }));
jest.mock('../../stores/vaultCreationStore', () => ({ resetVaultCreationStore: jest.fn() }));
jest.mock('../../stores/borrowStore', () => ({ useBorrowStore: { getState: () => ({ reset: mockResetBorrow }) } }));
jest.mock('../../stores/depositStore', () => ({ useDepositStore: { getState: () => ({ reset: mockResetDeposit }) } }));
jest.mock('../../stores/repayStore', () => ({ useRepayStore: { getState: () => ({ reset: mockResetRepay }) } }));
jest.mock('../../stores/withdrawStore', () => ({ useWithdrawStore: { getState: () => ({ reset: mockResetWithdraw }) } }));
jest.mock('../../stores/vaultSettlementStore', () => ({ useVaultSettlementStore: { getState: () => ({ reset: mockResetVaultSettlement }) } }));
jest.mock('../../stores/tokenProcessingStore', () => ({ useTokenProcessingStore: { getState: () => ({ reset: mockResetTokenProcessing }) } }));
jest.mock('../../stores/turboProcessingStore', () => ({ useTurboProcessingStore: { getState: () => ({ clearState: mockClearTurboState }) } }));

describe('walletResetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTurboState.mockResolvedValue(undefined);
  });

  it('clears runtime diagnostics and Sepolia checkpoint stores during full wallet reset', async () => {
    const { performFullWalletReset } = require('../walletResetService');
    const { deleteWalletData } = require('../secureStorageService');
    const { resetOnboardingState } = require('../../utils/onboardingHelpers');
    const { resetSwapDiagnosticsStore } = require('../../stores/swapDiagnosticsStore');
    const { resetEvmTransactionCheckpointStore } = require('../../stores/evmTransactionCheckpointStore');
    const { resetOperationJournalStore } = require('../../stores/operationJournalStore');
    const resetWallet = jest.fn();
    const resetAuth = jest.fn();
    const setSeedConfirmed = jest.fn();

    await performFullWalletReset({
      clearICloudBackup: true,
      resetWallet,
      resetAuth,
      setSeedConfirmed,
    });

    expect(deleteWalletData).toHaveBeenCalledWith(true, { preservePinAuth: false });
    expect(resetOnboardingState).toHaveBeenCalled();
    expect(resetSwapDiagnosticsStore).toHaveBeenCalled();
    expect(resetEvmTransactionCheckpointStore).toHaveBeenCalled();
    expect(resetOperationJournalStore).toHaveBeenCalled();
    expect(mockResetVaultSettlement).toHaveBeenCalled();
    expect(mockResetTokenProcessing).toHaveBeenCalled();
    expect(mockClearTurboState).toHaveBeenCalled();
    expect(resetWallet).toHaveBeenCalled();
    expect(setSeedConfirmed).toHaveBeenCalledWith(false);
    expect(resetAuth).toHaveBeenCalled();
  });

  it('can preserve PIN auth while replacing wallet data', async () => {
    const { performFullWalletReset } = require('../walletResetService');
    const { deleteWalletData } = require('../secureStorageService');

    await performFullWalletReset({
      preservePinAuth: true,
    });

    expect(deleteWalletData).toHaveBeenCalledWith(false, { preservePinAuth: true });
  });
});
