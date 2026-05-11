import { act, renderHook } from '@testing-library/react-native';
import { useBalance, useTransactionHistory } from '../../../contexts/WalletDataContext';
import { useWallet } from '../../../contexts/WalletContext';
import {
  checkMintStatus,
  completeMint,
  requestMint,
} from '../../../services/cashu/cashuWalletService';
import { createBridgeIntent } from '../../../services/bridgeApiService';
import { deriveSepoliaAccount } from '../../../services/evmWalletService';
import {
  broadcastTransaction,
  createUnitIntent as createUnitIntentService,
  signIntent as signIntentService,
} from '../../../services/transaction';
import {
  formatVaultSettlementAmountInput,
  quoteVaultBorrowSettlement,
  waitForBridgeSettlement,
} from '../../../services/vaultSettlementService';
import { useNotificationStore } from '../../../stores/notificationStore';
import { usePendingTransactionsStore } from '../../../stores/pendingTransactionsStore';
import { useVaultSettlementStore } from '../../../stores/vaultSettlementStore';
import { useTransactionPolling } from '../../useTransactionPolling';
import { useIssuedUnitSettlement } from '../useIssuedUnitSettlement';

const mockBitcoinTransactionFromHex = jest.fn();
const mockBitcoinAddressFromOutputScript = jest.fn();

jest.mock('bitcoinjs-lib', () => ({
  Transaction: {
    fromHex: (...args: unknown[]) => mockBitcoinTransactionFromHex(...args),
  },
  address: {
    fromOutputScript: (...args: unknown[]) => mockBitcoinAddressFromOutputScript(...args),
  },
}));

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

jest.mock('../../../services/cashu/cashuWalletService', () => ({
  requestMint: jest.fn(),
  checkMintStatus: jest.fn(),
  completeMint: jest.fn(),
}));

jest.mock('../../../services/bridgeApiService', () => ({
  createBridgeIntent: jest.fn(),
}));

jest.mock('../../../services/evmWalletService', () => ({
  deriveSepoliaAccount: jest.fn(),
}));

jest.mock('../../../services/transaction', () => ({
  broadcastTransaction: jest.fn(),
  createUnitIntent: jest.fn(),
  signIntent: jest.fn(),
}));

jest.mock('../../../services/vaultSettlementService', () => ({
  formatVaultSettlementAmountInput: jest.fn((amount: number) => amount.toFixed(2)),
  quoteVaultBorrowSettlement: jest.fn(),
  waitForBridgeSettlement: jest.fn(),
}));

jest.mock('../../../stores/notificationStore', () => ({
  useNotificationStore: jest.fn(),
}));

