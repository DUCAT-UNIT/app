/**
 * Tests for TransactionBuildContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { TransactionBuildProvider, useTransactionBuild } from '../TransactionBuildContext';
import { useSendFlow } from '../SendFlowContext';
import * as TransactionService from '../../services/transactionService';
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
jest.mock('../../services/transactionService');

describe('TransactionBuildContext', () => {
  const mockWallet = {
    segwitAddress: 'bc1qsegwit',
    taprootAddress: 'bc1ptaproot',
  };
  const mockShowToast = jest.fn();
  const mockSetIntentStep = jest.fn();
  const mockSetSendRecipient = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '0.001',
      sendAssetType: 'btc',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTransactionBuild());
    }).toThrow('useTransactionBuild must be used within a TransactionBuildProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    expect(result.current.sendIntent).toBe(null);
    expect(typeof result.current.setSendIntent).toBe('function');
    expect(typeof result.current.createSendIntent).toBe('function');
  });

  it('should create BTC intent successfully', async () => {
    const mockIntent = { psbt: 'mock_psbt', fee: 1000 };
    TransactionService.createBtcIntent.mockResolvedValue(mockIntent);

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('creating');
    expect(TransactionService.createBtcIntent).toHaveBeenCalledWith(
      'bc1qrecipient',
      '0.001',
      mockWallet.segwitAddress,
      0
    );
    expect(result.current.sendIntent).toEqual(mockIntent);
    expect(mockSetIntentStep).toHaveBeenCalledWith('reviewing');
  });

  it('should create UNIT intent successfully', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    const mockIntent = { psbt: 'mock_psbt_unit', fee: 2000 };
    TransactionService.createUnitIntent.mockResolvedValue(mockIntent);

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('creating');
    expect(TransactionService.createUnitIntent).toHaveBeenCalledWith(
      'bc1qrecipient',
      '100',
      mockWallet.taprootAddress,
      mockWallet.segwitAddress,
      0
    );
    expect(result.current.sendIntent).toEqual(mockIntent);
    expect(mockSetIntentStep).toHaveBeenCalledWith('reviewing');
  });

  it('should handle BTC intent creation error', async () => {
    TransactionService.createBtcIntent.mockRejectedValue(new Error('Insufficient funds'));

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][1]).toBe('error');

    // Advance timer to trigger state reset
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('entering_amount');
  });

  it('should handle UNIT intent creation error', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    TransactionService.createUnitIntent.mockRejectedValue(new Error('Invalid recipient'));

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][1]).toBe('error');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('entering_amount');
  });

  it('should validate missing recipient or amount', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: '',
      sendAmount: '',
      sendAssetType: 'btc',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockShowToast).toHaveBeenCalledWith(ERRORS.MISSING_RECIPIENT_AMOUNT, 'error');
    expect(TransactionService.createBtcIntent).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('entering_amount');
  });

  it('should validate asset type selection', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '0.001',
      sendAssetType: null,
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockShowToast).toHaveBeenCalledWith(ERRORS.ASSET_SELECTION_REQUIRED, 'error');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('selecting_asset');
  });

  it('should trim recipient address', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: '  bc1qrecipient  ',
      sendAmount: '0.001',
      sendAssetType: 'btc',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    const mockIntent = { psbt: 'mock_psbt', fee: 1000 };
    TransactionService.createBtcIntent.mockResolvedValue(mockIntent);

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockSetSendRecipient).toHaveBeenCalledWith('bc1qrecipient');
    // Note: createBtcIntent is called with original untrimmed value because
    // setSendRecipient happens after the service call
    expect(TransactionService.createBtcIntent).toHaveBeenCalledWith(
      '  bc1qrecipient  ',
      '0.001',
      mockWallet.segwitAddress,
      0
    );
  });

  it('should manually set sendIntent', () => {
    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    const mockIntent = { psbt: 'manual_psbt', fee: 500 };

    act(() => {
      result.current.setSendIntent(mockIntent);
    });

    expect(result.current.sendIntent).toEqual(mockIntent);
  });

  it('should handle UNIT intent with missing wallet addresses', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    const incompleteWallet = { segwitAddress: 'bc1qsegwit' }; // Missing taproot

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={incompleteWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][1]).toBe('error');
  });
});
