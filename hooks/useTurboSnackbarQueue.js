/**
 * useTurboSnackbarQueue Hook
 * Manages queued snackbars for Turbo token operations
 */

import React from 'react';
import { logger } from '../utils/logger';

/**
 * Hook to manage queued Turbo snackbars with deduplication
 */
export function useTurboSnackbarQueue({
  isAuthenticated,
  shouldShowPinOverlay,
  showSnackbar,
  dismissSnackbar,
}) {
  const lastShownSnackbarRef = React.useRef(null);
  const lastShownTimeRef = React.useRef(0);

  // Wrapper to prevent duplicate snackbars within 3 seconds
  const showSnackbarWithDedup = React.useCallback((snackbarParams) => {
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

    const checkQueuedSnackbars = () => {
      if (global.pendingTurboSnackbars && global.pendingTurboSnackbars.length > 0) {
        logger.debug('[TURBO] Showing queued snackbar');
        const lastSnackbar = global.pendingTurboSnackbars[global.pendingTurboSnackbars.length - 1];
        showSnackbarWithDedup(lastSnackbar);
        global.pendingTurboSnackbars = [];
      }
    };

    checkQueuedSnackbars();
    const interval = setInterval(checkQueuedSnackbars, 500);

    // Expose globally
    global.showTurboSnackbar = showSnackbarWithDedup;
    global.dismissTurboSnackbar = () => {
      global.pendingTurboSnackbars = [];
      lastShownSnackbarRef.current = null;
      lastShownTimeRef.current = 0;
      dismissSnackbar();
    };

    return () => {
      clearInterval(interval);
      delete global.showTurboSnackbar;
      delete global.dismissTurboSnackbar;
    };
  }, [isAuthenticated, shouldShowPinOverlay, showSnackbarWithDedup, dismissSnackbar]);

  return { showSnackbarWithDedup };
}
