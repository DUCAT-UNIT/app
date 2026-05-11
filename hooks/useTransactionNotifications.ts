/**
 * useTransactionNotifications - Hook for handling transaction state notifications
 * Extracts transaction notification logic from WalletPage
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { getTxUrl, getOrdTxUrl } from '../utils/constants';
import type { SnackbarParams } from '../stores/notificationStore';

interface UseTransactionNotificationsParams {
  intentStep: string | undefined;
  broadcastedTxid: string | undefined;
  sendAssetType: string | undefined;
  turboEnabled?: boolean;
  btcTurboEnabled?: boolean;
  showSnackbar: (params: SnackbarParams) => void;
}

/**
 * Hook for showing transaction state notifications
 */
export function useTransactionNotifications({
  intentStep,
  broadcastedTxid,
  sendAssetType,
  turboEnabled = false,
  btcTurboEnabled = false,
  showSnackbar,
}: UseTransactionNotificationsParams): void {
  const actionRef = useRef<{ txid: string; action: string; assetType?: string } | null>(null);

  useEffect(() => {
    if (!broadcastedTxid) return;

    // Determine action based on asset type and turbo mode
    const currentAction = sendAssetType === 'unit'
      ? (turboEnabled ? 'swap' : 'unit_send')
      : (btcTurboEnabled ? 'btc_swap' : 'btc_send');
    if (actionRef.current?.txid !== broadcastedTxid) {
      actionRef.current = { txid: broadcastedTxid, action: currentAction, assetType: sendAssetType };
    }
    const action = actionRef.current.action;
    const onPress = async (): Promise<void> => {
      const url = actionRef.current?.assetType === 'unit'
        ? getOrdTxUrl(broadcastedTxid)
        : getTxUrl(broadcastedTxid);
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
  }, [intentStep, broadcastedTxid, sendAssetType, turboEnabled, btcTurboEnabled, showSnackbar]);
}
