/**
 * Tests for sendFlowStore
 * Consolidated to test meaningful behavior - timers, state clearing, flows
 */

import { act } from '@testing-library/react-native';
import {
  useSendFlowStore,
  resetSendFlowStore,
} from '../sendFlowStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('sendFlowStore', () => {
  beforeEach(() => {
    resetSendFlowStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have correct initial state', () => {
    const state = useSendFlowStore.getState();
    expect(state).toMatchObject({
      intentStep: 'idle',
      sendAssetType: null,
      sendAmount: '',
      sendRecipient: '',
      sendAddressType: 'taproot',
      requireConfirmedUtxos: false,
      turboEnabled: true,
      selectedFeeRate: 2,
    });
  });

  describe('confirmed step behavior', () => {
    it('should clear transaction fields when confirmed', () => {
      const state = useSendFlowStore.getState();

      act(() => {
        state.setSendRecipient('tb1qtest123');
        state.setSendAmount('0.001');
        state.setSendAssetType('btc');
        state.setIntentStep('confirmed');
      });

      expect(useSendFlowStore.getState().intentStep).toBe('confirmed');
      expect(useSendFlowStore.getState().sendRecipient).toBe('');
      expect(useSendFlowStore.getState().sendAmount).toBe('');
      expect(useSendFlowStore.getState().sendAssetType).toBeNull();
    });

    it('should auto-reset to idle after 10 seconds', () => {
      const { setIntentStep } = useSendFlowStore.getState();

      act(() => { setIntentStep('confirmed'); });
      expect(useSendFlowStore.getState().intentStep).toBe('confirmed');

      act(() => { jest.advanceTimersByTime(10000); });
      expect(useSendFlowStore.getState().intentStep).toBe('idle');
    });

    it('should cancel reset timer when step changes before timeout', () => {
      const { setIntentStep } = useSendFlowStore.getState();

      act(() => { setIntentStep('confirmed'); });
      act(() => {
        jest.advanceTimersByTime(5000);
        setIntentStep('entering_address');
      });

      act(() => { jest.advanceTimersByTime(5000); });
      expect(useSendFlowStore.getState().intentStep).toBe('entering_address');
    });
  });

  describe('full send flow', () => {
    it('should handle complete BTC send flow', () => {
      const state = useSendFlowStore.getState();

      // Select asset and enter address
      act(() => {
        state.setSendAssetType('btc');
        state.setSendRecipient('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
        state.setSendAddressType('segwit');
      });

      // Enter amount
      act(() => {
        state.setSendAmount('0.001');
        state.setSelectedFeeRate(5);
      });

      // Navigate through states
      act(() => { state.setIntentStep('reviewing'); });
      act(() => { state.setIntentStep('signing'); });
      act(() => { state.setIntentStep('broadcasting'); });
      act(() => { state.setIntentStep('confirmed'); });

      // Transaction fields cleared, fee rate persists
      expect(useSendFlowStore.getState().sendRecipient).toBe('');
      expect(useSendFlowStore.getState().selectedFeeRate).toBe(5);
    });

    it('should handle UNIT turbo send flow', () => {
      const state = useSendFlowStore.getState();

      act(() => {
        state.setSendAssetType('unit');
        state.setSendRecipient('tb1p...');
        state.setSendAmount('100');
      });

      expect(useSendFlowStore.getState().turboEnabled).toBe(true);

      act(() => { state.setTurboEnabled(false); });
      expect(useSendFlowStore.getState().turboEnabled).toBe(false);
    });
  });

  it('should reset all state and clear timers', () => {
    const { setIntentStep, setSendAmount } = useSendFlowStore.getState();

    act(() => {
      setIntentStep('confirmed');
      setSendAmount('0.5');
    });

    act(() => { resetSendFlowStore(); });

    expect(useSendFlowStore.getState().intentStep).toBe('idle');
    expect(useSendFlowStore.getState().sendAmount).toBe('');

    // Timer should be cleared
    act(() => { jest.advanceTimersByTime(10000); });
    expect(useSendFlowStore.getState().intentStep).toBe('idle');
  });
});
