import { useCallback } from 'react';
import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getTxUrl } from '../utils/constants';
import { logger } from '../utils/logger';
import type { ToastType } from '../types/notification';

interface NavigationWithParent {
  getParent: () => { goBack: () => void } | undefined;
}

interface UseConfirmationHandlersParams {
  broadcastedTxid: string | undefined;
  turboDeeplink: string | undefined;
  fetchTransactionHistory: (() => void) | undefined;
  navigation: NavigationWithParent;
  showToast: (message: string, type: ToastType) => void;
}

interface UseConfirmationHandlersReturn {
  handleViewExplorer: () => void;
  handleShareDeeplink: () => Promise<void>;
  handleCopyDeeplink: () => Promise<void>;
  handleOpenInBrowser: () => Promise<void>;
  handleDone: () => void;
}

/**
 * Hook to manage confirmation screen handlers
 * - View explorer
 * - Share/copy/open deeplink
 * - Done button
 */
export function useConfirmationHandlers({
  broadcastedTxid,
  turboDeeplink,
  fetchTransactionHistory,
  navigation,
  showToast,
}: UseConfirmationHandlersParams): UseConfirmationHandlersReturn {
  const handleViewExplorer = useCallback(() => {
    if (broadcastedTxid) {
      Linking.openURL(getTxUrl(broadcastedTxid));
    }
  }, [broadcastedTxid]);

  const handleShareDeeplink = useCallback(async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[useConfirmationHandlers] Sharing Turbo deeplink:', turboDeeplink);
        await Share.share({
          message: turboDeeplink,
          title: 'Receive UNIT',
        });
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to share link:', { error: error instanceof Error ? error.message : String(error) });
        showToast('Failed to share link. Please try again.', 'error');
      }
    }
  }, [turboDeeplink, showToast]);

  const handleCopyDeeplink = useCallback(async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[useConfirmationHandlers] Copying Turbo deeplink to clipboard:', turboDeeplink);
        await Clipboard.setStringAsync(turboDeeplink);
        showToast('Link copied to clipboard', 'info');
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to copy link:', { error: error instanceof Error ? error.message : String(error) });
        showToast('Failed to copy link. Please try again.', 'error');
      }
    }
  }, [turboDeeplink, showToast]);

  const handleOpenInBrowser = useCallback(async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[useConfirmationHandlers] Opening Turbo deeplink in browser:', turboDeeplink);
        await Linking.openURL(turboDeeplink);
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to open link:', { error: error instanceof Error ? error.message : String(error) });
        showToast('Failed to open link. Please try again.', 'error');
      }
    }
  }, [turboDeeplink, showToast]);

  const handleDone = useCallback(() => {
    // Refresh transaction history one more time before closing
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }

    // Dismiss the send flow modal
    // Add a small delay to allow the fetch to start
    setTimeout(() => {
      navigation.getParent()?.goBack();
    }, 100);
  }, [fetchTransactionHistory, navigation]);

  return {
    handleViewExplorer,
    handleShareDeeplink,
    handleCopyDeeplink,
    handleOpenInBrowser,
    handleDone,
  };
}
