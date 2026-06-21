import { act, renderHook } from '@testing-library/react-native';
import { useVaultOperation } from '../useVaultOperation';

const mockSetPendingVaultTransaction = jest.fn().mockResolvedValue(undefined);
const mockSetPendingVaultTransactionForAccount = jest.fn().mockResolvedValue(undefined);
const mockClearPendingVaultTransactionForAccount = jest.fn().mockResolvedValue(undefined);
const mockDiscardPendingVaultTransactionForAccount = jest.fn().mockResolvedValue(undefined);
const mockAddPendingTransaction = jest.fn().mockResolvedValue(undefined);
const mockInvalidatePendingTransaction = jest.fn().mockResolvedValue([]);
const mockMarkUtxoAsSpent = jest.fn().mockResolvedValue(undefined);
const mockMarkUtxosAsSpent = jest.fn().mockResolvedValue(undefined);
const mockUnmarkUtxosAsSpent = jest.fn().mockResolvedValue(undefined);
const mockShowSnackbar = jest.fn();
const mockWatchTransaction = jest.fn();
const mockGetJsonWithNativeTimeout = jest.fn();

const mockPendingStoreState = {
  pendingTransactions: {} as Record<string, { status: string }>,
  addPendingTransaction: mockAddPendingTransaction,
  invalidateTransaction: mockInvalidatePendingTransaction,
  markUtxoAsSpent: mockMarkUtxoAsSpent,
  markUtxosAsSpent: mockMarkUtxosAsSpent,
  unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
};

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/nativeHttp', () => ({
  getJsonWithNativeTimeout: (...args: unknown[]) => mockGetJsonWithNativeTimeout(...args),
}));

jest.mock('../../../contexts/WalletContext', () => ({
  useWallet: jest.fn(() => ({
    wallet: {
      segwitAddress: 'tb1qwallet',
      segwitPubkey: 'segwit-pubkey',
      taprootAddress: 'tb1pwallet',
      taprootPubkey: 'taproot-pubkey',
    },
    currentAccount: 0,
  })),
}));

jest.mock('../../../contexts/WalletDataContext', () => ({
  useVaultData: jest.fn(() => ({
    vaultData: {
      totalDebt: 100,
      totalCollateral: 1,
      vaultId: 'vault-id',
    },
    vaultTransactions: [],
  })),
}));

jest.mock('../../../stores/priceStore', () => ({
  usePrice: jest.fn(() => ({ btcPrice: 100000 })),
}));

jest.mock('../../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: jest.fn((selector) =>
    selector({
      pendingTransaction: null,
      setPendingTransaction: mockSetPendingVaultTransaction,
      setPendingTransactionForAccount: mockSetPendingVaultTransactionForAccount,
      clearPendingTransactionForAccount: mockClearPendingVaultTransactionForAccount,
      discardPendingTransactionForAccount: mockDiscardPendingVaultTransactionForAccount,
    })
  ),
}));

jest.mock('../../../stores/pendingTransactionsStore', () => {
  const usePendingTransactionsStore = jest.fn((selector) =>
    selector(mockPendingStoreState)
  ) as jest.Mock & { getState: jest.Mock };
  usePendingTransactionsStore.getState = jest.fn(() => mockPendingStoreState);

  return {
    usePendingTransactionsStore,
  };
});

jest.mock('../../../stores/notificationStore', () => ({
  useNotificationStore: jest.fn((selector) =>
    selector({
      showSnackbar: mockShowSnackbar,
    })
  ),
}));

jest.mock('../../../stores/vaultSettlementStore', () => {
  const useVaultSettlementStore = jest.fn() as jest.Mock & { getState: jest.Mock };
  useVaultSettlementStore.getState = jest.fn(() => ({ kind: null, phase: 'idle' }));
  return { useVaultSettlementStore };
});

jest.mock('../../../services/guardianService', () => ({
  getGuardianClient: jest.fn().mockResolvedValue({ guardian: true }),
  disconnectGuardian: jest.fn(),
}));

jest.mock('../../../services/oracleService', () => ({
  fetchPriceQuote: jest.fn().mockResolvedValue({ latest_stamp: Math.floor(Date.now() / 1000) }),
}));

