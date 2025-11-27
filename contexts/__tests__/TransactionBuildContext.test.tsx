// @ts-nocheck
/**
 * Tests for TransactionBuildContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { TransactionBuildProvider, useTransactionBuild } from '../TransactionBuildContext';
import { useSendFlow } from '../SendFlowContext';
import { usePendingTransactions } from '../PendingTransactionsContext';
import { useBalance } from '../WalletDataContext';
import * as TransactionService from '../../services/transaction';
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
jest.mock('../PendingTransactionsContext');
jest.mock('../../services/transaction');
jest.mock('../WalletDataContext', () => ({
  useBalance: jest.fn(),
}));

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

    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
    });

    useBalance.mockReturnValue({
      runesBalance: [],
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
      0,
      [], // unconfirmed UTXOs
      [] // spent UTXOs
    );
    expect(result.current.sendIntent).toEqual(mockIntent);
    expect(mockSetIntentStep).toHaveBeenCalledWith('reviewing');
  });

  it('should create UNIT intent successfully', async () => {
    const mockIntent = { psbt: 'mock_psbt_unit', fee: 2000 };
    TransactionService.createUnitIntent.mockResolvedValue(mockIntent);

    // Need to set up the mocks BEFORE rendering the component
    // Override the default mock from beforeEach
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',  // This is the key change
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    // Mock useBalance to return UNIT balance
    useBalance.mockReturnValue({
      runesBalance: [['UNIT', '1000']],  // User has 1000 UNIT
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    // Make sure mock is still set for the call
    await act(async () => {
      await result.current.createSendIntent();
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('creating');
    expect(TransactionService.createUnitIntent).toHaveBeenCalledWith(
      'bc1qrecipient',
      '100',
      mockWallet.taprootAddress,
      mockWallet.segwitAddress,
      0,
      [], // unconfirmed taproot UTXOs
      [], // unconfirmed segwit UTXOs
      []  // spent UTXOs
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
      0,
      [], // unconfirmed UTXOs
      []  // spent UTXOs
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

  it('should create BTC intent with unconfirmed UTXOs', async () => {
    const mockUnconfirmedUtxos = [
      { txid: 'unconfirmed1', vout: 0, value: 50000 },
      { txid: 'unconfirmed2', vout: 1, value: 30000 },
    ];

    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue(mockUnconfirmedUtxos),
      getSpentUtxos: jest.fn().mockReturnValue([]),
    });

    const mockIntent = {
      psbt: 'mock_psbt_with_unconfirmed',
      fee: 1500,
      inputs: [
        { txid: 'unconfirmed1', vout: 0 },
        { txid: 'confirmed1', vout: 0 },
      ],
    };
    TransactionService.createBtcIntent.mockResolvedValue(mockIntent);

    const mockMarkUtxosAsSpent = jest.fn();
    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue(mockUnconfirmedUtxos),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      markUtxosAsSpent: mockMarkUtxosAsSpent,
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

    expect(TransactionService.createBtcIntent).toHaveBeenCalledWith(
      'bc1qrecipient',
      '0.001',
      mockWallet.segwitAddress,
      0,
      mockUnconfirmedUtxos,
      []
    );
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

  it('should cancel BTC intent and release locked UTXOs', async () => {
    const mockIntent = {
      psbt: 'mock_psbt',
      fee: 1000,
      assetType: 'BTC',
      inputs: [
        { txid: 'input1', vout: 0 },
        { txid: 'input2', vout: 1 },
      ],
    };

    const mockUnmarkUtxosAsSpent = jest.fn();
    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
      markUtxosAsSpent: jest.fn(),
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    // Set an intent
    act(() => {
      result.current.setSendIntent(mockIntent);
    });

    // Cancel the intent
    await act(async () => {
      await result.current.cancelIntent();
    });

    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'input1', vout: 0 },
      { txid: 'input2', vout: 1 },
    ]);
    expect(result.current.sendIntent).toBeNull();
    expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
  });

  it('should cancel UNIT intent and release rune and sat UTXOs', async () => {
    const mockIntent = {
      psbt: 'mock_psbt_unit',
      fee: 2000,
      assetType: 'UNIT',
      runeUtxo: {
        transaction: 'rune_txid',
        vout: 0,
        runeAmount: 150,
      },
      satUtxo: {
        txid: 'sat_txid',
        vout: 1,
        value: 15000,
      },
    };

    const mockUnmarkUtxosAsSpent = jest.fn();
    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
      markUtxosAsSpent: jest.fn(),
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    // Set a UNIT intent
    act(() => {
      result.current.setSendIntent(mockIntent);
    });

    // Cancel the intent
    await act(async () => {
      await result.current.cancelIntent();
    });

    expect(mockUnmarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'rune_txid', vout: 0 },
      { txid: 'sat_txid', vout: 1 },
    ]);
    expect(result.current.sendIntent).toBeNull();
    expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
  });

  it('should not release UTXOs if transaction was already broadcast', async () => {
    const mockIntent = {
      psbt: 'mock_psbt',
      fee: 1000,
      txid: 'broadcast_txid', // Transaction was broadcast
      inputs: [
        { txid: 'input1', vout: 0 },
      ],
    };

    const mockUnmarkUtxosAsSpent = jest.fn();
    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
      markUtxosAsSpent: jest.fn(),
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    // Set a broadcast intent
    act(() => {
      result.current.setSendIntent(mockIntent);
    });

    // Cancel the intent
    await act(async () => {
      await result.current.cancelIntent();
    });

    // Should NOT release UTXOs since transaction was broadcast
    expect(mockUnmarkUtxosAsSpent).not.toHaveBeenCalled();
    expect(result.current.sendIntent).toBeNull();
    expect(mockSetIntentStep).toHaveBeenCalledWith('idle');
  });

  it('should handle cancelIntent when no intent exists', async () => {
    const mockUnmarkUtxosAsSpent = jest.fn();
    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      unmarkUtxosAsSpent: mockUnmarkUtxosAsSpent,
      markUtxosAsSpent: jest.fn(),
    });

    const wrapper = ({ children }) => (
      <TransactionBuildProvider wallet={mockWallet} currentAccount={0} showToast={mockShowToast}>
        {children}
      </TransactionBuildProvider>
    );
    const { result } = renderHook(() => useTransactionBuild(), { wrapper });

    // Cancel when no intent exists (should return early)
    await act(async () => {
      await result.current.cancelIntent();
    });

    expect(mockUnmarkUtxosAsSpent).not.toHaveBeenCalled();
    expect(result.current.sendIntent).toBeNull();
  });

  it('should lock UTXOs when creating UNIT intent with runeUtxo and satUtxo', async () => {
    const mockIntent = {
      psbt: 'mock_psbt_unit',
      fee: 2000,
      runeUtxo: {
        transaction: 'rune_txid',
        vout: 0,
        runeAmount: 150,
      },
      satUtxo: {
        txid: 'sat_txid',
        vout: 1,
        value: 15000,
      },
    };
    TransactionService.createUnitIntent.mockResolvedValue(mockIntent);

    const mockMarkUtxosAsSpent = jest.fn();
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    usePendingTransactions.mockReturnValue({
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue([]),
      markUtxosAsSpent: mockMarkUtxosAsSpent,
    });

    useBalance.mockReturnValue({
      runesBalance: [['UNIT', '1000']],
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

    // Verify both rune and sat UTXOs were locked
    expect(mockMarkUtxosAsSpent).toHaveBeenCalledWith([
      { txid: 'rune_txid', vout: 0 },
      { txid: 'sat_txid', vout: 1 },
    ]);
  });

  it('should handle UNIT intent with zero runes balance', async () => {
    useSendFlow.mockReturnValue({
      sendRecipient: 'bc1qrecipient',
      sendAmount: '100',
      sendAssetType: 'unit',
      setIntentStep: mockSetIntentStep,
      setSendRecipient: mockSetSendRecipient,
    });

    useBalance.mockReturnValue({
      runesBalance: [], // No runes balance
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

    expect(mockShowToast).toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][0]).toContain('UNIT');
    expect(mockShowToast.mock.calls[0][1]).toBe('error');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSetIntentStep).toHaveBeenCalledWith('entering_amount');
  });
});
