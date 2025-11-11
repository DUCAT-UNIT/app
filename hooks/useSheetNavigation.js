/**
 * useSheetNavigation Hook
 * Manages bottom sheet visibility for:
 * - Receive sheet
 * - Transaction history sheet
 */

import { useState } from 'react';

export function useSheetNavigation() {
  const [showReceiveSheet, setShowReceiveSheet] = useState(false);
  const [showTxHistory, setShowTxHistory] = useState(false);

  return {
    // Receive sheet
    showReceiveSheet,
    setShowReceiveSheet,

    // Transaction history sheet
    showTxHistory,
    setShowTxHistory,
  };
}
