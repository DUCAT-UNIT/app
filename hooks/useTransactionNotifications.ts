/**
 * useTransactionNotifications - Hook for handling transaction state notifications
 * Extracts transaction notification logic from WalletPage
 */

import { useEffect } from 'react';
import { Linking } from 'react-native';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import type { SnackbarParams } from '../stores/notificationStore';

interface UseTransactionNotificationsParams {
  intentStep: string | undefined;
  broadcastedTxid: string | undefined;
  sendAssetType: string | undefined;
  showSnackbar: (params: SnackbarParams) => void;
}

/**
 * Hook for showing transaction state notifications
 */
export function useTransactionNotifications({
  intentStep,
  broadcastedTxid,
  sendAssetType,
  showSnackbar,
}: UseTransactionNotificationsParams): void {
  useEffect(() => {
    if (!broadcastedTxid) return;

    const action = sendAssetType === 'unit' ? 'swap' : 'btc_send';
    const onPress = async (): Promise<void> => {
      const url = sendAssetType === 'unit' ? getOrdTxUrl(broadcastedTxid) : getTxUrl(broadcastedTxid);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    };

    if (intentStep === 'pending') {
      // Step 1: Green check mark - "submitted" (transaction broadcast to network)
      showSnackbar({
        type: 'submitted',
        action,
        txid: broadcastedTxid,
        onPress,
      });
    } else if (intentStep === 'confirmed') {
      // Step 2: Green check mark - "completed successfully!" (transaction confirmed)
      showSnackbar({
        type: 'success',
        action,
        txid: broadcastedTxid,
        onPress,
      });
    }
  }, [intentStep, broadcastedTxid, sendAssetType, showSnackbar]);
}
