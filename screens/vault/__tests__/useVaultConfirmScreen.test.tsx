import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useVaultConfirmScreen } from '../hooks/useVaultConfirmScreen';

jest.mock('../../../contexts/NavigationHandlersContext', () => ({
  useSettingsHandlers: () => ({ settingsHandlers: { usdcFeaturesEnabled: false } }),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useBalance: () => ({ utxos: [] }),
}));

const mockAuthenticateWithBiometrics = jest.fn();
jest.mock('../../../services/biometricService', () => ({
  authenticateWithBiometrics: (...args: unknown[]) => mockAuthenticateWithBiometrics(...args),
}));

const mockVerifyPin = jest.fn();
jest.mock('../../../services/pinService', () => ({
  verifyPin: (...args: unknown[]) => mockVerifyPin(...args),
}));

jest.mock('../../../stores/priceStore', () => ({
  usePrice: () => ({ btcPrice: 100000 }),
}));

jest.mock('../../../stores/vaultSettlementStore', () => ({
  requiresVaultSettlementUnitSend: () => false,
  resolveVaultSettlementRequestedAsset: (asset: unknown) => asset,
}));

jest.mock('../../../utils/e2e', () => ({
  isE2E: () => false,
}));

jest.mock('../../../utils/vaultUtils', () => ({
  getOpCostBorrow: () => 1000,
  getOpCostDeposit: () => 1000,
  getOpCostOpen: () => 1000,
  getOpCostRepay: () => 1000,
  getVaultSettlementReserveSats: () => 0,
}));

jest.mock('../navigation', () => ({
  dismissVaultActionFlow: jest.fn(),
}));

describe('useVaultConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to PIN when biometric auth is unavailable and resumes signing after PIN', async () => {
    mockAuthenticateWithBiometrics.mockResolvedValue({ success: false, error: 'not_enrolled' });
    mockVerifyPin.mockResolvedValue({ success: true });
    const borrow = jest.fn().mockResolvedValue(undefined);
    const store = {
      selectedFeeRate: 1,
      error: null,
      setCurrentStep: jest.fn(),
      reset: jest.fn(),
    };
    const config = {
      title: 'Confirm Borrow',
      operationType: 'borrow',
      authMessage: 'Authenticate to borrow',
      routes: { processing: 'BorrowProcessing', selection: 'BorrowPayout' },
      getPrimaryAmount: () => ({ amount: 25, unit: 'USD' }),
      getSummaryRows: () => [],
    };
    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
    };

    const { result } = renderHook(() =>
      useVaultConfirmScreen(
        { config: config as any, store: store as any, vaultHook: { isLoading: false, borrow } },
        navigation as any
      )
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(result.current.showPinFallback).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handlePinFallbackSubmit('123456');
    });

    expect(mockVerifyPin).toHaveBeenCalledWith('123456');
    expect(store.setCurrentStep).toHaveBeenCalledWith('processing');
    expect(navigation.navigate).toHaveBeenCalledWith('BorrowProcessing');
    expect(borrow).toHaveBeenCalledTimes(1);
  });
});
