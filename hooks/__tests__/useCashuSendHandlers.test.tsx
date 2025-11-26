// @ts-nocheck
/**
 * Tests for useCashuSendHandlers hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuSendHandlers } from '../useCashuSendHandlers';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { Alert, Share } from 'react-native';

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useCashuSendHandlers(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: component.unmount,
    component,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useCashuSendHandlers', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {
      amount: '100',
      balance: 500,
      redeemAddress: 'tb1p...',
      meltQuote: null,
      send: jest.fn().mockResolvedValue({ token: 'cashuA...' }),
      startMelt: jest.fn().mockResolvedValue({ quoteId: 'quote123', total: 100, amount: 100 }),
      finishMelt: jest.fn().mockResolvedValue({ txid: 'txid123' }),
      navigation: { goBack: jest.fn() },
      setGeneratedToken: jest.fn(),
      setMeltQuote: jest.fn(),
      setIsLoading: jest.fn(),
    };
  });

  it('should return all handler functions', () => {
    const { result } = renderHookWithProps(mockProps);

    expect(typeof result.current.handleSendToken).toBe('function');
    expect(typeof result.current.handleShareToken).toBe('function');
    expect(typeof result.current.handleStartRedeem).toBe('function');
    expect(typeof result.current.handleConfirmRedeem).toBe('function');
  });

  describe('handleSendToken', () => {
    it('should send token and set generated token', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(mockProps.setIsLoading).toHaveBeenCalledWith(true);
      expect(mockProps.send).toHaveBeenCalledWith(100);
      expect(mockProps.setGeneratedToken).toHaveBeenCalledWith('cashuA...');
      expect(mockProps.setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should show alert for invalid amount (0)', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: '0',
      });

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
      expect(mockProps.send).not.toHaveBeenCalled();
    });

    it('should show alert for invalid amount (negative)', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: '-10',
      });

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
    });

    it('should show alert for invalid amount (non-numeric)', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: 'abc',
      });

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
    });

    it('should show alert for insufficient balance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: '1000',
        balance: 500,
      });

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Insufficient Balance', 'You only have 500 sats');
      expect(mockProps.send).not.toHaveBeenCalled();
    });

    it('should handle send error', async () => {
      mockProps.send.mockRejectedValue(new Error('Send failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleSendToken();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Send failed');
      expect(mockProps.setIsLoading).toHaveBeenLastCalledWith(false);
    });
  });

  describe('handleShareToken', () => {
    it('should share token', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleShareToken('cashuA...');
      });

      expect(Share.share).toHaveBeenCalledWith({
        message: 'cashuA...',
        title: 'Cashu Token',
      });
    });

    it('should not share if token is null', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleShareToken(null);
      });

      expect(Share.share).not.toHaveBeenCalled();
    });

    it('should handle share error gracefully', async () => {
      Share.share.mockRejectedValue(new Error('Share failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleShareToken('cashuA...');
      });

      // Should not throw
    });
  });

  describe('handleStartRedeem', () => {
    it('should start melt and set quote', async () => {
      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(mockProps.setIsLoading).toHaveBeenCalledWith(true);
      expect(mockProps.startMelt).toHaveBeenCalledWith('tb1p...', 100);
      expect(mockProps.setMeltQuote).toHaveBeenCalledWith({ quoteId: 'quote123', total: 100, amount: 100 });
      expect(mockProps.setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should show alert for invalid amount', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: '0',
      });

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Invalid Amount', 'Please enter a valid amount');
      expect(mockProps.startMelt).not.toHaveBeenCalled();
    });

    it('should show alert for insufficient balance', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        amount: '1000',
        balance: 500,
      });

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Insufficient Balance', 'You only have 500 sats');
    });

    it('should show alert for missing redeem address', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        redeemAddress: '',
      });

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No taproot address found in wallet');
    });

    it('should trim redeem address', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        redeemAddress: '  tb1p...  ',
      });

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(mockProps.startMelt).toHaveBeenCalledWith('tb1p...', 100);
    });

    it('should handle start melt error', async () => {
      mockProps.startMelt.mockRejectedValue(new Error('Melt failed'));

      const { result } = renderHookWithProps(mockProps);

      await act(async () => {
        await result.current.handleStartRedeem();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Melt failed');
      expect(mockProps.setIsLoading).toHaveBeenLastCalledWith(false);
    });
  });

  describe('handleConfirmRedeem', () => {
    it('should complete melt and show success alert', async () => {
      const meltQuote = { quoteId: 'quote123', total: 100, amount: 100 };
      const { result } = renderHookWithProps({
        ...mockProps,
        meltQuote,
      });

      await act(async () => {
        await result.current.handleConfirmRedeem();
      });

      expect(mockProps.setIsLoading).toHaveBeenCalledWith(true);
      expect(mockProps.finishMelt).toHaveBeenCalledWith('quote123', 100);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success!',
        expect.stringContaining('Redeemed 100 sats'),
        expect.any(Array)
      );
    });

    it('should not proceed if meltQuote is null', async () => {
      const { result } = renderHookWithProps({
        ...mockProps,
        meltQuote: null,
      });

      await act(async () => {
        await result.current.handleConfirmRedeem();
      });

      expect(mockProps.finishMelt).not.toHaveBeenCalled();
    });

    it('should navigate back on success alert OK', async () => {
      const meltQuote = { quoteId: 'quote123', total: 100, amount: 100 };
      const { result } = renderHookWithProps({
        ...mockProps,
        meltQuote,
      });

      await act(async () => {
        await result.current.handleConfirmRedeem();
      });

      // Get the OK button handler from Alert.alert call
      const alertCall = Alert.alert.mock.calls[0];
      const okButton = alertCall[2].find(b => b.text === 'OK');

      act(() => {
        okButton.onPress();
      });

      expect(mockProps.navigation.goBack).toHaveBeenCalled();
    });

    it('should handle finish melt error', async () => {
      mockProps.finishMelt.mockRejectedValue(new Error('Finish failed'));
      const meltQuote = { quoteId: 'quote123', total: 100, amount: 100 };

      const { result } = renderHookWithProps({
        ...mockProps,
        meltQuote,
      });

      await act(async () => {
        await result.current.handleConfirmRedeem();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Finish failed');
      expect(mockProps.setMeltQuote).toHaveBeenCalledWith(null);
      expect(mockProps.setIsLoading).toHaveBeenLastCalledWith(false);
    });
  });
});