jest.mock('../../../services/vaultOperationsService', () => ({
  buildVaultProfile: jest.fn(() => ({
    acct_id: 'acct-id',
    guard_pk: 'guard-pk',
    master_id: 'master-id',
    vault_pk: 'vault-pk',
    rdata: {},
    utxo: {},
  })),
  computeVaultPrevoutFromTx: jest.fn(() => ({ txid: 'prevout', vout: 0 })),
  resolveLatestUnspentVaultPrevout: jest.fn((prevout) =>
    Promise.resolve({
      prevout,
      replaced: false,
      hopCount: 0,
      sourceTxids: ['prevout'],
    })
  ),
}));

jest.mock('../../../services/vaultService', () => ({
  fetchVaultData: jest.fn().mockResolvedValue({
    vaultInfo: { ok: true },
    vaultId: 'vault-id',
  }),
  fetchLatestVaultHistoryTransaction: jest.fn().mockResolvedValue({ txid: 'latest-vault-tx' }),
  selectLatestUsableVaultHistoryTransaction: jest.fn((transactions) =>
    [...transactions]
      .filter((transaction) => transaction.transaction_id && transaction.utxo)
      .sort((left, right) => right.timestamp - left.timestamp)[0]
  ),
}));

jest.mock('../../../services/vaultWalletService', () => ({
  createVaultWallet: jest.fn().mockResolvedValue({ wallet: true }),
}));

jest.mock('../../../services/analyticsService', () => ({
  analytics: {
    track: jest.fn(),
    trackTransaction: jest.fn(),
  },
}));

jest.mock('../../../services/pushNotificationService', () => ({
  watchTransaction: mockWatchTransaction,
}));

jest.mock('../../../services/vault/pendingIssueOutputs', () => ({
  extractVaultIssuePendingData: jest.fn(() => ({
    outputs: [],
    spentInputs: [],
    parentTxid: null,
  })),
  extractVaultFinalizationPendingData: jest.fn(() => ({
    outputs: [],
    spentInputs: [],
    parentTxid: null,
  })),
}));

const makeActions = () => ({
  setLoading: jest.fn(),
  setError: jest.fn(),
  setVaultTxid: jest.fn(),
  setCurrentStep: jest.fn(),
  setProcessingStep: jest.fn(),
  setCurrentVaultData: jest.fn(),
  setBitcoinPrice: jest.fn(),
  reset: jest.fn(),
});

const flushPromises = async (count = 8): Promise<void> => {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
};

