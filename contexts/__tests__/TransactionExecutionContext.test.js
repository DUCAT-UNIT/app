/**
 * Tests for TransactionExecutionContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import {
  TransactionExecutionProvider,
  useTransactionExecution,
} from '../TransactionExecutionContext';
import { useSendFlow } from '../SendFlowContext';
import { useTransactionBuild } from '../TransactionBuildContext';
import { useWallet } from '../WalletContext';
import { usePendingTransactions } from '../PendingTransactionsContext';
import * as TransactionService from '../../services/transaction';
import * as TransactionSigningService from '../../services/transactionSigningService';
import * as TransactionBroadcastService from '../../services/transactionBroadcastService';
import * as BackgroundTaskService from '../../services/backgroundTaskService';
import { ERRORS } from '../../utils/messages';
import * as bitcoin from 'bitcoinjs-lib';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component.update, unmount: component.unmount };
}

// Mock dependencies
jest.mock('../SendFlowContext');
jest.mock('../TransactionBuildContext');
jest.mock('../WalletContext');
jest.mock('../PendingTransactionsContext');
jest.mock('../../services/transaction');
jest.mock('../../services/transactionSigningService');
jest.mock('../../services/transactionBroadcastService');
jest.mock('../../services/backgroundTaskService', () => ({
  addPendingTransaction: jest.fn(),
  removePendingTransaction: jest.fn(),
}));

describe('TransactionExecutionContext', () => {
  const mockShowToast = jest.fn();
  const mockSetIntentStep = jest.fn();
  const mockSetSendIntent = jest.fn();
  const mockStartTransactionPolling = jest.fn();
  const mockSendTransactionConfirmedNotification = jest.fn();
  const mockFetchBalance = jest.fn();

  const mockIntent = {
    psbt: 'mock_psbt',
    fee: 1000,
  };

  const mockSignedIntent = {
    psbt: 'mock_psbt',
    fee: 1000,
    signedTxHex: 'signed_hex',
    txid: 'mock_txid',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore all spies

    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'btc',
      sendAmount: '0.001',
    });

    useTransactionBuild.mockReturnValue({
      sendIntent: mockIntent,
      setSendIntent: mockSetSendIntent,
    });

    useWallet.mockReturnValue({
      wallet: {
        segwitAddress: 'tb1qtest',
        taprootAddress: 'tb1ptest',
      },
    });

    usePendingTransactions.mockReturnValue({
      pendingTransactions: {},
      addPendingTransaction: jest.fn(),
      confirmTransaction: jest.fn(),
      invalidateTransaction: jest.fn(),
      markUtxoAsSpent: jest.fn(),
      markUtxosAsSpent: jest.fn(),
    });

    TransactionSigningService.signIntent = jest.fn().mockResolvedValue(mockSignedIntent);
    TransactionBroadcastService.broadcastTransaction = jest.fn().mockResolvedValue('mock_txid');
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTransactionExecution());
    }).toThrow('useTransactionExecution must be used within a TransactionExecutionProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    expect(result.current.broadcastedTxid).toBe(null);
    expect(result.current.toastDismissed).toBe(false);
  });

  it('should sign intent successfully', async () => {
    TransactionService.signIntent.mockResolvedValue({
      signedTxHex: 'signed_hex',
      txid: 'mock_txid',
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.signIntent();
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('signing');
    expect(TransactionService.signIntent).toHaveBeenCalledWith(mockIntent, 0);
    expect(mockSetSendIntent).toHaveBeenCalledWith(mockSignedIntent);
    expect(mockSetIntentStep).toHaveBeenCalledWith('broadcasting');
  });

  it('should handle missing intent when signing', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: null,
      setSendIntent: mockSetSendIntent,
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.signIntent();
    });

    expect(mockShowToast).toHaveBeenCalledWith(ERRORS.TRANSACTION_CANCELLED, 'error');
    expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
    expect(TransactionService.signIntent).not.toHaveBeenCalled();
  });

  it('should handle signing error', async () => {
    TransactionService.signIntent.mockRejectedValue(new Error('Signing failed'));

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.signIntent();
    });

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][1]).toBe('error');
    expect(mockSetIntentStep).toHaveBeenCalledWith('reviewing');
  });

  it('should broadcast intent successfully with BTC', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    expect(TransactionService.broadcastTransaction).toHaveBeenCalledWith('signed_hex');
    expect(result.current.broadcastedTxid).toBe('mock_txid');
    expect(mockSetIntentStep).toHaveBeenCalledWith('pending');
    expect(BackgroundTaskService.addPendingTransaction).toHaveBeenCalledWith(
      'mock_txid',
      'BTC',
      '0.001',
      'withdraw'
    );
    expect(mockStartTransactionPolling).toHaveBeenCalled();
  });

  it('should broadcast UNIT intent successfully', async () => {
    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'unit',
      sendAmount: '100',
    });

    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_unit');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    expect(BackgroundTaskService.addPendingTransaction).toHaveBeenCalledWith(
      'mock_txid_unit',
      'UNIT',
      '100',
      'withdraw'
    );
  });

  it('should handle missing signed transaction when broadcasting', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockIntent, // Not signed (no signedTxHex)
      setSendIntent: mockSetSendIntent,
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    expect(mockShowToast).toHaveBeenCalledWith(ERRORS.TRANSACTION_CANCELLED, 'error');
    expect(TransactionService.broadcastTransaction).not.toHaveBeenCalled();
  });

  it('should handle broadcast error', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][1]).toBe('error');
    expect(mockSetIntentStep).toHaveBeenCalledWith('reviewing');
  });

  it('should send notification when transaction confirms', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

    let confirmCallback;
    mockStartTransactionPolling.mockImplementation((txid, onConfirm) => {
      confirmCallback = onConfirm;
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    // Simulate confirmation
    act(() => {
      confirmCallback(true);
    });

    expect(mockSendTransactionConfirmedNotification).toHaveBeenCalledWith(
      'BTC',
      '0.001',
      'mock_txid',
      'withdraw'
    );
    expect(BackgroundTaskService.removePendingTransaction).toHaveBeenCalledWith('mock_txid');
    expect(mockSetIntentStep).toHaveBeenCalledWith('confirmed');
    expect(mockFetchBalance).toHaveBeenCalled();
  });

  it('should not send notification when disabled', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

    let confirmCallback;
    mockStartTransactionPolling.mockImplementation((txid, onConfirm) => {
      confirmCallback = onConfirm;
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={false}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    act(() => {
      confirmCallback(true);
    });

    expect(mockSendTransactionConfirmedNotification).not.toHaveBeenCalled();
    expect(mockSetIntentStep).toHaveBeenCalledWith('confirmed');
  });

  it('should handle polling error gracefully', async () => {
    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

    let errorCallback;
    mockStartTransactionPolling.mockImplementation((txid, onConfirm, onError) => {
      errorCallback = onError;
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    // Simulate polling error
    act(() => {
      errorCallback(new Error('Polling timeout'));
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('confirmed');
    expect(mockFetchBalance).toHaveBeenCalled();
  });

  it('should reset toastDismissed when broadcastedTxid changes', () => {
    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showToast={mockShowToast}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    // Set toastDismissed to true
    act(() => {
      result.current.setToastDismissed(true);
    });

    expect(result.current.toastDismissed).toBe(true);

    // Set broadcastedTxid (should reset toastDismissed via useEffect)
    act(() => {
      result.current.setBroadcastedTxid('new_txid');
    });

    expect(result.current.toastDismissed).toBe(false);
  });

  describe('Transaction Output Extraction', () => {
    it('should extract BTC change outputs and track as pending', async () => {
      const mockAddPendingTransaction = jest.fn();

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock bitcoin.Transaction.fromHex to return a transaction with change output
      const mockTx = {
        ins: [
          { hash: Buffer.from('a'.repeat(64), 'hex') }
        ],
        outs: [
          {
            script: Buffer.from('mock_script_1'),
            value: 50000,
          },
          {
            script: Buffer.from('mock_script_2'),
            value: 10000,
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      // Mock address decoding - first output is recipient, second is change
      jest.spyOn(bitcoin.address, 'fromOutputScript')
        .mockReturnValueOnce('bc1qrecipient')
        .mockReturnValueOnce('tb1qtest'); // Our segwit address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Verify change output was tracked
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid',
        [{ address: 'tb1qtest', value: 10000, vout: 1 }],
        'BTC',
        null // No parent
      );
    });

    it('should extract UNIT change outputs with rune amount', async () => {
      const mockAddPendingTransaction = jest.fn();

      useSendFlow.mockReturnValue({
        setIntentStep: mockSetIntentStep,
        sendAssetType: 'unit',
        sendAmount: '100',
      });

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock transaction with rune return output
      const mockTx = {
        ins: [
          { hash: Buffer.from('a'.repeat(64), 'hex') }
        ],
        outs: [
          {
            script: Buffer.from('mock_script_0'),
            value: 10000, // Rune return output
          },
          {
            script: Buffer.from('mock_script_1'),
            value: 10000, // Recipient rune output
          },
          {
            script: Buffer.from('mock_script_2'),
            value: 5000, // BTC change
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      // Mock address decoding - vout 0 is rune return (taproot), vout 1 is recipient, vout 2 is btc change (segwit)
      jest.spyOn(bitcoin.address, 'fromOutputScript')
        .mockReturnValueOnce('tb1ptest') // Our taproot address
        .mockReturnValueOnce('bc1precipient')
        .mockReturnValueOnce('tb1qtest'); // Our segwit address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
        runeUtxo: { runeAmount: 500 }, // Total runes available
        amount: 100, // Sending 100 runes
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_unit');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Verify rune change was calculated (500 - 100 = 400)
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid_unit',
        [
          { address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 400 },
          { address: 'tb1qtest', value: 5000, vout: 2 },
        ],
        'UNIT',
        null
      );
    });

    it('should track parent-child relationship when spending pending transaction', async () => {
      const mockAddPendingTransaction = jest.fn();

      // Use a proper 64-character hex txid
      const pendingParentTxid = 'a'.repeat(64);

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {
          [pendingParentTxid]: {
            status: 'pending',
            outputs: [{ address: 'tb1qtest', value: 50000, vout: 0 }],
          },
        },
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock transaction that spends from pending parent
      // The hash in tx.ins is reversed, so we need to reverse the parent txid
      const mockTx = {
        ins: [
          { hash: Buffer.from(pendingParentTxid, 'hex').reverse() } // Spending from pending tx
        ],
        outs: [
          {
            script: Buffer.from('mock_script_1'),
            value: 40000,
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      jest.spyOn(bitcoin.address, 'fromOutputScript')
        .mockReturnValueOnce('tb1qtest'); // Our segwit address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('child_txid');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Verify parent txid was tracked
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'child_txid',
        [{ address: 'tb1qtest', value: 40000, vout: 0 }],
        'BTC',
        pendingParentTxid // Parent txid tracked
      );
    });

    it('should not track outputs when there are no change outputs', async () => {
      const mockAddPendingTransaction = jest.fn();

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock transaction with no change outputs (all to recipient)
      const mockTx = {
        ins: [
          { hash: Buffer.from('a'.repeat(64), 'hex') }
        ],
        outs: [
          {
            script: Buffer.from('mock_script_1'),
            value: 50000,
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      const fromOutputScriptSpy = jest.spyOn(bitcoin.address, 'fromOutputScript');
      fromOutputScriptSpy.mockClear();
      fromOutputScriptSpy.mockReturnValueOnce('bc1qrecipient'); // Not our address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Should not call addPendingTransaction when no change outputs
      expect(mockAddPendingTransaction).not.toHaveBeenCalled();
    });

    it('should handle OP_RETURN outputs gracefully', async () => {
      const mockAddPendingTransaction = jest.fn();

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock transaction with OP_RETURN and change output
      const mockTx = {
        ins: [
          { hash: Buffer.from('a'.repeat(64), 'hex') }
        ],
        outs: [
          {
            script: Buffer.from('mock_op_return_script'),
            value: 0, // OP_RETURN
          },
          {
            script: Buffer.from('mock_script_2'),
            value: 10000,
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      // First call throws (OP_RETURN can't be decoded), second succeeds
      jest.spyOn(bitcoin.address, 'fromOutputScript')
        .mockImplementationOnce(() => { throw new Error('Invalid script'); })
        .mockReturnValueOnce('tb1qtest'); // Our segwit address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Should only track the valid change output, skip OP_RETURN
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid',
        [{ address: 'tb1qtest', value: 10000, vout: 1 }],
        'BTC',
        null
      );
    });

    it('should handle output extraction errors gracefully', async () => {
      const mockAddPendingTransaction = jest.fn();

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      // Mock fromHex to throw an error
      jest.spyOn(bitcoin.Transaction, 'fromHex').mockImplementation(() => {
        throw new Error('Invalid transaction hex');
      });

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'invalid_hex',
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Should not crash, just continue with broadcast
      expect(result.current.broadcastedTxid).toBe('mock_txid');
      expect(mockAddPendingTransaction).not.toHaveBeenCalled();
    });

    it('should not add rune amount when runeChangeAmount is zero', async () => {
      const mockAddPendingTransaction = jest.fn();

      useSendFlow.mockReturnValue({
        setIntentStep: mockSetIntentStep,
        sendAssetType: 'unit',
        sendAmount: '500', // Sending all runes
      });

      usePendingTransactions.mockReturnValue({
        pendingTransactions: {},
        addPendingTransaction: mockAddPendingTransaction,
        confirmTransaction: jest.fn(),
        invalidateTransaction: jest.fn(),
        markUtxoAsSpent: jest.fn(),
        markUtxosAsSpent: jest.fn(),
      });

      const mockTx = {
        ins: [
          { hash: Buffer.from('a'.repeat(64), 'hex') }
        ],
        outs: [
          {
            script: Buffer.from('mock_script_0'),
            value: 10000,
          },
          {
            script: Buffer.from('mock_script_1'),
            value: 5000,
          },
        ],
      };

      jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);

      jest.spyOn(bitcoin.address, 'fromOutputScript')
        .mockReturnValueOnce('tb1ptest') // Our taproot address
        .mockReturnValueOnce('tb1qtest'); // Our segwit address

      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
        runeUtxo: { runeAmount: 500 },
        amount: 500, // Sending all runes, no change
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_unit');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showToast={mockShowToast}
          startTransactionPolling={mockStartTransactionPolling}
          sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
          notificationsEnabled={true}
          fetchBalance={mockFetchBalance}
        >
          {children}
        </TransactionExecutionProvider>
      );
      const { result } = renderHook(() => useTransactionExecution(), { wrapper });

      await act(async () => {
        await result.current.broadcastIntent();
      });

      // Verify no rune amount added when change is 0
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid_unit',
        [
          { address: 'tb1ptest', value: 10000, vout: 0 }, // No runeAmount
          { address: 'tb1qtest', value: 5000, vout: 1 },
        ],
        'UNIT',
        null
      );
    });
  });
});
