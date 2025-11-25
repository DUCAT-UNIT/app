/**
 * Tests for useTransactionNotifications hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTransactionNotifications } from '../useTransactionNotifications';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('../../utils/constants', () => ({
  getTxUrl: jest.fn((txid) => `https://mempool.space/tx/${txid}`),
  getOrdTxUrl: jest.fn((txid) => `https://ordinals.com/tx/${txid}`),
}));

import { Linking } from 'react-native';
import { getTxUrl, getOrdTxUrl } from '../../utils/constants';

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useTransactionNotifications(hookProps);
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

describe('useTransactionNotifications', () => {
  let showSnackbar;

  beforeEach(() => {
    jest.clearAllMocks();
    showSnackbar = jest.fn();
  });

  it('should not show snackbar when broadcastedTxid is null', () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: null,
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('should show submitted snackbar when intentStep is pending', () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'submitted',
        action: 'swap',
        txid: 'txid123',
      })
    );
  });

  it('should show success snackbar when intentStep is confirmed', () => {
    renderHookWithProps({
      intentStep: 'confirmed',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        action: 'swap',
        txid: 'txid123',
      })
    );
  });

  it('should use withdraw action for non-unit asset type', () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'btc',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'withdraw',
      })
    );
  });

  it('should use swap action for unit asset type', () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'swap',
      })
    );
  });

  it('should include clickAction that opens ord URL for unit asset', async () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];
    expect(snackbarCall.clickAction).toBeDefined();

    await act(async () => {
      await snackbarCall.clickAction();
    });

    expect(getOrdTxUrl).toHaveBeenCalledWith('txid123');
    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('https://ordinals.com/tx/txid123');
  });

  it('should include clickAction that opens mempool URL for non-unit asset', async () => {
    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'btc',
      showSnackbar,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];
    expect(snackbarCall.clickAction).toBeDefined();

    await act(async () => {
      await snackbarCall.clickAction();
    });

    expect(getTxUrl).toHaveBeenCalledWith('txid123');
    expect(Linking.openURL).toHaveBeenCalledWith('https://mempool.space/tx/txid123');
  });

  it('should not open URL if canOpenURL returns false', async () => {
    Linking.canOpenURL.mockResolvedValue(false);

    renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    const snackbarCall = showSnackbar.mock.calls[0][0];

    await act(async () => {
      await snackbarCall.clickAction();
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should not show snackbar for unknown intentStep', () => {
    renderHookWithProps({
      intentStep: 'unknown',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('should update snackbar when intentStep changes', () => {
    const { rerender } = renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'submitted' })
    );

    showSnackbar.mockClear();

    rerender({
      intentStep: 'confirmed',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('should update snackbar when broadcastedTxid changes', () => {
    const { rerender } = renderHookWithProps({
      intentStep: 'pending',
      broadcastedTxid: 'txid123',
      sendAssetType: 'unit',
      showSnackbar,
    });

    showSnackbar.mockClear();

    rerender({
      intentStep: 'pending',
      broadcastedTxid: 'txid456',
      sendAssetType: 'unit',
      showSnackbar,
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'txid456' })
    );
  });
});