describe('useVaultOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useVaultData } = require('../../../contexts/WalletDataContext');
    useVaultData.mockReturnValue({
      vaultData: {
        totalDebt: 100,
        totalCollateral: 1,
        vaultId: 'vault-id',
      },
      vaultTransactions: [],
    });
    mockPendingStoreState.pendingTransactions = {};
    mockAddPendingTransaction.mockResolvedValue(undefined);
    mockInvalidatePendingTransaction.mockResolvedValue([]);
    mockGetJsonWithNativeTimeout.mockReset();
    mockGetJsonWithNativeTimeout.mockResolvedValue({ status: { confirmed: false } });
    mockMarkUtxoAsSpent.mockResolvedValue(undefined);
    mockMarkUtxosAsSpent.mockResolvedValue(undefined);
    mockUnmarkUtxosAsSpent.mockResolvedValue(undefined);
    mockSetPendingVaultTransactionForAccount.mockResolvedValue(undefined);
    mockClearPendingVaultTransactionForAccount.mockResolvedValue(undefined);
    mockDiscardPendingVaultTransactionForAccount.mockResolvedValue(undefined);
    const { useVaultSettlementStore } = require('../../../stores/vaultSettlementStore');
    useVaultSettlementStore.getState.mockReturnValue({ kind: null, phase: 'idle' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks finalization-only vault transactions in the wallet pending store', async () => {
    const {
      extractVaultFinalizationPendingData,
    } = require('../../../services/vault/pendingIssueOutputs');
    const spentInputs = [{ txid: 'vault-input-txid', vout: 0 }];
    const expectedSpentInputs = [...spentInputs, { txid: 'prevout', vout: 0 }];
    extractVaultFinalizationPendingData.mockReturnValueOnce({
      outputs: [],
      spentInputs,
      parentTxid: null,
    });

    const actions = makeActions();
    const config = {
      operationType: 'deposit',
      operationName: 'testDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ deposit_amount: 50_000 }),
      createRequest: jest
        .fn()
        .mockResolvedValue({ vault_txhex: 'vault-txhex', vault_txid: 'vault-final-txid' }),
      sendRequest: jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' }),
      extractResult: () => ({ vaultTxid: 'vault-final-txid' }),
      createPendingTransaction: () => ({
        txid: 'vault-final-txid',
        vaultTxid: 'vault-final-txid',
        action: 'deposit',
        btcAmt: 50_000,
        unitAmt: 0,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(mockSetPendingVaultTransactionForAccount).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'vault-final-txid', action: 'deposit' }),
      0
    );
    expect(extractVaultFinalizationPendingData).toHaveBeenCalledWith(
      expect.objectContaining({ vault_txhex: 'vault-txhex' }),
      expect.objectContaining({ taprootAddress: 'tb1pwallet' }),
      expect.any(Object),
      undefined
    );
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith(expectedSpentInputs);
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'vault-final-txid',
      [],
      'BTC',
      null,
      undefined,
      expectedSpentInputs
    );
  });

  it('passes the borrowed UNIT amount into finalization pending extraction', async () => {
    const {
      extractVaultFinalizationPendingData,
    } = require('../../../services/vault/pendingIssueOutputs');
    const borrowRequest = {
      issue_txhex: 'issue-txhex',
      vault_txhex: 'vault-txhex',
      vault_txid: 'borrow-vault-txid',
    };
    const actions = makeActions();
    const config = {
      operationType: 'borrow',
      operationName: 'testBorrow',
      needsReservation: false,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 123,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ borrow_amount: 12_300 }),
      createRequest: jest.fn().mockResolvedValue(borrowRequest),
      sendRequest: jest.fn().mockResolvedValue({
        txid: 'borrow-issue-txid',
        vault_txid: 'borrow-vault-txid',
      }),
      extractResult: () => ({ txid: 'borrow-issue-txid', vaultTxid: 'borrow-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'borrow-issue-txid',
        vaultTxid: 'borrow-vault-txid',
        action: 'borrow',
        btcAmt: 0,
        unitAmt: 12_300,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(extractVaultFinalizationPendingData).toHaveBeenCalledWith(
      borrowRequest,
      expect.objectContaining({ taprootAddress: 'tb1pwallet' }),
      expect.any(Object),
      12_300
    );
  });

  it('locks the active vault prevout when finalization txhex is unavailable', async () => {
    const activeVaultInput = [{ txid: 'prevout', vout: 0 }];
    const actions = makeActions();
    const config = {
      operationType: 'deposit',
      operationName: 'testDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ deposit_amount: 50_000 }),
      createRequest: jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' }),
      sendRequest: jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' }),
      extractResult: () => ({ vaultTxid: 'vault-final-txid' }),
      createPendingTransaction: () => ({
        txid: 'vault-final-txid',
        vaultTxid: 'vault-final-txid',
        action: 'deposit',
        btcAmt: 50_000,
        unitAmt: 0,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith(activeVaultInput);
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'vault-final-txid',
      [],
      'BTC',
      null,
      undefined,
      activeVaultInput
    );
  });

  it('uses cached vault data and history when building a vault profile for an operation', async () => {
    const { useVaultData } = require('../../../contexts/WalletDataContext');
    const {
      fetchVaultData,
      fetchLatestVaultHistoryTransaction,
    } = require('../../../services/vaultService');
    const {
      buildVaultProfile,
      computeVaultPrevoutFromTx,
      resolveLatestUnspentVaultPrevout,
    } = require('../../../services/vaultOperationsService');
    const staleHistoryTx = {
      transaction_id: 'stale-history-txid',
      utxo: 'stale-history-txid:0',
      utxo_script: '5120',
      amount_borrowed: 100,
      oracle_price: 100000,
      timestamp: 100,
      action: 'borrow',
      vault_amount: 40000,
    };
    const cachedHistoryTx = {
      transaction_id: 'cached-history-txid',
      utxo: 'cached-history-txid:0',
      utxo_script: '5120',
      amount_borrowed: 100,
      oracle_price: 100000,
      timestamp: 123,
      action: 'deposit',
      vault_amount: 50000,
    };
    useVaultData.mockReturnValue({
      vaultData: {
        totalDebt: 100,
        totalCollateral: 1,
        vaultId: 'vault-id',
        vaultInfo: {
          creation_account: 'acct-id',
          guard_pubkey: 'guard-pk',
          master_id: 'master-id',
        },
      },
      vaultTransactions: [staleHistoryTx, cachedHistoryTx],
    });

    const actions = makeActions();
    const createRequest = jest.fn().mockResolvedValue({
      vault_txhex: 'vault-txhex',
      vault_txid: 'vault-final-txid',
    });
    const config = {
      operationType: 'deposit',
      operationName: 'testDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ deposit_amount: 50_000 }),
      createRequest,
      sendRequest: jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' }),
      extractResult: () => ({ vaultTxid: 'vault-final-txid' }),
      createPendingTransaction: () => ({
        txid: 'vault-final-txid',
        vaultTxid: 'vault-final-txid',
        action: 'deposit',
        btcAmt: 50_000,
        unitAmt: 0,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(fetchVaultData).not.toHaveBeenCalled();
    expect(fetchLatestVaultHistoryTransaction).not.toHaveBeenCalled();
    expect(computeVaultPrevoutFromTx).toHaveBeenCalledWith(cachedHistoryTx);
    expect(resolveLatestUnspentVaultPrevout).toHaveBeenCalledWith({ txid: 'prevout', vout: 0 });
    expect(buildVaultProfile).toHaveBeenCalledWith(
      'taproot-pubkey',
      expect.objectContaining({ creation_account: 'acct-id' }),
      { txid: 'prevout', vout: 0 }
    );
    expect(createRequest).toHaveBeenCalled();
  });

  it('rolls back vault recovery locks when local pending tracking fails before guardian submit', async () => {
    const {
      extractVaultFinalizationPendingData,
    } = require('../../../services/vault/pendingIssueOutputs');
    const spentInputs = [{ txid: 'vault-input-txid', vout: 0 }];
    const expectedSpentInputs = [...spentInputs, { txid: 'prevout', vout: 0 }];
    const sendRequest = jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' });
    mockAddPendingTransaction.mockRejectedValueOnce(new Error('pending storage failed'));
    extractVaultFinalizationPendingData.mockReturnValueOnce({
      outputs: [],
      spentInputs,
      parentTxid: null,
    });

    const actions = makeActions();
    const config = {
      operationType: 'deposit',
      operationName: 'testDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ deposit_amount: 50_000 }),
      createRequest: jest
        .fn()
        .mockResolvedValue({ vault_txhex: 'vault-txhex', vault_txid: 'vault-final-txid' }),
      sendRequest,
      extractResult: () => ({ vaultTxid: 'vault-final-txid' }),
      createPendingTransaction: () => ({
        txid: 'vault-final-txid',
        vaultTxid: 'vault-final-txid',
        action: 'deposit',
        btcAmt: 50_000,
        unitAmt: 0,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(mockSetPendingVaultTransactionForAccount).toHaveBeenCalled();
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith(expectedSpentInputs);
    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith(expectedSpentInputs);
    expect(mockDiscardPendingVaultTransactionForAccount).toHaveBeenCalledWith(
      0,
      'vault-final-txid',
      expect.any(Error)
    );
    expect(actions.setError).toHaveBeenCalledWith('pending storage failed');
  });

  it('discards local recovery when guardian rejects before request txids reach the mempool', async () => {
    jest.useFakeTimers();
    mockGetJsonWithNativeTimeout.mockRejectedValue(new Error('HTTP 404: Not Found'));

    const actions = makeActions();
    const guardianError = { message: 'guardian rejected repay' };
    const sendRequest = jest.fn().mockRejectedValue(guardianError);
    const config = {
      operationType: 'repay',
      operationName: 'testRepay',
      needsReservation: false,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ repay_amount: 50_000 }),
      createRequest: jest.fn().mockResolvedValue({
        repay_txid: 'repay-issue-txid',
        vault_txid: 'repay-vault-txid',
      }),
      sendRequest,
      extractResult: () => ({ txid: 'repay-issue-txid', vaultTxid: 'repay-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'repay-issue-txid',
        vaultTxid: 'repay-vault-txid',
        action: 'repay',
        btcAmt: 0,
        unitAmt: 50_000,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));
    let outcome: unknown;
    let executePromise: Promise<unknown>;

    await act(async () => {
      executePromise = result.current.execute();
      await flushPromises(30);
    });

    expect(sendRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises(30);
      jest.runOnlyPendingTimers();
      await flushPromises(30);
      outcome = await executePromise;
    });

    expect(outcome).toBeNull();
    expect(mockDiscardPendingVaultTransactionForAccount).toHaveBeenCalledWith(
      0,
      'repay-vault-txid',
      guardianError
    );
    expect(mockInvalidatePendingTransaction).toHaveBeenCalledWith(
      'repay-issue-txid',
      'guardian rejected repay'
    );
    expect(mockInvalidatePendingTransaction).toHaveBeenCalledWith(
      'repay-vault-txid',
      'guardian rejected repay'
    );
    expect(actions.setError).toHaveBeenCalledWith('guardian rejected repay');
  });

  it('refuses to submit to guardian when request txids cannot be checkpointed first', async () => {
    const actions = makeActions();
    const sendRequest = jest.fn().mockResolvedValue({ vault_txid: 'vault-final-txid' });
    const config = {
      operationType: 'deposit',
      operationName: 'testDeposit',
      needsReservation: false,
      hasIssueTxid: false,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ deposit_amount: 50_000 }),
      createRequest: jest.fn().mockResolvedValue({ vault_txhex: 'vault-txhex' }),
      sendRequest,
      extractResult: () => ({ vaultTxid: 'vault-final-txid' }),
      createPendingTransaction: () => ({
        txid: 'vault-final-txid',
        vaultTxid: 'vault-final-txid',
        action: 'deposit',
        btcAmt: 50_000,
        unitAmt: 0,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(mockSetPendingVaultTransactionForAccount).not.toHaveBeenCalled();
    expect(actions.setError).toHaveBeenCalledWith(
      'testDeposit request did not include transaction IDs; refusing to submit without a recovery checkpoint.'
    );
  });

  it('keeps repay settlement finalization on the final visible processing step', async () => {
    const { useVaultSettlementStore } = require('../../../stores/vaultSettlementStore');
    useVaultSettlementStore.getState.mockReturnValue({
      kind: 'repay',
      phase: 'repaying_vault',
    });

    const actions = makeActions();
    const createRequest = jest.fn().mockResolvedValue({
      repay_txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const sendRequest = jest.fn().mockResolvedValue({
      txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const config = {
      operationType: 'repay',
      operationName: 'testRepay',
      needsReservation: false,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ repay_amount: 50_000 }),
      createRequest,
      sendRequest,
      extractResult: () => ({ txid: 'repay-issue-txid', vaultTxid: 'repay-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'repay-issue-txid',
        vaultTxid: 'repay-vault-txid',
        action: 'repay',
        btcAmt: 0,
        unitAmt: 50_000,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));

    await act(async () => {
      await result.current.execute();
    });

    expect(createRequest).toHaveBeenCalled();
    expect(sendRequest).toHaveBeenCalled();
    expect(actions.setProcessingStep).toHaveBeenCalledWith(4);
    expect(actions.setProcessingStep).not.toHaveBeenCalledWith(1);
    expect(actions.setProcessingStep).not.toHaveBeenCalledWith(2);
    expect(actions.setProcessingStep).not.toHaveBeenCalledWith(3);
  });

  it('times out when request creation hangs while building a repay transaction', async () => {
    jest.useFakeTimers();

    const actions = makeActions();
    const createRequest = jest.fn(() => new Promise(() => undefined));
    const sendRequest = jest.fn().mockResolvedValue({
      txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const config = {
      operationType: 'repay',
      operationName: 'testRepay',
      needsReservation: false,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ repay_amount: 50_000 }),
      createRequest,
      sendRequest,
      extractResult: () => ({ txid: 'repay-issue-txid', vaultTxid: 'repay-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'repay-issue-txid',
        vaultTxid: 'repay-vault-txid',
        action: 'repay',
        btcAmt: 0,
        unitAmt: 50_000,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));
    let outcome: unknown;
    let executePromise: Promise<unknown>;

    await act(async () => {
      executePromise = result.current.execute();
      await flushPromises(20);
    });

    expect(createRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.runOnlyPendingTimers();
      outcome = await executePromise;
    });

    expect(outcome).toBeNull();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(actions.setCurrentStep).toHaveBeenCalledWith('confirm');
    expect(actions.setError).toHaveBeenCalledWith(
      'Timed out building the repay transaction. Please try again.'
    );
  });

  it('times out when oracle quote fetching hangs while building a repay transaction', async () => {
    jest.useFakeTimers();

    const { fetchPriceQuote } = require('../../../services/oracleService');
    fetchPriceQuote.mockImplementationOnce(() => new Promise(() => undefined));

    const actions = makeActions();
    const createRequest = jest.fn().mockResolvedValue({
      repay_txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const sendRequest = jest.fn().mockResolvedValue({
      txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const config = {
      operationType: 'repay',
      operationName: 'testRepay',
      needsReservation: false,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ repay_amount: 50_000 }),
      createRequest,
      sendRequest,
      extractResult: () => ({ txid: 'repay-issue-txid', vaultTxid: 'repay-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'repay-issue-txid',
        vaultTxid: 'repay-vault-txid',
        action: 'repay',
        btcAmt: 0,
        unitAmt: 50_000,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));
    let outcome: unknown;
    let executePromise: Promise<unknown>;

    await act(async () => {
      executePromise = result.current.execute();
      await flushPromises(20);
    });

    expect(createRequest).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
      outcome = await executePromise;
    });

    expect(outcome).toBeNull();
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(actions.setCurrentStep).toHaveBeenCalledWith('confirm');
    expect(actions.setError).toHaveBeenCalledWith(
      'Timed out fetching oracle price quote. Please try again.'
    );
  });

  it('times out when guardian connection hangs before building a repay transaction', async () => {
    jest.useFakeTimers();

    const { getGuardianClient } = require('../../../services/guardianService');
    getGuardianClient.mockImplementationOnce(() => new Promise(() => undefined));

    const actions = makeActions();
    const createRequest = jest.fn().mockResolvedValue({
      repay_txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const sendRequest = jest.fn().mockResolvedValue({
      txid: 'repay-issue-txid',
      vault_txid: 'repay-vault-txid',
    });
    const config = {
      operationType: 'repay',
      operationName: 'testRepay',
      needsReservation: true,
      hasIssueTxid: true,
      useStore: () => ({
        state: {
          amount: 50_000,
          selectedFeeRate: 5,
          currentUnitBorrowed: 100,
          currentBtcLocked: 1,
          loading: false,
          error: null,
          vaultTxid: null,
        },
        actions,
      }),
      validate: () => null,
      createConfig: () => ({ repay_amount: 50_000 }),
      createRequest,
      performReservation: jest.fn().mockResolvedValue({ mint_account: 'mint-account' }),
      sendRequest,
      extractResult: () => ({ txid: 'repay-issue-txid', vaultTxid: 'repay-vault-txid' }),
      createPendingTransaction: () => ({
        txid: 'repay-issue-txid',
        vaultTxid: 'repay-vault-txid',
        action: 'repay',
        btcAmt: 0,
        unitAmt: 50_000,
        timestamp: 123,
        vaultPubkey: 'taproot-pubkey',
      }),
      calculateLiquidationPrice: () => 50000,
    };

    const { result } = renderHook(() => useVaultOperation(config as any));
    let outcome: unknown;
    let executePromise: Promise<unknown>;

    await act(async () => {
      executePromise = result.current.execute();
      await flushPromises(20);
    });

    expect(createRequest).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      outcome = await executePromise;
    });

    expect(outcome).toBeNull();
    expect(createRequest).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(actions.setCurrentStep).toHaveBeenCalledWith('confirm');
    expect(actions.setError).toHaveBeenCalledWith(
      'Timed out connecting to Guardian. Please try again.'
    );
  });
});
