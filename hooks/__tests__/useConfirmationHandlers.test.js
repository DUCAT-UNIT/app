/**
 * Tests for useConfirmationHandlers hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useConfirmationHandlers } from '../useConfirmationHandlers';

// Mock dependencies
jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(),
  },
  Share: {
    share: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(),
}));

jest.mock('../../utils/constants', () => ({
  getTxUrl: jest.fn((txid) => `https://mempool.space/tx/${txid}`),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getTxUrl } from '../../utils/constants';

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component.unmount, component };
}

describe('useConfirmationHandlers', () => {
  let fetchTransactionHistory;
  let navigation;
  let showToast;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fetchTransactionHistory = jest.fn();
    navigation = {
      getParent: jest.fn(() => ({
        goBack: jest.fn(),
      })),
    };
    showToast = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return all handler functions', () => {
    const { result } = renderHook(() =>
      useConfirmationHandlers({
        broadcastedTxid: 'txid123',
        turboDeeplink: 'https://ducat.app/...',
        fetchTransactionHistory,
        navigation,
        showToast,
      })
    );

    expect(typeof result.current.handleViewExplorer).toBe('function');
    expect(typeof result.current.handleShareDeeplink).toBe('function');
    expect(typeof result.current.handleCopyDeeplink).toBe('function');
    expect(typeof result.current.handleOpenInBrowser).toBe('function');
    expect(typeof result.current.handleDone).toBe('function');
  });

  describe('handleViewExplorer', () => {
    it('should open explorer URL when txid is present', () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: 'txid123',
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      act(() => {
        result.current.handleViewExplorer();
      });

      expect(getTxUrl).toHaveBeenCalledWith('txid123');
      expect(Linking.openURL).toHaveBeenCalledWith('https://mempool.space/tx/txid123');
    });

    it('should not open URL when txid is null', () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      act(() => {
        result.current.handleViewExplorer();
      });

      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });

  describe('handleShareDeeplink', () => {
    it('should share deeplink when present', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleShareDeeplink();
      });

      expect(Share.share).toHaveBeenCalledWith({
        message: 'https://ducat.app/turbo/token123',
        title: 'Receive UNIT',
      });
    });

    it('should not share when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleShareDeeplink();
      });

      expect(Share.share).not.toHaveBeenCalled();
    });

    it('should show error toast on share failure', async () => {
      Share.share.mockRejectedValue(new Error('Share failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleShareDeeplink();
      });

      expect(showToast).toHaveBeenCalledWith(
        'Failed to share link. Please try again.',
        'error'
      );
    });
  });

  describe('handleCopyDeeplink', () => {
    it('should copy deeplink to clipboard', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleCopyDeeplink();
      });

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        'https://ducat.app/turbo/token123'
      );
      expect(showToast).toHaveBeenCalledWith('Link copied to clipboard', 'info');
    });

    it('should not copy when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleCopyDeeplink();
      });

      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    });

    it('should show error toast on copy failure', async () => {
      Clipboard.setStringAsync.mockRejectedValue(new Error('Copy failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleCopyDeeplink();
      });

      expect(showToast).toHaveBeenCalledWith(
        'Failed to copy link. Please try again.',
        'error'
      );
    });
  });

  describe('handleOpenInBrowser', () => {
    it('should open deeplink in browser', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleOpenInBrowser();
      });

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://ducat.app/turbo/token123'
      );
    });

    it('should not open when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleOpenInBrowser();
      });

      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('should show error toast on open failure', async () => {
      Linking.openURL.mockRejectedValue(new Error('Open failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: null,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
          showToast,
        })
      );

      await act(async () => {
        await result.current.handleOpenInBrowser();
      });

      expect(showToast).toHaveBeenCalledWith(
        'Failed to open link. Please try again.',
        'error'
      );
    });
  });

  describe('handleDone', () => {
    it('should fetch history and dismiss modal', () => {
      const mockGoBack = jest.fn();
      const mockNavigation = {
        getParent: jest.fn(() => ({
          goBack: mockGoBack,
        })),
      };

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: 'txid123',
          turboDeeplink: null,
          fetchTransactionHistory,
          navigation: mockNavigation,
          showToast,
        })
      );

      act(() => {
        result.current.handleDone();
      });

      expect(fetchTransactionHistory).toHaveBeenCalled();

      // Advance timer for delayed navigation
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(mockNavigation.getParent).toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should handle missing fetchTransactionHistory', () => {
      const mockGoBack = jest.fn();
      const mockNavigation = {
        getParent: jest.fn(() => ({
          goBack: mockGoBack,
        })),
      };

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: 'txid123',
          turboDeeplink: null,
          fetchTransactionHistory: null,
          navigation: mockNavigation,
          showToast,
        })
      );

      act(() => {
        result.current.handleDone();
      });

      // Should not throw
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
