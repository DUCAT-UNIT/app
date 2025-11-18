/**
 * useRefreshControl
 * Hook for pull-to-refresh functionality with haptic feedback
 *
 * Architecture: Custom hook (< 200 lines)
 * Returns: 2 values (refreshing state, refresh handler)
 * Complexity: Single responsibility - refresh control logic
 */

import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Hook for managing pull-to-refresh with haptic feedback
 * @param {Function} onRefresh - Async function to call on refresh
 * @returns {Object} { refreshing, onRefresh: refreshHandler }
 */
export const useRefreshControl = (onRefresh) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    // Light haptic on pull start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setRefreshing(true);

    try {
      await onRefresh();
      // Success haptic on complete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Error haptic on failure
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, onRefresh]);

  return {
    refreshing,
    onRefresh: handleRefresh,
  };
};
