import { act, renderHook } from '@testing-library/react-native';
import { useBorrow } from '../../../stores/borrowStore';
import { useVaultSettlementStore } from '../../../stores/vaultSettlementStore';
import { formatVaultSettlementAmountInput } from '../../../services/vaultSettlementService';
import { useBorrowVault } from '../useBorrowVault';
import { useIssuedUnitSettlement } from '../useIssuedUnitSettlement';
import { useBorrowToUsdcSettlement } from '../useBorrowToUsdcSettlement';

jest.mock('../../../stores/borrowStore', () => ({
  useBorrow: jest.fn(),
}));

jest.mock('../../../stores/vaultSettlementStore', () => ({
  useVaultSettlementStore: jest.fn(),
}));

jest.mock('../../../services/vaultSettlementService', () => ({
  formatVaultSettlementAmountInput: jest.fn((amount: number) => `${amount.toFixed(2)}-formatted`),
}));

jest.mock('../useBorrowVault', () => ({
  useBorrowVault: jest.fn(),
}));

jest.mock('../useIssuedUnitSettlement', () => ({
  useIssuedUnitSettlement: jest.fn(),
}));

const mockBorrow = jest.fn();
const mockRawCancel = jest.fn();
const mockSetCurrentStep = jest.fn();
const mockStartOperation = jest.fn();
const mockSetPhase = jest.fn();
const mockSetIssueResult = jest.fn();
const mockCompleteSettlement = jest.fn();
const mockResetSettlement = jest.fn();
const mockQuoteBorrowToUsdc = jest.fn();
const mockSettleIssuedUnitToUsdc = jest.fn();
const mockGetBoolean = jest.fn();

jest.mock('../../../services/settingsService', () => ({
  getBoolean: (...args: unknown[]) => mockGetBoolean(...args),
  SettingKeys: {
    USDC_FEATURES_ENABLED: 'usdcFeaturesEnabled',
  },
}));

function configure({
  receiveAsset = 'UNIT',
  borrowResult = { txid: 'issue-txid', vaultTxid: 'vault-txid' },
}: {
  receiveAsset?: 'UNIT' | 'USDC';
  borrowResult?: { txid: string; vaultTxid: string } | null;
} = {}): void {
  mockBorrow.mockResolvedValue(borrowResult);
  mockQuoteBorrowToUsdc.mockResolvedValue({
    estimatedUsdcOut: '99.00',
    minimumUsdcOut: '98.00',
  });
  mockSettleIssuedUnitToUsdc.mockResolvedValue({ status: 'settled' });

  (useBorrow as jest.Mock).mockReturnValue({
    borrowAmountUsd: 123.45,
    receiveAsset,
    setCurrentStep: mockSetCurrentStep,
  });
  (useBorrowVault as jest.Mock).mockReturnValue({
    borrow: mockBorrow,
    cancel: mockRawCancel,
    isLoading: false,
    error: null,
  });
  (useVaultSettlementStore as unknown as jest.Mock).mockReturnValue({
    startOperation: mockStartOperation,
    setPhase: mockSetPhase,
    setIssueResult: mockSetIssueResult,
    completeSettlement: mockCompleteSettlement,
    reset: mockResetSettlement,
  });
  (useIssuedUnitSettlement as jest.Mock).mockReturnValue({
    quoteBorrowToUsdc: mockQuoteBorrowToUsdc,
    settleIssuedUnitToUsdc: mockSettleIssuedUnitToUsdc,
  });
}

