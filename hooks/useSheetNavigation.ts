/**
 * useSheetNavigation Hook
 * Manages bottom sheet visibility for:
 * - Receive sheet
 * - Transaction history sheet
 */

import { useState, Dispatch, SetStateAction } from 'react';

interface UseSheetNavigationReturn {
  showReceiveSheet: boolean;
  setShowReceiveSheet: Dispatch<SetStateAction<boolean>>;
  showTxHistory: boolean;
  setShowTxHistory: Dispatch<SetStateAction<boolean>>;
}

export function useSheetNavigation(): UseSheetNavigationReturn {
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
