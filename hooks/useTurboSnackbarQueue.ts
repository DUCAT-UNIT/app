/**
 * useTurboSnackbarQueue Hook
 * Manages queued snackbars for Turbo token operations
 */

import React from 'react';
import { logger } from '../utils/logger';
import { turboGlobal } from '../services/turbo/turboTokenStorage';
import type { SnackbarParams, SnackbarType } from '../types/notification';

interface UseTurboSnackbarQueueParams {
  isAuthenticated: boolean;
  shouldShowPinOverlay: boolean;
  showSnackbar: (params: SnackbarParams) => void;
  dismissSnackbar: () => void;
}

interface UseTurboSnackbarQueueReturn {
  showSnackbarWithDedup: (params: SnackbarParams) => void;
}

/**
 * Hook to manage queued Turbo snackbars with deduplication
 */
export function useTurboSnackbarQueue({
  isAuthenticated,
  shouldShowPinOverlay,
  showSnackbar,
  dismissSnackbar,
}: UseTurboSnackbarQueueParams): UseTurboSnackbarQueueReturn {
  const lastShownSnackbarRef = React.useRef<SnackbarParams | null>(null);
  const lastShownTimeRef = React.useRef(0);

  // Wrapper to prevent duplicate snackbars within 3 seconds
  const showSnackbarWithDedup = React.useCallback((snackbarParams: SnackbarParams) => {
    const now = Date.now();
    const lastShown = lastShownSnackbarRef.current;
    const timeSinceLastShown = now - lastShownTimeRef.current;

    const isDuplicate = lastShown &&
      lastShown.type === snackbarParams.type &&
      lastShown.action === snackbarParams.action &&
      lastShown.description === snackbarParams.description &&
      timeSinceLastShown < 3000;

    if (isDuplicate) {
      logger.debug('[TURBO] Blocking duplicate snackbar (shown', timeSinceLastShown, 'ms ago)');
      return;
    }

    logger.debug('[TURBO] Showing snackbar:', snackbarParams.description);
    showSnackbar(snackbarParams);
    lastShownSnackbarRef.current = snackbarParams;
    lastShownTimeRef.current = now;
  }, [showSnackbar]);

  // Poll for queued snackbars
  React.useEffect(() => {
    if (!isAuthenticated || shouldShowPinOverlay) {
      return;
    }

    let isMounted = true;

    const checkQueuedSnackbars = () => {
      if (!isMounted) return;
      if (turboGlobal.pendingTurboSnackbars && turboGlobal.pendingTurboSnackbars.length > 0) {
        logger.debug('[TURBO] Showing queued snackbar');
        const lastSnackbar = turboGlobal.pendingTurboSnackbars[turboGlobal.pendingTurboSnackbars.length - 1];
        // Convert TurboSnackbarParams to SnackbarParams format with proper type
        showSnackbarWithDedup({
          type: lastSnackbar.type as SnackbarType,
          message: lastSnackbar.message,
        });
        turboGlobal.pendingTurboSnackbars = [];
      }
    };

    checkQueuedSnackbars();
    const interval = setInterval(checkQueuedSnackbars, 500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, shouldShowPinOverlay, showSnackbarWithDedup]);

  return { showSnackbarWithDedup };
}