jest.mock('../../../stores/pendingTransactionsStore', () => ({
  usePendingTransactionsStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

jest.mock('../../../stores/vaultSettlementStore', () => ({
  persistVaultSettlementNow: jest.fn().mockResolvedValue(undefined),
  useVaultSettlementStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

jest.mock('../../useTransactionPolling', () => ({
  useTransactionPolling: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFetchBalance = jest.fn();
const mockFetchTransactionHistory = jest.fn();
const mockShowSnackbar = jest.fn();
const mockStartPolling = jest.fn();
const mockGetUnconfirmedUTXOs = jest.fn();
const mockGetSpentUtxos = jest.fn();
const mockMarkUtxoAsSpent = jest.fn();
const mockMarkUtxosAsSpent = jest.fn();
const mockUnmarkUtxosAsSpent = jest.fn();
const mockAddPendingTransaction = jest.fn();
const mockConfirmTransaction = jest.fn();
const mockSetQuote = jest.fn();
const mockSetPhase = jest.fn();
const mockSetBridgeClientRequestId = jest.fn();
const mockSetBridgeIntent = jest.fn();
const mockSetBridgeSendTxid = jest.fn();
const mockSetCashuMintQuote = jest.fn();
const mockSetCashuMintSendTxid = jest.fn();
const mockCompleteSettlement = jest.fn();
const mockMarkPendingSettlement = jest.fn();
const mockMarkNeedsRetry = jest.fn();

const wallet = {
  taprootAddress: 'tb1pwallet',
  segwitAddress: 'tb1qwallet',
};

const pendingInputHash = 'aa'.repeat(32);

function configureIssuedUnitSettlement({
  bridgeClientRequestId = null,
}: { bridgeClientRequestId?: string | null } = {}): void {
  mockFetchBalance.mockResolvedValue(undefined);
  mockFetchTransactionHistory.mockResolvedValue(undefined);
  mockMarkUtxoAsSpent.mockResolvedValue(undefined);
  mockMarkUtxosAsSpent.mockResolvedValue(undefined);
  mockUnmarkUtxosAsSpent.mockResolvedValue(undefined);
  mockAddPendingTransaction.mockResolvedValue(undefined);
  mockConfirmTransaction.mockResolvedValue(undefined);
  mockGetUnconfirmedUTXOs.mockImplementation((kind: string) =>
    kind === 'taproot'
      ? [{ txid: 'tap-unconfirmed', vout: 0, value: 546, runeAmount: 250 }]
      : [{ txid: 'seg-unconfirmed', vout: 1, value: 1200 }]
  );
  mockGetSpentUtxos.mockReturnValue([{ txid: 'already-spent', vout: 0 }]);
  (useWallet as jest.Mock).mockReturnValue({
    wallet,
    currentAccount: 7,
  });
  (useBalance as jest.Mock).mockReturnValue({ fetchBalance: mockFetchBalance });
  (useTransactionHistory as jest.Mock).mockReturnValue({
    fetchTransactionHistory: mockFetchTransactionHistory,
  });
  (useNotificationStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ showSnackbar: mockShowSnackbar })
  );
  (useTransactionPolling as jest.Mock).mockReturnValue({ startPolling: mockStartPolling });
  const pendingTransactionsStoreMock = usePendingTransactionsStore as unknown as jest.Mock & {
    getState: jest.Mock;
  };
  const pendingTransactionsState = {
    pendingTransactions: {
      [pendingInputHash]: { status: 'pending' },
    },
    getUnconfirmedUTXOs: mockGetUnconfirmedUTXOs,
    getSpentUtxos: mockGetSpentUtxos,
    markUtxoAsSpent: mockMarkUtxoAsSpent,
    markUtxosAsSpent: mockMarkUtxosAsSpent,
    unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
    addPendingTransaction: mockAddPendingTransaction,
    confirmTransaction: mockConfirmTransaction,
  };
  pendingTransactionsStoreMock.mockImplementation((selector) =>
    selector(pendingTransactionsState)
  );
  pendingTransactionsStoreMock.getState.mockReturnValue(pendingTransactionsState);
  const vaultSettlementStoreMock = useVaultSettlementStore as unknown as jest.Mock & {
    getState: jest.Mock;
  };
  vaultSettlementStoreMock.mockImplementation((selector) =>
    selector({
      bridgeClientRequestId,
      cashuMintQuoteId: null,
      cashuMintDepositAddress: null,
      cashuMintQuoteAmount: null,
      cashuMintSendTxid: null,
      setQuote: mockSetQuote,
      setPhase: mockSetPhase,
      setBridgeClientRequestId: mockSetBridgeClientRequestId,
      setBridgeIntent: mockSetBridgeIntent,
      setBridgeSendTxid: mockSetBridgeSendTxid,
      setCashuMintQuote: mockSetCashuMintQuote,
      setCashuMintSendTxid: mockSetCashuMintSendTxid,
      completeSettlement: mockCompleteSettlement,
      markPendingSettlement: mockMarkPendingSettlement,
      markNeedsRetry: mockMarkNeedsRetry,
    })
  );
  vaultSettlementStoreMock.getState.mockReturnValue({
    bridgeClientRequestId,
    cashuMintQuoteId: null,
    cashuMintDepositAddress: null,
    cashuMintQuoteAmount: null,
    cashuMintSendTxid: null,
  });
  (formatVaultSettlementAmountInput as jest.Mock).mockImplementation((amount: number) => amount.toFixed(2));
  (quoteVaultBorrowSettlement as jest.Mock).mockResolvedValue({
    estimatedUsdcOut: '49.50',
    minimumUsdcOut: '49.00',
  });
  (deriveSepoliaAccount as jest.Mock).mockResolvedValue({ address: '0xSepoliaRecipient' });
  (createBridgeIntent as jest.Mock).mockResolvedValue({
    id: 'bridge-intent-1',
    depositAddress: 'tb1pbridge',
  });
  (createUnitIntentService as jest.Mock).mockResolvedValue({
    assetType: 'UNIT',
    amount: 5000,
    recipientAddress: 'tb1pbridge',
    runeUtxos: [
      { transaction: 'unit-input', vout: 0, runeAmount: 6000 },
    ],
    satUtxo: { txid: 'sat-input', vout: 1 },
  });
  (signIntentService as jest.Mock).mockResolvedValue({
    signedTxHex: 'signed-bridge-send',
    txid: 'broadcast-txid',
  });
  (broadcastTransaction as jest.Mock).mockResolvedValue('broadcast-txid');
  (waitForBridgeSettlement as jest.Mock).mockResolvedValue({
    status: 'fulfilled',
    payoutAsset: 'USDC',
    payoutAmount: '49.25',
    sepoliaTxHash: '0xsepolia',
  });
  (requestMint as jest.Mock).mockResolvedValue({
    quoteId: 'cashu-quote-1',
    amount: 5000,
    depositAddress: 'tb1pcashumint',
    state: 'UNPAID',
  });
  (checkMintStatus as jest.Mock).mockResolvedValue({
    quoteId: 'cashu-quote-1',
    state: 'PAID',
    paid: true,
    amountPaid: 5000,
    amountIssued: 0,
    availableAmount: 5000,
  });
  (completeMint as jest.Mock).mockResolvedValue([
    { amount: 3000 },
    { amount: 2000 },
  ]);
  mockBitcoinTransactionFromHex.mockReturnValue({
    ins: [
      {
        hash: Buffer.from(pendingInputHash, 'hex').reverse(),
        index: 2,
      },
    ],
    outs: [
      { script: Buffer.from('0014', 'hex'), value: 546n },
      { script: Buffer.from('6a', 'hex'), value: 0n },
    ],
  });
  mockBitcoinAddressFromOutputScript.mockImplementation((script: Buffer) => {
    if (script[0] === 0x00) {
      return wallet.segwitAddress;
    }
    throw new Error('non-address output');
  });
}

describe('useIssuedUnitSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureIssuedUnitSettlement();
  });

  it('quotes borrow-to-USDC settlement and stores the quote', async () => {
    const { result } = renderHook(() => useIssuedUnitSettlement());

    await expect(result.current.quoteBorrowToUsdc(50)).resolves.toEqual({
      estimatedUsdcOut: '49.50',
      minimumUsdcOut: '49.00',
    });

    expect(quoteVaultBorrowSettlement).toHaveBeenCalledWith(50);
    expect(mockSetQuote).toHaveBeenCalledWith('49.50', '49.00');
  });

  it('creates, signs, broadcasts, tracks, and completes an issued UNIT to USDC settlement', async () => {
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToUsdc('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'settled',
      payoutAsset: 'USDC',
      payoutAmount: '49.25',
      bridgeIntentId: 'bridge-intent-1',
      bridgeSendTxid: 'broadcast-txid',
    });
    expect(deriveSepoliaAccount).toHaveBeenCalledWith(7);
    expect(createBridgeIntent).toHaveBeenCalledWith({
      amount: '50.00',
      autoSwap: true,
      clientRequestId: expect.stringMatching(/^vault_borrow_7_50_00_\d+$/),
      sepoliaRecipient: '0xSepoliaRecipient',
    });
    const clientRequestId = (createBridgeIntent as jest.Mock).mock.calls[0][0].clientRequestId;
    expect(mockSetBridgeClientRequestId).toHaveBeenCalledWith(clientRequestId);
    expect(createUnitIntentService).toHaveBeenCalledWith(
      'tb1pbridge',
      '50.00',
      wallet.taprootAddress,
      wallet.segwitAddress,
      7,
      [{ txid: 'tap-unconfirmed', vout: 0, value: 546, runeAmount: 250 }],
      [{ txid: 'seg-unconfirmed', vout: 1, value: 1200, runeAmount: undefined }],
      [{ txid: 'already-spent', vout: 0 }],
    );
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'creating_bridge',
      'building_bridge_send',
      'signing_bridge_send',
      'broadcasting_bridge_send',
      'waiting_bridge_fulfillment',
    ]);
    expect(mockSetBridgeIntent).toHaveBeenCalledWith('bridge-intent-1', 'tb1pbridge');
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'unit-input', vout: 0 },
      { txid: 'sat-input', vout: 1 },
    ]);
    expect(signIntentService).toHaveBeenCalledWith(
      expect.objectContaining({ recipientAddress: 'tb1pbridge' }),
      7,
    );
    expect(broadcastTransaction).toHaveBeenCalledWith('signed-bridge-send');
    expect(mockSetBridgeSendTxid).toHaveBeenCalledWith('broadcast-txid');
    expect(mockSetBridgeSendTxid.mock.invocationCallOrder[0]).toBeLessThan(
      (broadcastTransaction as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(mockMarkUtxoAsSpent).toHaveBeenCalledWith(pendingInputHash, 2);
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'broadcast-txid',
      [{ address: wallet.segwitAddress, value: 546, vout: 0, runeAmount: 1000 }],
      'UNIT',
      pendingInputHash,
      5000,
      [{ txid: pendingInputHash, vout: 2 }],
    );
    expect(mockAddPendingTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      (broadcastTransaction as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(mockStartPolling).toHaveBeenCalledWith(
      'broadcast-txid',
      expect.any(Function),
      expect.any(Function),
    );
    expect(waitForBridgeSettlement).toHaveBeenCalledWith('bridge-intent-1');
    expect(mockCompleteSettlement).toHaveBeenCalledWith('USDC', '49.25', '0xsepolia');
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
  });

  it('reuses a persisted bridge client request id when retrying settlement creation', async () => {
    configureIssuedUnitSettlement({ bridgeClientRequestId: 'client-existing' });
    const { result } = renderHook(() => useIssuedUnitSettlement());

    await act(async () => {
      await result.current.settleIssuedUnitToUsdc('borrow', 50);
    });

    expect(createBridgeIntent).toHaveBeenCalledWith(expect.objectContaining({
      clientRequestId: 'client-existing',
    }));
    expect(mockSetBridgeClientRequestId).toHaveBeenCalledWith('client-existing');
  });

  it('unlocks reserved inputs and marks retry when signing fails before broadcast', async () => {
    (signIntentService as jest.Mock).mockRejectedValueOnce(new Error('signing failed'));
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToUsdc('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'needs_retry',
      bridgeIntentId: 'bridge-intent-1',
      error: 'signing failed',
    });
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'unit-input', vout: 0 },
      { txid: 'sat-input', vout: 1 },
    ]);
    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'unit-input', vout: 0 },
      { txid: 'sat-input', vout: 1 },
    ]);
    expect(mockMarkNeedsRetry).toHaveBeenCalledWith('signing failed');
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Settlement needs retry',
      description: 'The vault action succeeded, but automatic USDC settlement needs retry.',
      type: 'warning',
      duration: 7000,
    });
    expect(mockSetBridgeSendTxid).not.toHaveBeenCalled();
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
  });

  it('unlocks reserved bridge inputs when pending tracking fails before broadcast', async () => {
    mockAddPendingTransaction.mockRejectedValueOnce(new Error('pending tracking failed'));
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToUsdc('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'needs_retry',
      bridgeIntentId: 'bridge-intent-1',
      error: 'pending tracking failed',
    });
    expect(broadcastTransaction).not.toHaveBeenCalled();
    expect(mockSetBridgeSendTxid).toHaveBeenCalledWith('broadcast-txid');
    expect(mockSetBridgeSendTxid).toHaveBeenLastCalledWith(null);
    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'unit-input', vout: 0 },
      { txid: 'sat-input', vout: 1 },
    ]);
    expect(mockMarkNeedsRetry).toHaveBeenCalledWith('pending tracking failed');
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
  });

  it('returns pending settlement with the bridge send txid when Sepolia fulfillment is still processing', async () => {
    (waitForBridgeSettlement as jest.Mock).mockRejectedValueOnce(
      new Error('Bridge settlement is still processing.'),
    );
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToUsdc('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'pending_settlement',
      bridgeIntentId: 'bridge-intent-1',
      bridgeSendTxid: 'broadcast-txid',
      error: 'Bridge settlement is still processing.',
    });
    expect(mockSetBridgeSendTxid).toHaveBeenCalledWith('broadcast-txid');
    expect(mockMarkPendingSettlement).toHaveBeenCalledWith('Bridge settlement is still processing.');
    expect(mockMarkNeedsRetry).not.toHaveBeenCalled();
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
  });

  it('mints issued UNIT into TurboUNIT through the Cashu onchain quote flow', async () => {
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToTurboUnit('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'settled',
      payoutAsset: 'TURBOUNIT',
      payoutAmount: '50.00',
      cashuMintQuoteId: 'cashu-quote-1',
      cashuMintSendTxid: 'broadcast-txid',
    });
    expect(requestMint).toHaveBeenCalledWith(5000);
    expect(mockSetCashuMintQuote).toHaveBeenCalledWith('cashu-quote-1', 'tb1pcashumint', 5000);
    expect(createUnitIntentService).toHaveBeenCalledWith(
      'tb1pcashumint',
      '50.00',
      wallet.taprootAddress,
      wallet.segwitAddress,
      7,
      [{ txid: 'tap-unconfirmed', vout: 0, value: 546, runeAmount: 250 }],
      [{ txid: 'seg-unconfirmed', vout: 1, value: 1200, runeAmount: undefined }],
      [{ txid: 'already-spent', vout: 0 }],
    );
    expect(mockSetPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'creating_turbo_mint',
      'building_turbo_send',
      'signing_turbo_send',
      'broadcasting_turbo_send',
      'waiting_turbo_mint',
    ]);
    expect(mockSetCashuMintSendTxid).toHaveBeenCalledWith('broadcast-txid');
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'broadcast-txid',
      [{ address: wallet.segwitAddress, value: 546, vout: 0, runeAmount: 1000 }],
      'UNIT',
      pendingInputHash,
      5000,
      [{ txid: pendingInputHash, vout: 2 }],
      { displayKind: 'turbo_mint_claim' },
    );
    expect(mockSetCashuMintSendTxid.mock.invocationCallOrder[0]).toBeLessThan(
      (broadcastTransaction as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(mockAddPendingTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      (broadcastTransaction as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(checkMintStatus).toHaveBeenCalledWith('cashu-quote-1');
    expect(completeMint).toHaveBeenCalledWith('cashu-quote-1', 5000);
    expect(mockConfirmTransaction).toHaveBeenCalledWith('broadcast-txid');
    expect(mockFetchTransactionHistory).toHaveBeenCalled();
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.00');
  });

  it('funds TurboUNIT vault mint sends with the mint quote amount', async () => {
    (requestMint as jest.Mock).mockResolvedValueOnce({
      quoteId: 'cashu-quote-1',
      amount: 5050,
      depositAddress: 'tb1pcashumint',
      state: 'UNPAID',
    });
    (checkMintStatus as jest.Mock).mockResolvedValueOnce({
      quoteId: 'cashu-quote-1',
      state: 'PAID',
      paid: true,
      amountPaid: 5050,
      amountIssued: 0,
      availableAmount: 5050,
    });
    (completeMint as jest.Mock).mockResolvedValueOnce([
      { amount: 3000 },
      { amount: 2050 },
    ]);
    (createUnitIntentService as jest.Mock).mockResolvedValueOnce({
      assetType: 'UNIT',
      amount: 5050,
      recipientAddress: 'tb1pcashumint',
      runeUtxos: [
        { transaction: 'unit-input', vout: 0, runeAmount: 6000 },
      ],
      satUtxo: { txid: 'sat-input', vout: 1 },
    });

    const { result } = renderHook(() => useIssuedUnitSettlement());

    await act(async () => {
      await result.current.settleIssuedUnitToTurboUnit('borrow', 50);
    });

    expect(mockSetCashuMintQuote).toHaveBeenCalledWith('cashu-quote-1', 'tb1pcashumint', 5050);
    expect(createUnitIntentService).toHaveBeenCalledWith(
      'tb1pcashumint',
      '50.50',
      wallet.taprootAddress,
      wallet.segwitAddress,
      7,
      [{ txid: 'tap-unconfirmed', vout: 0, value: 546, runeAmount: 250 }],
      [{ txid: 'seg-unconfirmed', vout: 1, value: 1200, runeAmount: undefined }],
      [{ txid: 'already-spent', vout: 0 }],
    );
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'broadcast-txid',
      [{ address: wallet.segwitAddress, value: 546, vout: 0, runeAmount: 950 }],
      'UNIT',
      pendingInputHash,
      5050,
      [{ txid: pendingInputHash, vout: 2 }],
      { displayKind: 'turbo_mint_claim' },
    );
    expect(completeMint).toHaveBeenCalledWith('cashu-quote-1', 5050);
    expect(mockCompleteSettlement).toHaveBeenCalledWith('TURBOUNIT', '50.50');
  });

  it('unlocks reserved Turbo mint inputs when pending tracking fails before broadcast', async () => {
    mockAddPendingTransaction.mockRejectedValueOnce(new Error('turbo pending tracking failed'));
    const { result } = renderHook(() => useIssuedUnitSettlement());
    let settlementResult: unknown;

    await act(async () => {
      settlementResult = await result.current.settleIssuedUnitToTurboUnit('borrow', 50);
    });

    expect(settlementResult).toEqual({
      status: 'needs_retry',
      cashuMintQuoteId: 'cashu-quote-1',
      error: 'turbo pending tracking failed',
    });
    expect(broadcastTransaction).not.toHaveBeenCalled();
    expect(mockSetCashuMintSendTxid).toHaveBeenCalledWith('broadcast-txid');
    expect(mockSetCashuMintSendTxid).toHaveBeenLastCalledWith(null);
    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'unit-input', vout: 0 },
      { txid: 'sat-input', vout: 1 },
    ]);
    expect(mockMarkNeedsRetry).toHaveBeenCalledWith('turbo pending tracking failed');
    expect(mockCompleteSettlement).not.toHaveBeenCalled();
  });

  it('rejects settlement immediately when wallet addresses are missing', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      wallet: { taprootAddress: null, segwitAddress: null },
      currentAccount: 7,
    });
    const { result } = renderHook(() => useIssuedUnitSettlement());

    await expect(result.current.settleIssuedUnitToUsdc('borrow', 50))
      .rejects
      .toThrow('Wallet not connected');
    expect(createBridgeIntent).not.toHaveBeenCalled();
  });
});
