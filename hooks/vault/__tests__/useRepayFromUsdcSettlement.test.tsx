import { act, renderHook } from '@testing-library/react-native';
import { useBalance, useTransactionHistory } from '../../../contexts/WalletDataContext';
import { useWallet } from '../../../contexts/WalletContext';
import { getRedemptionStatus } from '../../../services/bridgeApiService';
import { getBalance as getCashuBalance } from '../../../services/cashu/cashuBalanceService';
import {
  checkMeltQuote,
  requestMelt,
  completeMelt,
} from '../../../services/cashu/cashuWalletService';
import { requestRedemption } from '../../../services/evmBridgeService';
import { createVaultWallet } from '../../../services/vaultWalletService';
import { VAULT_CONFIG } from '../../../utils/constants';
import {
  formatVaultSettlementAmountInput,
  quoteVaultRepaySettlement,
  waitForRedemptionRelease,
} from '../../../services/vaultSettlementService';
import { useRepay, useRepayStore } from '../../../stores/repayStore';
import { useVaultSettlementStore } from '../../../stores/vaultSettlementStore';
import { useRepayVault } from '../useRepayVault';
import { useRepayFromUsdcSettlement } from '../useRepayFromUsdcSettlement';

const mockRefreshCashuBalance = jest.fn().mockResolvedValue(undefined);
const mockGetJsonWithNativeTimeout = jest.fn();

jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../../../contexts/CashuContext', () => ({
  useCashuOperations: jest.fn(() => ({
    refresh: mockRefreshCashuBalance,
  })),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useBalance: jest.fn(),
  useTransactionHistory: jest.fn(),
}));

jest.mock('../../../utils/nativeHttp', () => ({
  getJsonWithNativeTimeout: (...args: unknown[]) => mockGetJsonWithNativeTimeout(...args),
}));

jest.mock('../../../services/cashu/cashuBalanceService', () => ({
  getBalance: jest.fn(),
}));

jest.mock('../../../services/cashu/cashuWalletService', () => ({
  checkMeltQuote: jest.fn(),
  requestMelt: jest.fn(),
  completeMelt: jest.fn(),
}));

jest.mock('../../../services/bridgeApiService', () => ({
  getRedemptionStatus: jest.fn(),
}));

jest.mock('../../../services/evmBridgeService', () => ({
  requestRedemption: jest.fn(),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn(),
}));

jest.mock('../../../services/vaultSettlementService', () => ({
  formatVaultSettlementAmountInput: jest.fn((amount: number) => amount.toFixed(2)),
  quoteVaultRepaySettlement: jest.fn(),
  waitForRedemptionRelease: jest.fn(),
}));

const mockGetBoolean = jest.fn();

jest.mock('../../../services/settingsService', () => ({
  getBoolean: (...args: unknown[]) => mockGetBoolean(...args),
  SettingKeys: {
    USDC_FEATURES_ENABLED: 'usdcFeaturesEnabled',
  },
}));

jest.mock('../../../stores/repayStore', () => {
  const useRepayStoreMock = jest.fn() as jest.Mock & { getState: jest.Mock };
  useRepayStoreMock.getState = jest.fn(() => ({ error: null, setProcessingStep: jest.fn() }));
  return {
    useRepay: jest.fn(),
    useRepayStore: useRepayStoreMock,
  };
});

jest.mock('../../../stores/vaultSettlementStore', () => ({
  persistVaultSettlementNow: jest.fn().mockResolvedValue(undefined),
  shouldPreserveVaultSettlementRecovery: jest.fn(
    (phase: string) => phase !== 'idle' && phase !== 'settled'
  ),
  useVaultSettlementStore: jest.fn(),
}));

