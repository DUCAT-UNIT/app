// @ts-nocheck
/**
 * Tests for TransactionExecutionContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import {
  TransactionExecutionProvider,
  useTransactionExecution,
} from '../TransactionExecutionContext';
import { useSendFlow } from '../../stores/sendFlowStore';
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
jest.mock('../../stores/sendFlowStore');
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
  const mockShowSnackbar = jest.fn();
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
        showSnackbar={mockShowSnackbar}
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
        showSnackbar={mockShowSnackbar}
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
        showSnackbar={mockShowSnackbar}
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

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: ERRORS.TRANSACTION_CANCELLED,
      })
    );
    expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
    expect(TransactionService.signIntent).not.toHaveBeenCalled();
  });

  it('should handle signing error', async () => {
    TransactionService.signIntent.mockRejectedValue(new Error('Signing failed'));

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
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
        showSnackbar={mockShowSnackbar}
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
        showSnackbar={mockShowSnackbar}
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

  it('should use swap snackbar action for UNIT intent with turboEnabled', async () => {
    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'unit',
      sendAmount: '100',
      turboEnabled: true,
    });

    // Mock null intent to trigger snackbar error (tests getSnackbarAction)
    useTransactionBuild.mockReturnValue({
      sendIntent: null,
      setSendIntent: mockSetSendIntent,
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    // Verify snackbar uses 'swap' action when turboEnabled
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'swap',
      })
    );
  });

  it('should broadcast BTC intent with inputs for logging', async () => {
    const btcSignedIntent = {
      ...mockSignedIntent,
      assetType: 'BTC',
      inputs: [
        { txid: 'input_txid_1', vout: 0, value: 50000 },
        { txid: 'input_txid_2', vout: 1, value: 30000 },
      ],
    };

    useTransactionBuild.mockReturnValue({
      sendIntent: btcSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_btc');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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
    expect(result.current.broadcastedTxid).toBe('mock_txid_btc');
  });

  it('should use unit_send snackbar action for UNIT intent without turboEnabled', async () => {
    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'unit',
      sendAmount: '100',
      turboEnabled: false,
    });

    // Mock null intent to trigger snackbar error (tests getSnackbarAction)
    useTransactionBuild.mockReturnValue({
      sendIntent: null,
      setSendIntent: mockSetSendIntent,
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    // Verify snackbar uses 'unit_send' action when turboEnabled is false
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        action: 'unit_send',
      })
    );
  });

  it('should broadcast UNIT intent with runeUtxo and satUtxo for logging', async () => {
    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'unit',
      sendAmount: '100',
    });

    const unitSignedIntent = {
      ...mockSignedIntent,
      assetType: 'UNIT',
      runeUtxo: { transaction: 'rune_txid', vout: 0 },
      satUtxo: { txid: 'sat_txid', vout: 1 },
    };

    useTransactionBuild.mockReturnValue({
      sendIntent: unitSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_unit_log');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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
    expect(result.current.broadcastedTxid).toBe('mock_txid_unit_log');
  });

  it('should handle intent.amount as number type', async () => {
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

    const mockTx = {
      ins: [{ hash: Buffer.from('a'.repeat(64), 'hex') }],
      outs: [{ script: Buffer.from('mock_script'), value: 10000 }],
    };

    jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);
    jest.spyOn(bitcoin.address, 'fromOutputScript').mockReturnValue('tb1ptest');

    const signedIntent = {
      ...mockSignedIntent,
      signedTxHex: 'mock_signed_hex',
      assetType: 'UNIT',
      runeUtxo: { runeAmount: 500 },
      amount: 100, // number type, not string
    };

    useTransactionBuild.mockReturnValue({
      sendIntent: signedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_num');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'mock_txid_num',
      [{ address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 400 }],
      'UNIT',
      null,
      10000
    );
  });

  it('should handle runeUtxos with missing runeAmount (fallback to 0)', async () => {
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

    const mockTx = {
      ins: [{ hash: Buffer.from('a'.repeat(64), 'hex') }],
      outs: [{ script: Buffer.from('mock_script'), value: 10000 }],
    };

    jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);
    jest.spyOn(bitcoin.address, 'fromOutputScript').mockReturnValue('tb1ptest');

    // Intent with runeUtxos but some missing runeAmount
    const signedIntent = {
      ...mockSignedIntent,
      signedTxHex: 'mock_signed_hex',
      assetType: 'UNIT',
      runeUtxos: [
        { transaction: 'utxo1', vout: 0, runeAmount: 200 },
        { transaction: 'utxo2', vout: 1 }, // Missing runeAmount
      ],
      amount: '50',
    };

    useTransactionBuild.mockReturnValue({
      sendIntent: signedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_missing');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    // runeChangeAmount = (200 + 0) - 50 = 150
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'mock_txid_missing',
      [{ address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 150 }],
      'UNIT',
      null,
      5000
    );
  });

  it('should handle invalid sendAmount with fallback to 0', async () => {
    const mockAddPendingTransaction = jest.fn();

    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'btc',
      sendAmount: 'invalid', // Invalid number
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
      ins: [{ hash: Buffer.from('a'.repeat(64), 'hex') }],
      outs: [{ script: Buffer.from('mock_script'), value: 10000 }],
    };

    jest.spyOn(bitcoin.Transaction, 'fromHex').mockReturnValue(mockTx);
    jest.spyOn(bitcoin.address, 'fromOutputScript').mockReturnValue('tb1qtest');

    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_invalid');

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    // sentAmountSmallest should be 0 due to invalid sendAmount
    expect(mockAddPendingTransaction).toHaveBeenCalledWith(
      'mock_txid_invalid',
      [{ address: 'tb1qtest', value: 10000, vout: 0 }],
      'BTC',
      null,
      0
    );
  });

  it('should handle polling callback with isConfirmed=false', async () => {
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
        showSnackbar={mockShowSnackbar}
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

    // Simulate polling with isConfirmed=false (pending check)
    act(() => {
      confirmCallback(false);
    });

    // Should not send notification when not confirmed
    expect(mockSendTransactionConfirmedNotification).not.toHaveBeenCalled();
    // But should still set intentStep to confirmed
    expect(mockSetIntentStep).toHaveBeenCalledWith('confirmed');
  });

  it('should send UNIT notification when notificationsEnabled', async () => {
    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'unit',
      sendAmount: '100',
    });

    useTransactionBuild.mockReturnValue({
      sendIntent: mockSignedIntent,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_unit_notify');

    let confirmCallback;
    mockStartTransactionPolling.mockImplementation((txid, onConfirm) => {
      confirmCallback = onConfirm;
    });

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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
      'UNIT',
      100,
      'mock_txid_unit_notify',
      'withdraw'
    );
  });

  it('should invalidate transaction on broadcast error when intent has txid', async () => {
    const mockInvalidateTransaction = jest.fn();

    usePendingTransactions.mockReturnValue({
      pendingTransactions: {},
      addPendingTransaction: jest.fn(),
      confirmTransaction: jest.fn(),
      invalidateTransaction: mockInvalidateTransaction,
      markUtxoAsSpent: jest.fn(),
      markUtxosAsSpent: jest.fn(),
    });

    const intentWithTxid = {
      ...mockSignedIntent,
      txid: 'existing_txid', // Intent has txid
    };

    useTransactionBuild.mockReturnValue({
      sendIntent: intentWithTxid,
      setSendIntent: mockSetSendIntent,
    });

    TransactionService.broadcastTransaction.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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

    expect(mockInvalidateTransaction).toHaveBeenCalledWith('existing_txid', 'Transaction broadcast failed');
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
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
        showSnackbar={mockShowSnackbar}
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

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: ERRORS.TRANSACTION_CANCELLED,
      })
    );
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
        showSnackbar={mockShowSnackbar}
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

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
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
        showSnackbar={mockShowSnackbar}
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
      0.001,
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
        showSnackbar={mockShowSnackbar}
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
        showSnackbar={mockShowSnackbar}
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

  it('should call fetchTransactionHistory when provided', async () => {
    const mockFetchTransactionHistory = jest.fn();

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
        showSnackbar={mockShowSnackbar}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
        fetchTransactionHistory={mockFetchTransactionHistory}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    // Should call after broadcast
    expect(mockFetchTransactionHistory).toHaveBeenCalled();
    mockFetchTransactionHistory.mockClear();

    // Simulate confirmation
    act(() => {
      confirmCallback(true);
    });

    // Should call again after confirmation
    expect(mockFetchTransactionHistory).toHaveBeenCalled();
  });

  it('should call fetchTransactionHistory on polling error', async () => {
    const mockFetchTransactionHistory = jest.fn();

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
        showSnackbar={mockShowSnackbar}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
        fetchTransactionHistory={mockFetchTransactionHistory}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    await act(async () => {
      await result.current.broadcastIntent();
    });

    mockFetchTransactionHistory.mockClear();

    // Simulate error
    act(() => {
      errorCallback(new Error('Polling timeout'));
    });

    expect(mockFetchTransactionHistory).toHaveBeenCalled();
  });

  it('should skip auto-confirm when skipAutoConfirm is true (turbo mint flow)', async () => {
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
        showSnackbar={mockShowSnackbar}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    // Call broadcastIntent with skipAutoConfirm option
    await act(async () => {
      await result.current.broadcastIntent(mockSignedIntent, { skipAutoConfirm: true });
    });

    // Clear the setIntentStep calls from broadcasting
    mockSetIntentStep.mockClear();

    // Simulate confirmation
    act(() => {
      confirmCallback(true);
    });

    // Should NOT call setIntentStep('confirmed') when skipAutoConfirm=true
    expect(mockSetIntentStep).not.toHaveBeenCalledWith('confirmed');
    // But should still fetch balance
    expect(mockFetchBalance).toHaveBeenCalled();
  });

  it('should skip auto-confirm on polling error when skipAutoConfirm is true', async () => {
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
        showSnackbar={mockShowSnackbar}
        startTransactionPolling={mockStartTransactionPolling}
        sendTransactionConfirmedNotification={mockSendTransactionConfirmedNotification}
        notificationsEnabled={true}
        fetchBalance={mockFetchBalance}
      >
        {children}
      </TransactionExecutionProvider>
    );
    const { result } = renderHook(() => useTransactionExecution(), { wrapper });

    // Call broadcastIntent with skipAutoConfirm option
    await act(async () => {
      await result.current.broadcastIntent(mockSignedIntent, { skipAutoConfirm: true });
    });

    mockSetIntentStep.mockClear();

    // Simulate error
    act(() => {
      errorCallback(new Error('Polling timeout'));
    });

    // Should NOT call setIntentStep('confirmed') when skipAutoConfirm=true
    expect(mockSetIntentStep).not.toHaveBeenCalledWith('confirmed');
    expect(mockFetchBalance).toHaveBeenCalled();
  });

  it('should reset toastDismissed when broadcastedTxid changes', () => {
    const wrapper = ({ children }) => (
      <TransactionExecutionProvider
        currentAccount={0}
        showSnackbar={mockShowSnackbar}
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
          showSnackbar={mockShowSnackbar}
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
      // 5th arg is sentAmountSmallest: 0.001 BTC * 100000000 = 100000 sats
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid',
        [{ address: 'tb1qtest', value: 10000, vout: 1 }],
        'BTC',
        null, // No parent
        100000 // sentAmountSmallest
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
        assetType: 'UNIT',
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
          showSnackbar={mockShowSnackbar}
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
      // 5th arg is sentAmountSmallest: 100 UNIT * 100 = 10000
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid_unit',
        [
          { address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 400 },
          { address: 'tb1qtest', value: 5000, vout: 2 },
        ],
        'UNIT',
        null,
        10000 // sentAmountSmallest
      );
    });

    it('should calculate rune change from multiple runeUtxos', async () => {
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

      // Intent with multiple runeUtxos (e.g., consolidating UTXOs)
      const signedIntent = {
        ...mockSignedIntent,
        signedTxHex: 'mock_signed_hex',
        assetType: 'UNIT',
        runeUtxos: [
          { transaction: 'utxo1', vout: 0, runeAmount: 300 },
          { transaction: 'utxo2', vout: 1, runeAmount: 200 },
          { transaction: 'utxo3', vout: 0, runeAmount: 100 },
        ], // Total: 600 runes
        amount: 100, // Sending 100 runes
      };

      useTransactionBuild.mockReturnValue({
        sendIntent: signedIntent,
        setSendIntent: mockSetSendIntent,
      });

      TransactionService.broadcastTransaction.mockResolvedValue('mock_txid_multi_utxo');

      const wrapper = ({ children }) => (
        <TransactionExecutionProvider
          currentAccount={0}
          showSnackbar={mockShowSnackbar}
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

      // Verify rune change was calculated from multiple UTXOs (600 - 100 = 500)
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid_multi_utxo',
        [
          { address: 'tb1ptest', value: 10000, vout: 0, runeAmount: 500 },
          { address: 'tb1qtest', value: 5000, vout: 1 },
        ],
        'UNIT',
        null,
        10000 // sentAmountSmallest
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
          showSnackbar={mockShowSnackbar}
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
      // 5th arg is sentAmountSmallest: 0.001 BTC * 100000000 = 100000 sats
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'child_txid',
        [{ address: 'tb1qtest', value: 40000, vout: 0 }],
        'BTC',
        pendingParentTxid, // Parent txid tracked
        100000 // sentAmountSmallest
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
          showSnackbar={mockShowSnackbar}
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
          showSnackbar={mockShowSnackbar}
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
      // 5th arg is sentAmountSmallest: 0.001 BTC * 100000000 = 100000 sats
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid',
        [{ address: 'tb1qtest', value: 10000, vout: 1 }],
        'BTC',
        null,
        100000 // sentAmountSmallest
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
          showSnackbar={mockShowSnackbar}
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
          showSnackbar={mockShowSnackbar}
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
      // 5th arg is sentAmountSmallest: 500 UNIT * 100 = 50000
      expect(mockAddPendingTransaction).toHaveBeenCalledWith(
        'mock_txid_unit',
        [
          { address: 'tb1ptest', value: 10000, vout: 0 }, // No runeAmount
          { address: 'tb1qtest', value: 5000, vout: 1 },
        ],
        'UNIT',
        null,
        50000 // sentAmountSmallest
      );
    });
  });
});
