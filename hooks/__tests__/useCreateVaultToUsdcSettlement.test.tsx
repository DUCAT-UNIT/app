import { act, renderHook } from '@testing-library/react-native';
import { useCreateVaultToUsdcSettlement } from '../useCreateVaultToUsdcSettlement';

const mockRawCreateVault = {
  createVault: jest.fn(),
  cancel: jest.fn(),
  isLoading: false,
  error: null,
  txid: null,
  vaultTxid: null,
};

const mockVaultCreationState = {
  borrowAmountUsd: 125.5,
  receiveAsset: 'USDC',
  vaultTxid: 'vault-txid-1',
  setCurrentStep: jest.fn(),
};

const mockSettlementStore = {
  startOperation: jest.fn(),
  setPhase: jest.fn(),
  setIssueResult: jest.fn(),
  completeSettlement: jest.fn(),
  reset: jest.fn(),
};

const mockIssuedSettlement = {
  quoteBorrowToUsdc: jest.fn(),
  settleIssuedUnitToUsdc: jest.fn(),
  settleIssuedUnitToTurboUnit: jest.fn(),
};

const mockGetBoolean = jest.fn();

jest.mock('../useCreateVault', () => ({
  useCreateVault: jest.fn(() => mockRawCreateVault),
}));

jest.mock('../../stores/vaultCreationStore', () => ({
  useVaultCreation: jest.fn(() => mockVaultCreationState),
  useVaultCreationStore: Object.assign(
    jest.fn(() => mockVaultCreationState),
    {
      getState: jest.fn(() => mockVaultCreationState),
    }
  ),
}));

jest.mock('../../stores/vaultSettlementStore', () => ({
  persistVaultSettlementNow: jest.fn().mockResolvedValue(undefined),
  useVaultSettlementStore: jest.fn(() => mockSettlementStore),
  resolveVaultSettlementRequestedAsset: (asset: string, allowUsdc: boolean) =>
    asset === 'USDC' && !allowUsdc ? 'UNIT' : asset,
}));

jest.mock('../../contexts/WalletContext', () => ({
  useWallet: jest.fn(() => ({
    currentAccount: 4,
    wallet: { taprootAddress: 'tb1pwallet' },
  })),
}));

jest.mock('../vault/useIssuedUnitSettlement', () => ({
  useIssuedUnitSettlement: jest.fn(() => mockIssuedSettlement),
}));

jest.mock('../../services/vaultSettlementService', () => ({
  formatVaultSettlementAmountInput: jest.fn((amount: number) => `formatted-${amount}`),
}));

jest.mock('../../services/settingsService', () => ({
  getBoolean: (...args: unknown[]) => mockGetBoolean(...args),
  SettingKeys: {
    USDC_FEATURES_ENABLED: 'usdcFeaturesEnabled',
  },
}));

describe('useCreateVaultToUsdcSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBoolean.mockResolvedValue(true);
    mockRawCreateVault.createVault.mockResolvedValue('issue-txid-1');
    mockIssuedSettlement.quoteBorrowToUsdc.mockResolvedValue({
      estimatedUsdcOut: '124.00',
      minimumUsdcOut: '123.00',
    });
    mockIssuedSettlement.settleIssuedUnitToUsdc.mockResolvedValue({ status: 'settled' });
    mockIssuedSettlement.settleIssuedUnitToTurboUnit.mockResolvedValue({ status: 'settled' });
    mockVaultCreationState.borrowAmountUsd = 125.5;
    mockVaultCreationState.receiveAsset = 'USDC';
    mockVaultCreationState.vaultTxid = 'vault-txid-1';
  });

  it('starts a vault issue operation and settles issued UNIT to USDC', async () => {
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    let txid: string | null = null;
    await act(async () => {
      txid = await result.current.createVault({ isMaxDeposit: false });
    });

    expect(txid).toBe('issue-txid-1');
    expect(mockSettlementStore.startOperation).toHaveBeenCalledWith(
      'open',
      125.5,
      'USDC',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(mockSettlementStore.setPhase).toHaveBeenCalledWith('issuing_vault');
    expect(mockRawCreateVault.createVault).toHaveBeenCalledWith({ isMaxDeposit: false });
    expect(mockSettlementStore.setIssueResult).toHaveBeenCalledWith('issue-txid-1', 'vault-txid-1');
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).toHaveBeenCalledWith('open', 125.5);
    expect(mockSettlementStore.completeSettlement).not.toHaveBeenCalled();
    expect(mockVaultCreationState.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('does not mark vault creation success when USDC settlement needs retry before broadcast', async () => {
    mockIssuedSettlement.settleIssuedUnitToUsdc.mockResolvedValueOnce({
      status: 'needs_retry',
      bridgeIntentId: 'bridge-intent-1',
      error: 'No UNIT balance available',
    });
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await act(async () => {
      await result.current.createVault();
    });

    expect(mockSettlementStore.setIssueResult).toHaveBeenCalledWith('issue-txid-1', 'vault-txid-1');
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).toHaveBeenCalledWith('open', 125.5);
    expect(mockVaultCreationState.setCurrentStep).not.toHaveBeenCalledWith('success');
  });

  it('marks vault creation success when pending USDC settlement already has a bridge send txid', async () => {
    mockIssuedSettlement.settleIssuedUnitToUsdc.mockResolvedValueOnce({
      status: 'pending_settlement',
      bridgeIntentId: 'bridge-intent-1',
      bridgeSendTxid: 'bridge-send-txid',
      error: 'Bridge settlement is still processing.',
    });
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await act(async () => {
      await result.current.createVault();
    });

    expect(mockVaultCreationState.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('completes immediately when the user requested UNIT instead of USDC', async () => {
    mockVaultCreationState.receiveAsset = 'UNIT';
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await act(async () => {
      await result.current.createVault();
    });

    expect(mockSettlementStore.startOperation).toHaveBeenCalledWith(
      'open',
      125.5,
      'UNIT',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(mockSettlementStore.completeSettlement).toHaveBeenCalledWith('UNIT', 'formatted-125.5');
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockIssuedSettlement.settleIssuedUnitToTurboUnit).not.toHaveBeenCalled();
    expect(mockVaultCreationState.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('settles issued UNIT to TurboUNIT when requested', async () => {
    mockVaultCreationState.receiveAsset = 'TURBOUNIT';
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await act(async () => {
      await result.current.createVault();
    });

    expect(mockSettlementStore.startOperation).toHaveBeenCalledWith(
      'open',
      125.5,
      'TURBOUNIT',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(mockIssuedSettlement.settleIssuedUnitToTurboUnit).toHaveBeenCalledWith('open', 125.5);
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockSettlementStore.completeSettlement).not.toHaveBeenCalled();
    expect(mockVaultCreationState.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('forces direct UNIT settlement when USDC features are disabled', async () => {
    mockGetBoolean.mockResolvedValueOnce(false);
    mockVaultCreationState.receiveAsset = 'USDC';
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await act(async () => {
      await result.current.createVault();
    });

    expect(mockSettlementStore.startOperation).toHaveBeenCalledWith(
      'open',
      125.5,
      'UNIT',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(mockSettlementStore.completeSettlement).toHaveBeenCalledWith('UNIT', 'formatted-125.5');
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockVaultCreationState.setCurrentStep).toHaveBeenCalledWith('success');
  });

  it('does not mark settlement complete if vault creation returns no issue txid', async () => {
    mockRawCreateVault.createVault.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    let txid: string | null = 'unexpected';
    await act(async () => {
      txid = await result.current.createVault();
    });

    expect(txid).toBeNull();
    expect(mockSettlementStore.startOperation).toHaveBeenCalledWith(
      'open',
      125.5,
      'USDC',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(mockSettlementStore.setIssueResult).not.toHaveBeenCalled();
    expect(mockSettlementStore.completeSettlement).not.toHaveBeenCalled();
    expect(mockIssuedSettlement.settleIssuedUnitToUsdc).not.toHaveBeenCalled();
    expect(mockVaultCreationState.setCurrentStep).not.toHaveBeenCalledWith('success');
  });

  it('exposes the USDC quote function from the settlement hook', async () => {
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    await expect(result.current.quoteBorrowToUsdc(10)).resolves.toEqual({
      estimatedUsdcOut: '124.00',
      minimumUsdcOut: '123.00',
    });

    expect(mockIssuedSettlement.quoteBorrowToUsdc).toHaveBeenCalledWith(10);
  });

  it('resets settlement state before delegating cancel to the vault creation hook', () => {
    const { result } = renderHook(() => useCreateVaultToUsdcSettlement());

    act(() => {
      result.current.cancel();
    });

    expect(mockSettlementStore.reset).toHaveBeenCalled();
    expect(mockRawCreateVault.cancel).toHaveBeenCalled();
  });
});
