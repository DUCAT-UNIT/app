/**
 * useVaultMessages Hook
 * Handles WebView message events including PSBT signing, console logs, and snackbars
 */

import { useCallback } from 'react';
import { signPsbt } from '../utils/wallet';
import { logger } from '../utils/logger';

export function useVaultMessages(
  webViewRef,
  showSnackbar,
  injectWalletCredentials,
  setIsLoading,
  setPreparingVault,
  loadingTimeoutRef,
  handleCredentialConfirmation
) {
  const handleMessage = useCallback(async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // Forward WebView console logs to Metro console
      if (message.type === 'CONSOLE_LOG') {
        const prefix = message.level === 'error' ? '❌' : message.level === 'warn' ? '⚠️' : '📱';
        logger.debug(`${prefix} [WebView Console]`, ...message.args);
        return;
      }

      // Handle credentials received confirmation
      if (message.type === 'CREDENTIALS_RECEIVED') {
        logger.debug('✅ CREDENTIALS_RECEIVED message received from vault');
        if (handleCredentialConfirmation && message.payload?.vaultPubkey) {
          handleCredentialConfirmation(message.payload.vaultPubkey);
        }
        return;
      }

      // Handle vault loaded event
      if (message.type === 'VAULT_LOADED') {
        logger.debug('✅ VAULT_LOADED message received - vault page is ready');

        // Clear the loading timeout since vault is ready
        if (loadingTimeoutRef?.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
          logger.debug('🧹 Cleared loading timeout - vault responded in time');
        }

        setIsLoading(false);
        setPreparingVault(false);

        // Final credential injection when vault is fully loaded
        setTimeout(() => {
          logger.debug('🏦 Final credential injection after VAULT_LOADED');
          injectWalletCredentials();
        }, 500);
        return;
      }

      // Handle PSBT signing requests
      if (message.type === 'SIGN_PSBT_REQUEST') {
        await handlePsbtSigningRequest(message, webViewRef);
        return;
      }

      // Handle snackbar messages from web app
      if (message.type === 'SHOW_SNACKBAR') {
        logger.debug('📬 SHOW_SNACKBAR received:', message.payload);
        if (showSnackbar) {
          showSnackbar(message.payload);
        }
        return;
      }
    } catch (e) {
      logger.error('❌ Error parsing WebView message:', e);
    }
  }, [webViewRef, showSnackbar, injectWalletCredentials, setIsLoading, setPreparingVault, loadingTimeoutRef, handleCredentialConfirmation]);

  return { handleMessage };
}

/**
 * Handle PSBT signing request from WebView
 */
async function handlePsbtSigningRequest(message, webViewRef) {
  const { requestId, psbt, signInputs } = message.payload;

  try {
    // Sign the PSBT using the mobile wallet
    const signedPsbt = await signPsbt(psbt, signInputs);

    // Send success response back to WebView
    const responseData = {
      type: 'SIGN_PSBT_RESPONSE',
      payload: {
        requestId,
        signedPsbt,
      },
    };

    webViewRef.current?.injectJavaScript(`
      (function() {
        window.postMessage(${JSON.stringify(responseData)}, '*');
      })();
      true;
    `);
  } catch (error) {
    // Send error response back to WebView
    const responseData = {
      type: 'SIGN_PSBT_RESPONSE',
      payload: {
        requestId,
        error: error.message || String(error),
      },
    };

    webViewRef.current?.injectJavaScript(`
      (function() {
        window.postMessage(${JSON.stringify(responseData)}, '*');
      })();
      true;
    `);
  }
}