describe('useBorrowToUsdcSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBoolean.mockResolvedValue(true);
    configure();
  });

  it('completes a direct UNIT borrow settlement without invoking the bridge path', async () => {
    const { result } = renderHook(() => useBorrowToUsdcSettlement());
    let borrowResult: unknown;

    await act(async () => {
      borrowResult = await result.current.borrow();
    });

    expect(borrowResult).toEqual({ txid: 'issue-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith('borrow', 123.45, 'UNIT');
    expect(mockSetPhase).toHaveBeenCalledWith('issuing_vault');
    expect(mockBorrow).toHaveBeenCalledTimes(1);
    expect(mockSetIssueResult).toHaveBeenCalledWith('issue-txid', 'vault-txid');
    expect(formatVaultSettlementAmountInput).toHaveBeenCalledWith(123.45);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('UNIT', '123.45-formatted');
    expect(mockSettleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockSetCurrentStep).toHaveBeenCalledWith('success');
  });

  it('settles borrowed UNIT to USDC when requested by the store', async () => {
    configure({ receiveAsset: 'USDC' });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());
    let borrowResult: unknown;

    await act(async () => {
      borrowResult = await result.current.borrow();
    });

    expect(borrowResult).toEqual({ txid: 'issue-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith('borrow', 123.45, 'USDC');
    expect(mockSetIssueResult).toHaveBeenCalledWith('issue-txid', 'vault-txid');
    expect(mockSettleIssuedUnitToUsdc).toHaveBeenCalledWith('borrow', 123.45);
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
    expect(mockSetCurrentStep).toHaveBeenCalledWith('success');
  });

  it('forces direct UNIT settlement when USDC features are disabled', async () => {
    mockGetBoolean.mockResolvedValueOnce(false);
    configure({ receiveAsset: 'USDC' });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    await act(async () => {
      await result.current.borrow();
    });

    expect(mockStartOperation).toHaveBeenCalledWith('borrow', 123.45, 'UNIT');
    expect(mockCompleteSettlement).toHaveBeenCalledWith('UNIT', '123.45-formatted');
    expect(mockSettleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockSetCurrentStep).toHaveBeenCalledWith('success');
  });

  it('does not mark success when USDC settlement needs retry before broadcast', async () => {
    configure({ receiveAsset: 'USDC' });
    mockSettleIssuedUnitToUsdc.mockResolvedValueOnce({
      status: 'needs_retry',
      bridgeIntentId: 'bridge-intent-1',
      error: 'No UNIT balance available',
    });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    await act(async () => {
      await result.current.borrow();
    });

    expect(mockSettleIssuedUnitToUsdc).toHaveBeenCalledWith('borrow', 123.45);
    expect(mockSetCurrentStep).not.toHaveBeenCalledWith('success');
  });

  it('does not mark success for pending USDC settlement unless the bridge send was broadcast', async () => {
    configure({ receiveAsset: 'USDC' });
    mockSettleIssuedUnitToUsdc.mockResolvedValueOnce({
      status: 'pending_settlement',
      bridgeIntentId: 'bridge-intent-1',
      error: 'No UNIT balance available',
    });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    await act(async () => {
      await result.current.borrow();
    });

    expect(mockSetCurrentStep).not.toHaveBeenCalledWith('success');
  });

  it('marks success for pending USDC settlement after the bridge send broadcasts', async () => {
    configure({ receiveAsset: 'USDC' });
    mockSettleIssuedUnitToUsdc.mockResolvedValueOnce({
      status: 'pending_settlement',
      bridgeIntentId: 'bridge-intent-1',
      bridgeSendTxid: 'bridge-send-txid',
      error: 'Bridge settlement is still processing.',
    });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    await act(async () => {
      await result.current.borrow();
    });

    expect(mockSetCurrentStep).toHaveBeenCalledWith('success');
  });

  it('does not mark success when the raw borrow returns no result', async () => {
    configure({ borrowResult: null });
    const { result } = renderHook(() => useBorrowToUsdcSettlement());
    let borrowResult: unknown;

    await act(async () => {
      borrowResult = await result.current.borrow();
    });

    expect(borrowResult).toBeNull();
    expect(mockSetIssueResult).not.toHaveBeenCalled();
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
    expect(mockSettleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it('resets settlement state before delegating cancel to the raw borrow hook', () => {
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    act(() => {
      result.current.cancel();
    });

    expect(mockResetSettlement).toHaveBeenCalledTimes(1);
    expect(mockRawCancel).toHaveBeenCalledTimes(1);
  });

  it('exposes the borrow-to-USDC quote function from issued UNIT settlement', async () => {
    const { result } = renderHook(() => useBorrowToUsdcSettlement());

    await expect(result.current.quoteBorrowToUsdc(50)).resolves.toEqual({
      estimatedUsdcOut: '99.00',
      minimumUsdcOut: '98.00',
    });
    expect(mockQuoteBorrowToUsdc).toHaveBeenCalledWith(50);
  });
});