jest.mock('../useRepayVault', () => ({
  useRepayVault: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFetchBalance = jest.fn();
const mockFetchTransactionHistory = jest.fn();
const mockRuneUtxos = jest.fn();
const mockSetError = jest.fn();
const mockSetRepayStoreQuote = jest.fn();
const mockSetTurboRepayQuote = jest.fn();
const mockSetPhase = jest.fn();
const mockSetRepayQuote = jest.fn();
const mockSetCashuMeltQuote = jest.fn();
const mockSetCashuMeltTxid = jest.fn();
const mockSetRedemptionResult = jest.fn();
const mockCompleteSettlement = jest.fn();
const mockMarkNeedsRetry = jest.fn();
const mockResetSettlement = jest.fn();
const mockStartOperation = jest.fn();
const mockLoadVaultData = jest.fn();
const mockRawRepay = jest.fn();
const mockRawCancel = jest.fn();
const mockSetProcessingStep = jest.fn();
const mockSetRepayCurrentStep = jest.fn();
const mockSetRepayStateError = jest.fn();

const wallet = {
  segwitAddress: 'tb1qwallet',
  segwitPubkey: '02segwit',
  taprootAddress: 'tb1pwallet',
  taprootPubkey: '03taproot',
};

function unitUtxo(txid: string, amount = 5000) {
  return {
    txid,
    vout: 0,
    value: 10_000,
    runes: new Map([[VAULT_CONFIG.RUNE_LABEL, { amount, divisibility: 2, symbol: 'UNIT' }]]),
  };
}

async function flushPromises(count = 20): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

function configure({
  settlementKind = null,
  settlementPhase = 'idle',
  settlementFaceValueUsd = 50,
  repayFundingAsset = 'UNIT',
  persistedRequestedPayoutAsset = 'UNIT',
  persistedRedemptionId = null,
  persistedCashuMeltQuoteId = null,
  persistedCashuMeltTxid = null,
  availableDirectUnitBalance = 0,
  rawRepayResult = { txid: 'repay-txid', vaultTxid: 'vault-txid' },
  rawRepayError = null,
}: {
  settlementKind?: 'repay' | null;
  settlementPhase?: 'idle' | 'settled' | 'needs_retry';
  settlementFaceValueUsd?: number;
  repayFundingAsset?: 'UNIT' | 'TURBOUNIT' | 'USDC';
  persistedRequestedPayoutAsset?: 'UNIT' | 'TURBOUNIT' | 'USDC';
  persistedRedemptionId?: string | null;
  persistedCashuMeltQuoteId?: string | null;
  persistedCashuMeltTxid?: string | null;
  availableDirectUnitBalance?: number;
  rawRepayResult?: { txid: string; vaultTxid: string } | null;
  rawRepayError?: string | null;
} = {}): void {
  mockFetchBalance.mockResolvedValue(undefined);
  mockFetchTransactionHistory.mockResolvedValue(undefined);
  mockLoadVaultData.mockResolvedValue(true);
  mockRawRepay.mockResolvedValue(rawRepayResult);
  (useRepayStore as unknown as { getState: jest.Mock }).getState.mockReturnValue({
    error: rawRepayError,
    setCurrentStep: mockSetRepayCurrentStep,
    setError: mockSetRepayStateError,
    setProcessingStep: mockSetProcessingStep,
  });
  (useWallet as jest.Mock).mockReturnValue({
    wallet,
    currentAccount: 4,
  });
  (useBalance as jest.Mock).mockReturnValue({ fetchBalance: mockFetchBalance });
  (useTransactionHistory as jest.Mock).mockReturnValue({
    fetchTransactionHistory: mockFetchTransactionHistory,
  });
  (useRepay as jest.Mock).mockReturnValue({
    repayAmountUsd: 50,
    repayFundingAsset,
    availableDirectUnitBalance,
    error: null,
    setError: mockSetError,
    setRepayQuote: mockSetRepayStoreQuote,
    setTurboRepayQuote: mockSetTurboRepayQuote,
  });
  (useVaultSettlementStore as unknown as jest.Mock).mockReturnValue({
    kind: settlementKind,
    phase: settlementPhase,
    faceValueUsd: settlementFaceValueUsd,
    requestedPayoutAsset: persistedRequestedPayoutAsset,
    redemptionId: persistedRedemptionId,
    cashuMeltQuoteId: persistedCashuMeltQuoteId,
    cashuMeltTxid: persistedCashuMeltTxid,
    startOperation: mockStartOperation,
    setPhase: mockSetPhase,
    setRepayQuote: mockSetRepayQuote,
    setCashuMeltQuote: mockSetCashuMeltQuote,
    setCashuMeltTxid: mockSetCashuMeltTxid,
    setRedemptionResult: mockSetRedemptionResult,
    completeSettlement: mockCompleteSettlement,
    markNeedsRetry: mockMarkNeedsRetry,
    reset: mockResetSettlement,
  });
  (useRepayVault as jest.Mock).mockReturnValue({
    loadVaultData: mockLoadVaultData,
    repay: mockRawRepay,
    cancel: mockRawCancel,
    isLoading: false,
    error: rawRepayError,
  });
  (createVaultWallet as jest.Mock).mockResolvedValue({
    fetch: {
      rune_utxos: mockRuneUtxos,
    },
  });
  (formatVaultSettlementAmountInput as jest.Mock).mockImplementation((amount: number) =>
    amount.toFixed(2)
  );
  (quoteVaultRepaySettlement as jest.Mock).mockResolvedValue({
    requiredUsdcIn: '51.00',
    estimatedSepoliaFeeEth: '0.001',
  });
  (requestRedemption as jest.Mock).mockResolvedValue({
    releaseId: 'release-1',
    burnTxHash: '0xburn',
  });
  (getCashuBalance as jest.Mock).mockResolvedValue(0);
  (requestMelt as jest.Mock).mockResolvedValue({
    quoteId: 'melt-1',
    amount: 5000,
    fee: 0,
    total: 5000,
  });
  (completeMelt as jest.Mock).mockResolvedValue({
    paid: true,
    txid: 'melt-txid',
    fee: 0,
    balance: 0,
  });
  (checkMeltQuote as jest.Mock).mockResolvedValue({
    quote: 'melt-1',
    state: 'UNPAID',
    paid: false,
  });
  (waitForRedemptionRelease as jest.Mock).mockResolvedValue({
    status: 'released',
  });
  (getRedemptionStatus as jest.Mock).mockResolvedValue({
    status: 'released',
  });
}

describe('useRepayFromUsdcSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetJsonWithNativeTimeout.mockReset();
    mockGetJsonWithNativeTimeout.mockRejectedValue(new Error('direct UTXO check not mocked'));
    mockRefreshCashuBalance.mockResolvedValue(undefined);
    mockRuneUtxos.mockReset();
    mockGetBoolean.mockResolvedValue(true);
    configure();
    mockRuneUtxos.mockResolvedValue([{ txid: 'unit-utxo' }]);
  });

  it('quotes zero USDC when direct spendable UNIT is already available', async () => {
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await expect(result.current.quoteRepayFromUsdc(50)).resolves.toEqual({
      requiredUsdcIn: '0',
      estimatedSepoliaFeeEth: '0',
    });

    expect(createVaultWallet).toHaveBeenCalledWith(wallet);
    expect(mockRuneUtxos).toHaveBeenCalledWith(expect.any(String), 5000);
    expect(quoteVaultRepaySettlement).not.toHaveBeenCalled();
    expect(mockSetRepayStoreQuote).toHaveBeenCalledWith('0', '0');
    expect(mockSetRepayQuote).toHaveBeenCalledWith('0', '0');
  });

  it('quotes Sepolia redemption when direct UNIT is not available', async () => {
    configure({ repayFundingAsset: 'USDC' });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await expect(result.current.quoteRepayFromUsdc(50)).resolves.toEqual({
      requiredUsdcIn: '51.00',
      estimatedSepoliaFeeEth: '0.001',
    });

    expect(quoteVaultRepaySettlement).toHaveBeenCalledWith(4, 50, wallet.taprootAddress);
    expect(mockSetRepayStoreQuote).toHaveBeenCalledWith('51.00', '0.001');
    expect(mockSetRepayQuote).toHaveBeenCalledWith('51.00', '0.001');
  });

  it('quotes TurboUNIT melt when direct UNIT is unavailable and Cashu balance covers the quote', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await expect(result.current.quoteRepaySettlement(50)).resolves.toEqual({
      fundingAsset: 'TURBOUNIT',
      requiredUsdcIn: '0',
      estimatedSepoliaFeeEth: '0',
      requiredTurboUnitIn: '50.00',
      estimatedTurboUnitFee: '0.00',
    });

    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(mockSetRepayStoreQuote).toHaveBeenCalledWith('0', '0');
    expect(mockSetTurboRepayQuote).toHaveBeenCalledWith('50.00', '0.00');
    expect(quoteVaultRepaySettlement).not.toHaveBeenCalled();
  });

  it('quotes full TurboUNIT melt when direct UNIT also exists', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT', availableDirectUnitBalance: 40 });
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    (requestMelt as jest.Mock).mockResolvedValueOnce({
      quoteId: 'melt-full',
      amount: 5000,
      fee: 0,
      total: 5000,
    });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await expect(result.current.quoteRepaySettlement(50)).resolves.toEqual({
      fundingAsset: 'TURBOUNIT',
      requiredUsdcIn: '0',
      estimatedSepoliaFeeEth: '0',
      requiredTurboUnitIn: '50.00',
      estimatedTurboUnitFee: '0.00',
    });

    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(mockSetTurboRepayQuote).toHaveBeenCalledWith('50.00', '0.00');
  });

  it('executes a repay directly when spendable UNIT already exists', async () => {
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).not.toHaveBeenCalled();
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockGetBoolean).not.toHaveBeenCalled();
    expect(mockSetPhase).not.toHaveBeenCalled();
    expect(mockFetchBalance).not.toHaveBeenCalled();
    expect(mockFetchTransactionHistory).not.toHaveBeenCalled();
    expect(createVaultWallet).not.toHaveBeenCalled();
    expect(mockRuneUtxos).not.toHaveBeenCalled();
    expect(mockResetSettlement).toHaveBeenCalledTimes(1);
    expect(mockLoadVaultData).toHaveBeenCalledTimes(1);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
    expect(mockSetError).toHaveBeenCalledWith(null);
  });

  it('does not mark settlement retry state when direct UNIT raw repay fails', async () => {
    configure({ rawRepayResult: null, rawRepayError: 'raw repay failed' });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toBeNull();
    expect(mockStartOperation).not.toHaveBeenCalled();
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockSetError).toHaveBeenLastCalledWith('raw repay failed');
  });

  it('blocks USDC repayment fallback when USDC features are disabled', async () => {
    configure({ repayFundingAsset: 'USDC' });
    mockGetBoolean.mockResolvedValue(false);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toBeNull();
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockStartOperation).not.toHaveBeenCalled();
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockSetError).toHaveBeenLastCalledWith('Sepolia USDC repay is not enabled.');
  });

  it('submits USDC redemption, waits for release, then repays the vault', async () => {
    configure({ repayFundingAsset: 'USDC' });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('released-unit-utxo')]);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(requestRedemption).toHaveBeenCalledWith(
      4,
      '50.00',
      wallet.taprootAddress,
      'USDC',
      '51.00',
      expect.any(Function)
    );
    expect(mockSetRedemptionResult).toHaveBeenCalledWith('release-1', '0xburn');
    expect(waitForRedemptionRelease).toHaveBeenCalledWith('release-1');
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'swapping_repay',
      'waiting_redemption_release',
      'repaying_vault',
    ]);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('USDC', '51.00');
  });

  it('melts TurboUNIT, waits for released UNIT, then repays the vault', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith(
      'repay',
      50,
      'TURBOUNIT',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(mockSetCashuMeltQuote).toHaveBeenCalledWith('melt-1');
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5000);
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('melt-txid');
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'melting_turbo_repay',
      'waiting_turbo_release',
      'repaying_vault',
    ]);
    expect(mockSetProcessingStep).toHaveBeenCalledWith(2);
    expect(mockSetProcessingStep).toHaveBeenCalledWith(3);
    expect(mockSetProcessingStep).toHaveBeenCalledWith(4);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('continues TurboUNIT repay when the melt returns PENDING with a submitted txid', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('pending-melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const pendingMeltError = Object.assign(
      new Error('Mint did not confirm the withdrawal. State: PENDING.'),
      {
        meltState: 'PENDING',
        meltTxid: 'pending-melt-txid:0',
      }
    );
    (completeMelt as jest.Mock).mockRejectedValueOnce(pendingMeltError);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5000);
    expect(checkMeltQuote).not.toHaveBeenCalled();
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('pending-melt-txid');
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('waits for a pending TurboUNIT melt output to become visible before raw repay', async () => {
    jest.useFakeTimers();
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockRuneUtxos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unitUtxo('pending-melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const pendingMeltError = Object.assign(
      new Error('Mint did not confirm the withdrawal. State: PENDING.'),
      {
        meltState: 'PENDING',
        meltTxid: 'pending-melt-txid:0',
      }
    );
    (completeMelt as jest.Mock).mockRejectedValueOnce(pendingMeltError);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;
    let repayPromise: Promise<unknown>;

    await act(async () => {
      repayPromise = result.current.repay();
      await flushPromises();
    });

    expect(mockRuneUtxos).toHaveBeenCalledTimes(1);
    expect(mockRawRepay).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await flushPromises();
      repayResult = await repayPromise;
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockRuneUtxos).toHaveBeenCalledTimes(2);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('pending-melt-txid');
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
    jest.useRealTimers();
  });

  it('retries TurboUNIT raw repay when Guardian rejects before the melt tx propagates', async () => {
    jest.useFakeTimers();
    configure({ repayFundingAsset: 'TURBOUNIT' });
    let latestRawRepayError: string | null = null;
    (useRepayStore as unknown as { getState: jest.Mock }).getState.mockImplementation(() => ({
      error: latestRawRepayError,
      setCurrentStep: mockSetRepayCurrentStep,
      setError: mockSetRepayStateError,
      setProcessingStep: mockSetProcessingStep,
    }));
    mockRuneUtxos.mockResolvedValue([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    mockRawRepay
      .mockImplementationOnce(async () => {
        latestRawRepayError = 'Message: Mempool Rejection reason:"missing-inputs"';
        return null;
      })
      .mockImplementationOnce(async () => {
        latestRawRepayError = null;
        return { txid: 'repay-txid', vaultTxid: 'vault-txid' };
      });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;
    let repayPromise: Promise<unknown>;

    await act(async () => {
      repayPromise = result.current.repay();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockSetRepayStateError).toHaveBeenCalledWith(null);
    expect(mockSetPhase).toHaveBeenCalledWith('waiting_turbo_release');

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
      repayResult = await repayPromise;
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockRawRepay).toHaveBeenCalledTimes(2);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
    jest.useRealTimers();
  });

  it('continues raw repay when post-melt TurboUNIT balance refresh hangs', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    mockRefreshCashuBalance.mockImplementationOnce(() => new Promise(() => undefined));
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5000);
    expect(mockRefreshCashuBalance).toHaveBeenCalledTimes(1);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('does not block TurboUNIT raw repay on wallet refresh after melt', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockFetchBalance.mockImplementationOnce(() => new Promise(() => undefined));
    mockFetchTransactionHistory.mockImplementationOnce(() => new Promise(() => undefined));
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockFetchBalance).not.toHaveBeenCalled();
    expect(mockFetchTransactionHistory).not.toHaveBeenCalled();
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('recognizes released TurboUNIT output directly when the wallet UTXO scan would stall', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    mockRuneUtxos.mockImplementationOnce(() => new Promise(() => undefined));
    mockGetJsonWithNativeTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/address/') && url.endsWith('/utxo')) {
        return Promise.resolve([{ txid: 'melt-txid', vout: 1, value: 10_000 }]);
      }
      if (url.includes('/output/melt-txid:1')) {
        return Promise.resolve({
          spent: false,
          transaction: 'melt-txid',
          value: 10_000,
          runes: {
            [VAULT_CONFIG.RUNE_LABEL]: {
              amount: 5000,
              divisibility: 2,
              symbol: '$',
            },
          },
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('resets a blocking local repay settlement and starts a fresh TurboUNIT repay amount', async () => {
    configure({
      settlementKind: 'repay',
      settlementPhase: 'needs_retry',
      settlementFaceValueUsd: 80.54,
      repayFundingAsset: 'TURBOUNIT',
      persistedRequestedPayoutAsset: 'TURBOUNIT',
      persistedCashuMeltTxid: 'old-melt-txid',
    });
    mockStartOperation.mockImplementationOnce(() => {
      throw new Error(
        'A vault settlement is still pending. Resume or reset it before starting another.'
      );
    });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockResetSettlement).toHaveBeenCalledTimes(1);
    expect(mockStartOperation).toHaveBeenCalledTimes(2);
    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5000);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
  });

  it('melts TurboUNIT when selected even if spendable UNIT covers the full amount', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT', availableDirectUnitBalance: 60 });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith(
      'repay',
      50,
      'TURBOUNIT',
      expect.objectContaining({ accountIndex: 4, taprootAddress: 'tb1pwallet' })
    );
    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5000);
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'melting_turbo_repay',
      'waiting_turbo_release',
      'repaying_vault',
    ]);
    expect(mockLoadVaultData).toHaveBeenCalledTimes(1);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('recovers an accepted TurboUNIT melt quote instead of melting again after restart', async () => {
    configure({
      settlementKind: 'repay',
      persistedRequestedPayoutAsset: 'TURBOUNIT',
      persistedCashuMeltQuoteId: 'melt-existing',
    });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('recovered-melt-txid')]);
    (checkMeltQuote as jest.Mock).mockResolvedValueOnce({
      quote: 'melt-existing',
      state: 'PAID',
      paid: true,
      amount: 5000,
      fee: 0,
      txid: 'recovered-melt-txid',
    });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(checkMeltQuote).toHaveBeenCalledWith('melt-existing');
    expect(requestMelt).not.toHaveBeenCalled();
    expect(completeMelt).not.toHaveBeenCalled();
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('recovered-melt-txid');
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'melting_turbo_repay',
      'waiting_turbo_release',
      'repaying_vault',
    ]);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('recovers a submitted PENDING TurboUNIT melt quote instead of melting again after restart', async () => {
    configure({
      settlementKind: 'repay',
      persistedRequestedPayoutAsset: 'TURBOUNIT',
      persistedCashuMeltQuoteId: 'melt-existing',
    });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('pending-release-txid')]);
    (checkMeltQuote as jest.Mock).mockResolvedValueOnce({
      quote: 'melt-existing',
      state: 'PENDING',
      paid: false,
      amount: 5000,
      fee: 0,
      outpoint: 'pending-release-txid:1',
    });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(checkMeltQuote).toHaveBeenCalledWith('melt-existing');
    expect(requestMelt).not.toHaveBeenCalled();
    expect(completeMelt).not.toHaveBeenCalled();
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('pending-release-txid');
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('melts the full TurboUNIT repay amount before repaying when direct UNIT also exists', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT', availableDirectUnitBalance: 40 });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('melt-txid')]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    (requestMelt as jest.Mock).mockResolvedValueOnce({
      quoteId: 'melt-full',
      amount: 5000,
      fee: 0,
      total: 5000,
    });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(completeMelt).toHaveBeenCalledWith('melt-full', 5000);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('shows a specific retryable message when the TurboUNIT mint cannot broadcast withdrawal', async () => {
    configure({ repayFundingAsset: 'TURBOUNIT' });
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    (completeMelt as jest.Mock).mockRejectedValueOnce(
      new Error('Withdrawal failed - your ecash tokens remain valid, please try again')
    );
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    const displayMessage =
      'The TurboUNIT mint could not broadcast the UNIT withdrawal. Your TurboUNIT remains in your wallet. Try a smaller amount or try again later.';
    expect(repayResult).toBeNull();
    expect(mockMarkNeedsRetry).toHaveBeenCalledWith(displayMessage);
    expect(mockSetError).toHaveBeenLastCalledWith(displayMessage);
    expect(mockSetCashuMeltTxid).not.toHaveBeenCalled();
    expect(mockRawRepay).not.toHaveBeenCalled();
  });

  it('resumes an existing redemption instead of burning USDC again', async () => {
    configure({
      settlementKind: 'repay',
      persistedRequestedPayoutAsset: 'USDC',
      persistedRedemptionId: 'release-existing',
    });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('released-unit-utxo')]);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await act(async () => {
      await result.current.repay();
    });

    expect(getRedemptionStatus).toHaveBeenCalledWith('release-existing');
    expect(waitForRedemptionRelease).not.toHaveBeenCalled();
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'waiting_redemption_release',
      'repaying_vault',
    ]);
  });

  it('marks retry and stores an error when raw repay fails after settlement', async () => {
    configure({
      repayFundingAsset: 'USDC',
      rawRepayResult: null,
      rawRepayError: 'raw repay failed',
    });
    mockRuneUtxos.mockResolvedValueOnce([unitUtxo('released-unit-utxo')]);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toBeNull();
    expect(mockMarkNeedsRetry).toHaveBeenCalledWith('raw repay failed');
    expect(mockSetError).toHaveBeenLastCalledWith('raw repay failed');
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
  });

  it('returns null and reports an error when wallet is not connected', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      wallet: null,
      currentAccount: 4,
    });
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toBeNull();
    expect(mockSetError).toHaveBeenCalledWith('Wallet not connected');
    expect(mockStartOperation).not.toHaveBeenCalled();
  });

  it('resets settlement state before delegating cancel to raw repay', () => {
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    act(() => {
      result.current.cancel();
    });

    expect(mockResetSettlement).toHaveBeenCalledTimes(1);
    expect(mockRawCancel).toHaveBeenCalledTimes(1);
  });
});
