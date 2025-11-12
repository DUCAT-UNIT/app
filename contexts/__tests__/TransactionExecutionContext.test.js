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
import * as TransactionService from '../../services/transactionService';
import * as BackgroundTaskService from '../../services/backgroundTaskService';
import { ERRORS } from '../../utils/messages';

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
jest.mock('../../services/transactionService');
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

    useSendFlow.mockReturnValue({
      setIntentStep: mockSetIntentStep,
      sendAssetType: 'btc',
      sendAmount: '0.001',
    });

    useTransactionBuild.mockReturnValue({
      sendIntent: mockIntent,
      setSendIntent: mockSetSendIntent,
    });
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
    expect(typeof result.current.signIntent).toBe('function');
    expect(typeof result.current.broadcastIntent).toBe('function');
    expect(typeof result.current.setBroadcastedTxid).toBe('function');
    expect(typeof result.current.setToastDismissed).toBe('function');
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
});
