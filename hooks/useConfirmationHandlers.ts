import { useCallback } from 'react';
import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getTxUrl } from '../utils/constants';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';
import { useSendFlowStore } from '../stores/sendFlowStore';
import {
  cashuUnitTokenSymbol,
  DEFAULT_CASHU_UNIT,
  type CashuUnit,
} from '../services/cashu/cashuUnits';

interface NavigationWithParent {
  getParent: () => { goBack: () => void } | undefined;
}

interface UseConfirmationHandlersParams {
  broadcastedTxid: string | undefined;
  turboDeeplink: string | undefined;
  cashuUnit?: CashuUnit;
  fetchTransactionHistory: (() => void) | undefined;
  navigation: NavigationWithParent;
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
  cashuUnit = DEFAULT_CASHU_UNIT,
  fetchTransactionHistory,
  navigation,
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
          title: `Receive ${cashuUnitTokenSymbol(cashuUnit)}`,
        });
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to share link:', { error: error instanceof Error ? error.message : String(error) });
        notify.link.shareFailed();
      }
    }
  }, [turboDeeplink, cashuUnit]);

  const handleCopyDeeplink = useCallback(async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[useConfirmationHandlers] Copying Turbo deeplink to clipboard:', turboDeeplink);
        await Clipboard.setStringAsync(turboDeeplink);
        notify.clipboard.linkCopied();
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to copy link:', { error: error instanceof Error ? error.message : String(error) });
        notify.link.copyFailed();
      }
    }
  }, [turboDeeplink]);

  const handleOpenInBrowser = useCallback(async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[useConfirmationHandlers] Opening Turbo deeplink in browser:', turboDeeplink);
        await Linking.openURL(turboDeeplink);
      } catch (error: unknown) {
        logger.error('[useConfirmationHandlers] Failed to open link:', { error: error instanceof Error ? error.message : String(error) });
        notify.link.openFailed();
      }
    }
  }, [turboDeeplink]);

  const resetSendFlow = useSendFlowStore((state) => state.resetSendFlow);

  const handleDone = useCallback(() => {
    // Refresh transaction history one more time before closing
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }

    // Reset the send flow state to clean up for next transaction
    resetSendFlow();

    // Dismiss the send flow modal
    // Add a small delay to allow the fetch to start
    setTimeout(() => {
      navigation.getParent()?.goBack();
    }, 100);
  }, [fetchTransactionHistory, navigation, resetSendFlow]);

  return {
    handleViewExplorer,
    handleShareDeeplink,
    handleCopyDeeplink,
    handleOpenInBrowser,
    handleDone,
  };
}
