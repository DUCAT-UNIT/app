/**
 * Tests for useConfirmationHandlers hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useConfirmationHandlers } from '../useConfirmationHandlers';
import { notify } from '../../utils/notify';

// Mock dependencies
jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(undefined),
  },
  Share: {
    share: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/constants', () => ({
  getTxUrl: jest.fn((txid: string) => `https://mempool.space/tx/${txid}`),
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
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount, component };
}

describe('useConfirmationHandlers', () => {
  let fetchTransactionHistory: jest.Mock;
  let navigation: { getParent: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fetchTransactionHistory = jest.fn();
    navigation = {
      getParent: jest.fn(() => ({
        goBack: jest.fn(),
      })),
    };
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
      })
    );

    expect(typeof result.current!.handleViewExplorer).toBe('function');
    expect(typeof result.current!.handleShareDeeplink).toBe('function');
    expect(typeof result.current!.handleCopyDeeplink).toBe('function');
    expect(typeof result.current!.handleOpenInBrowser).toBe('function');
    expect(typeof result.current!.handleDone).toBe('function');
  });

  describe('handleViewExplorer', () => {
    it('should open explorer URL when txid is present', () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: 'txid123',
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation,
        })
      );

      act(() => {
        result.current!.handleViewExplorer();
      });

      expect(getTxUrl).toHaveBeenCalledWith('txid123');
      expect(Linking.openURL).toHaveBeenCalledWith('https://mempool.space/tx/txid123');
    });

    it('should not open URL when txid is null', () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation,
        })
      );

      act(() => {
        result.current!.handleViewExplorer();
      });

      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });

  describe('handleShareDeeplink', () => {
    it('should share deeplink when present', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleShareDeeplink();
      });

      expect(Share.share).toHaveBeenCalledWith({
        message: 'https://ducat.app/turbo/token123',
        title: 'Receive UNIT',
      });
    });

    it('should share BTC Cashu deeplinks with BTC title', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'ducat://turbo/cashuBbtc',
          cashuUnit: 'sat',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleShareDeeplink();
      });

      expect(Share.share).toHaveBeenCalledWith({
        message: 'ducat://turbo/cashuBbtc',
        title: 'Receive BTC',
      });
    });

    it('should not share when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleShareDeeplink();
      });

      expect(Share.share).not.toHaveBeenCalled();
    });

    it('should show error toast on share failure', async () => {
      (Share.share as jest.Mock).mockRejectedValue(new Error('Share failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleShareDeeplink();
      });

      expect(notify.link.shareFailed).toHaveBeenCalled();
    });
  });

  describe('handleCopyDeeplink', () => {
    it('should copy deeplink to clipboard', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleCopyDeeplink();
      });

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        'https://ducat.app/turbo/token123'
      );
      expect(notify.clipboard.linkCopied).toHaveBeenCalled();
    });

    it('should not copy when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleCopyDeeplink();
      });

      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    });

    it('should show error toast on copy failure', async () => {
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleCopyDeeplink();
      });

      expect(notify.link.copyFailed).toHaveBeenCalled();
    });
  });

  describe('handleOpenInBrowser', () => {
    it('should open deeplink in browser', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/turbo/token123',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleOpenInBrowser();
      });

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://ducat.app/turbo/token123'
      );
    });

    it('should not open when deeplink is null', async () => {
      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleOpenInBrowser();
      });

      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('should show error toast on open failure', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Open failed'));

      const { result } = renderHook(() =>
        useConfirmationHandlers({
          broadcastedTxid: undefined,
          turboDeeplink: 'https://ducat.app/...',
          fetchTransactionHistory,
          navigation,
        })
      );

      await act(async () => {
        await result.current!.handleOpenInBrowser();
      });

      expect(notify.link.openFailed).toHaveBeenCalled();
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
          turboDeeplink: undefined,
          fetchTransactionHistory,
          navigation: mockNavigation,
        })
      );

      act(() => {
        result.current!.handleDone();
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
          turboDeeplink: undefined,
          fetchTransactionHistory: undefined,
          navigation: mockNavigation,
        })
      );

      act(() => {
        result.current!.handleDone();
      });

      // Should not throw
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
