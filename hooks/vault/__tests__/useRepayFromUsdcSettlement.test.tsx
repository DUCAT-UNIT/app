import { act, renderHook } from '@testing-library/react-native';
import { useBalance, useTransactionHistory } from '../../../contexts/WalletDataContext';
import { useWallet } from '../../../contexts/WalletContext';
import { getRedemptionStatus } from '../../../services/bridgeApiService';
import { getBalance as getCashuBalance } from '../../../services/cashu/cashuBalanceService';
import { requestMelt, completeMelt } from '../../../services/cashu/cashuWalletService';
import { requestRedemption } from '../../../services/evmBridgeService';
import { createVaultWallet } from '../../../services/vaultWalletService';
import {
  formatVaultSettlementAmountInput,
  quoteVaultRepaySettlement,
  waitForRedemptionRelease,
} from '../../../services/vaultSettlementService';
import { useRepay } from '../../../stores/repayStore';
import { useVaultSettlementStore } from '../../../stores/vaultSettlementStore';
import { useRepayVault } from '../useRepayVault';
import { useRepayFromUsdcSettlement } from '../useRepayFromUsdcSettlement';

jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../../../contexts/CashuContext', () => ({
  useCashuOperations: jest.fn(() => ({
    refresh: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useBalance: jest.fn(),
  useTransactionHistory: jest.fn(),
}));

jest.mock('../../../services/cashu/cashuBalanceService', () => ({
  getBalance: jest.fn(),
}));

jest.mock('../../../services/cashu/cashuWalletService', () => ({
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

jest.mock('../../../stores/repayStore', () => ({
  useRepay: jest.fn(),
}));

jest.mock('../../../stores/vaultSettlementStore', () => ({
  useVaultSettlementStore: jest.fn(),
}));

jest.mock('../useRepayVault', () => ({
  useRepayVault: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
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

const wallet = {
  segwitAddress: 'tb1qwallet',
  segwitPubkey: '02segwit',
  taprootAddress: 'tb1pwallet',
  taprootPubkey: '03taproot',
};

function configure({
  settlementKind = null,
  persistedRedemptionId = null,
  rawRepayResult = { txid: 'repay-txid', vaultTxid: 'vault-txid' },
  rawRepayError = null,
}: {
  settlementKind?: 'repay' | null;
  persistedRedemptionId?: string | null;
  rawRepayResult?: { txid: string; vaultTxid: string } | null;
  rawRepayError?: string | null;
} = {}): void {
  mockFetchBalance.mockResolvedValue(undefined);
  mockFetchTransactionHistory.mockResolvedValue(undefined);
  mockLoadVaultData.mockResolvedValue(true);
  mockRawRepay.mockResolvedValue(rawRepayResult);
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
    error: null,
    setError: mockSetError,
    setRepayQuote: mockSetRepayStoreQuote,
    setTurboRepayQuote: mockSetTurboRepayQuote,
  });
  (useVaultSettlementStore as unknown as jest.Mock).mockReturnValue({
    kind: settlementKind,
    redemptionId: persistedRedemptionId,
    cashuMeltTxid: null,
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
  (formatVaultSettlementAmountInput as jest.Mock).mockImplementation((amount: number) => amount.toFixed(2));
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
    fee: 10,
    total: 5010,
  });
  (completeMelt as jest.Mock).mockResolvedValue({
    paid: true,
    txid: 'melt-txid',
    fee: 10,
    balance: 0,
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
    mockRuneUtxos.mockResolvedValueOnce([]);
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
    mockRuneUtxos.mockResolvedValueOnce([]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());

    await expect(result.current.quoteRepaySettlement(50)).resolves.toEqual({
      fundingAsset: 'TURBOUNIT',
      requiredUsdcIn: '0',
      estimatedSepoliaFeeEth: '0',
      requiredTurboUnitIn: '50.10',
      estimatedTurboUnitFee: '0.10',
    });

    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(mockSetRepayStoreQuote).toHaveBeenCalledWith('0', '0');
    expect(mockSetTurboRepayQuote).toHaveBeenCalledWith('50.10', '0.10');
    expect(quoteVaultRepaySettlement).not.toHaveBeenCalled();
  });

  it('executes a repay directly when spendable UNIT already exists', async () => {
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith('repay', 50, 'UNIT');
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockSetPhase).toHaveBeenCalledWith('repaying_vault');
    expect(mockFetchBalance).toHaveBeenCalled();
    expect(mockFetchTransactionHistory).toHaveBeenCalled();
    expect(mockLoadVaultData).toHaveBeenCalledTimes(1);
    expect(mockRawRepay).toHaveBeenCalledTimes(1);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('UNIT', '0');
    expect(mockSetError).toHaveBeenCalledWith(null);
  });

  it('blocks USDC repayment fallback when USDC features are disabled', async () => {
    mockGetBoolean.mockResolvedValue(false);
    mockRuneUtxos.mockResolvedValue([]);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toBeNull();
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockStartOperation).not.toHaveBeenCalled();
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockSetError).toHaveBeenLastCalledWith('Not enough spendable UNIT or TurboUNIT to repay this amount.');
  });

  it('submits USDC redemption, waits for release, then repays the vault', async () => {
    mockRuneUtxos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ txid: 'released-unit-utxo' }]);
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
    mockRuneUtxos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ txid: 'melted-unit-utxo' }]);
    (getCashuBalance as jest.Mock).mockResolvedValueOnce(6000);
    const { result } = renderHook(() => useRepayFromUsdcSettlement());
    let repayResult: unknown;

    await act(async () => {
      repayResult = await result.current.repay();
    });

    expect(repayResult).toEqual({ txid: 'repay-txid', vaultTxid: 'vault-txid' });
    expect(mockStartOperation).toHaveBeenCalledWith('repay', 50, 'TURBOUNIT');
    expect(requestMelt).toHaveBeenCalledWith(wallet.taprootAddress, 5000);
    expect(mockSetCashuMeltQuote).toHaveBeenCalledWith('melt-1');
    expect(completeMelt).toHaveBeenCalledWith('melt-1', 5010);
    expect(mockSetCashuMeltTxid).toHaveBeenCalledWith('melt-txid');
    expect(requestRedemption).not.toHaveBeenCalled();
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'melting_turbo_repay',
      'waiting_turbo_release',
      'repaying_vault',
    ]);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.10');
  });

  it('resumes an existing redemption instead of burning USDC again', async () => {
    configure({ settlementKind: 'repay', persistedRedemptionId: 'release-existing' });
    mockRuneUtxos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ txid: 'released-unit-utxo' }]);
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
    configure({ rawRepayResult: null, rawRepayError: 'raw repay failed' });
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
