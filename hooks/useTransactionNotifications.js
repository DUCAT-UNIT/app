/**
 * useTransactionNotifications - Hook for handling transaction state notifications
 * Extracts transaction notification logic from WalletPage
 */

import { useEffect } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook for showing transaction state notifications
 * @param {Object} params
 * @param {string} params.intentStep - Transaction intent step (pending/confirmed)
 * @param {string} params.broadcastedTxid - Broadcasted transaction ID
 * @param {string} params.sendAssetType - Asset type being sent (unit/other)
 * @param {Function} params.showSnackbar - Function to show snackbar
 */
export function useTransactionNotifications({
  intentStep,
  broadcastedTxid,
  sendAssetType,
  showSnackbar,
}) {
  useEffect(() => {
    if (!broadcastedTxid) return;

    const action = sendAssetType === 'unit' ? 'swap' : 'withdraw';
    const clickAction = async () => {
      const { getTxUrl, getOrdTxUrl } = require('../utils/constants');
      const { Linking } = require('react-native');
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
        clickAction,
      });
    } else if (intentStep === 'confirmed') {
      // Step 2: Green check mark - "completed successfully!" (transaction confirmed)
      showSnackbar({
        type: 'success',
        action,
        txid: broadcastedTxid,
        clickAction,
      });
    }
  }, [intentStep, broadcastedTxid, sendAssetType, showSnackbar]);
}
