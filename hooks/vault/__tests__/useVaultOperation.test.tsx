import { act, renderHook } from '@testing-library/react-native';
import { useVaultOperation } from '../useVaultOperation';

const mockSetPendingVaultTransaction = jest.fn().mockResolvedValue(undefined);
const mockSetPendingVaultTransactionForAccount = jest.fn().mockResolvedValue(undefined);
const mockClearPendingVaultTransactionForAccount = jest.fn().mockResolvedValue(undefined);
const mockAddPendingTransaction = jest.fn().mockResolvedValue(undefined);
const mockMarkUtxoAsSpent = jest.fn().mockResolvedValue(undefined);
const mockMarkUtxosAsSpent = jest.fn().mockResolvedValue(undefined);
const mockUnmarkUtxosAsSpent = jest.fn().mockResolvedValue(undefined);
const mockShowSnackbar = jest.fn();
const mockWatchTransaction = jest.fn();

const mockPendingStoreState = {
  pendingTransactions: {} as Record<string, { status: string }>,
  addPendingTransaction: mockAddPendingTransaction,
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
  })),
}));

jest.mock('../../../stores/priceStore', () => ({
  usePrice: jest.fn(() => ({ btcPrice: 100000 })),
}));

jest.mock('../../../stores/pendingVaultTransactionStore', () => ({
  usePendingVaultTransactionStore: jest.fn((selector) =>
    selector({
      setPendingTransaction: mockSetPendingVaultTransaction,
      setPendingTransactionForAccount: mockSetPendingVaultTransactionForAccount,
      clearPendingTransactionForAccount: mockClearPendingVaultTransactionForAccount,
    })
  ),
}));

jest.mock('../../../stores/pendingTransactionsStore', () => {
  const usePendingTransactionsStore = jest.fn((selector) => selector(mockPendingStoreState)) as
    jest.Mock & { getState: jest.Mock };
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
}));

jest.mock('../../../services/vaultService', () => ({
  fetchVaultData: jest.fn().mockResolvedValue({
    vaultInfo: { ok: true },
    vaultId: 'vault-id',
  }),
  fetchLatestVaultHistoryTransaction: jest.fn().mockResolvedValue({ txid: 'latest-vault-tx' }),
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

describe('useVaultOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingStoreState.pendingTransactions = {};
    mockAddPendingTransaction.mockResolvedValue(undefined);
    mockMarkUtxoAsSpent.mockResolvedValue(undefined);
    mockMarkUtxosAsSpent.mockResolvedValue(undefined);
    mockUnmarkUtxosAsSpent.mockResolvedValue(undefined);
    mockSetPendingVaultTransactionForAccount.mockResolvedValue(undefined);
    mockClearPendingVaultTransactionForAccount.mockResolvedValue(undefined);
  });

  it('tracks finalization-only vault transactions in the wallet pending store', async () => {
    const { extractVaultFinalizationPendingData } = require('../../../services/vault/pendingIssueOutputs');
    const spentInputs = [{ txid: 'vault-input-txid', vout: 0 }];
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
      createRequest: jest.fn().mockResolvedValue({ vault_txhex: 'vault-txhex', vault_txid: 'vault-final-txid' }),
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
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith(spentInputs);
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'vault-final-txid',
      [],
      'BTC',
      null,
      undefined,
      spentInputs,
    );
  });

  it('rolls back vault recovery locks when local pending tracking fails before guardian submit', async () => {
    const { extractVaultFinalizationPendingData } = require('../../../services/vault/pendingIssueOutputs');
    const spentInputs = [{ txid: 'vault-input-txid', vout: 0 }];
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
      createRequest: jest.fn().mockResolvedValue({ vault_txhex: 'vault-txhex', vault_txid: 'vault-final-txid' }),
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
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith(spentInputs);
    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith(spentInputs);
    expect(mockClearPendingVaultTransactionForAccount).toHaveBeenCalledWith(0);
    expect(actions.setError).toHaveBeenCalledWith('pending storage failed');
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
});
