/**
 * useVaultWebView Hook
 * Manages WebView state, URL building, credential injection, and account switching
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';

export function useVaultWebView(walletCredentials, vaultData, visible) {
  const webViewRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const loadedVaultPubkeyRef = useRef('');
  const [forceReloadKey, setForceReloadKey] = useState(0);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  // Credential injection state
  const injectionAttemptRef = useRef(0);
  const maxInjectionAttempts = 3;
  const injectionTimeoutRef = useRef(null);
  const credentialsConfirmedRef = useRef(false);

  // Build URL with wallet credentials + cache busting on account switch
  const webViewUrl = useMemo(() => {
    if (!walletCredentials) {
      return API.PHONE;
    }

    const params = new URLSearchParams({
      satsAddress: walletCredentials.satsAddress,
      satsPubkey: walletCredentials.satsPubkey,
      runesAddress: walletCredentials.runesAddress,
      runesPubkey: walletCredentials.runesPubkey,
      vaultAddress: walletCredentials.vaultAddress,
      vaultPubkey: walletCredentials.vaultPubkey,
      network: 'mutinynet',
      // Only add timestamp when forceReloadKey changes (account switch)
      ...(forceReloadKey > 0 && { _t: forceReloadKey }),
    });

    return `${API.PHONE}/?${params.toString()}`;
  }, [walletCredentials, forceReloadKey]);

  // Validate credentials before injection
  const validateCredentials = useCallback((credentials) => {
    if (!credentials) return false;

    const required = ['satsAddress', 'satsPubkey', 'runesAddress', 'runesPubkey', 'vaultAddress', 'vaultPubkey'];
    const isValid = required.every(field => {
      const value = credentials[field];
      return value && typeof value === 'string' && value.length > 0;
    });

    if (!isValid) {
      logger.error('❌ Invalid credentials - missing required fields');
      return false;
    }

    // Validate address formats (basic check)
    const addressFields = ['satsAddress', 'runesAddress', 'vaultAddress'];
    const hasValidAddresses = addressFields.every(field => {
      const address = credentials[field];
      return address.startsWith('tb1') || address.startsWith('bc1'); // Bitcoin addresses
    });

    if (!hasValidAddresses) {
      logger.error('❌ Invalid address format in credentials');
      return false;
    }

    return true;
  }, []);

  // Inject wallet credentials into WebView with retry logic
  const injectWalletCredentials = useCallback((isRetry = false) => {
    if (!webViewRef.current || !walletCredentials) {
      logger.debug('⚠️ Cannot inject vault credentials - waiting for WebView and credentials to be ready');
      return;
    }

    // Validate credentials before injection
    if (!validateCredentials(walletCredentials)) {
      logger.error('❌ Vault credential validation failed - please check wallet configuration');
      return;
    }

    if (!isRetry) {
      injectionAttemptRef.current = 0;
      credentialsConfirmedRef.current = false;
    }

    injectionAttemptRef.current += 1;
    logger.debug(`🏦 Injecting wallet credentials (attempt ${injectionAttemptRef.current}/${maxInjectionAttempts})`);

    const credentialsScript = `
      (function() {
        // Mobile app injecting wallet credentials
        // Vault pubkey: ${walletCredentials.vaultPubkey}

        // Clear any existing credentials and specific localStorage keys
        delete window.mobileWalletCredentials;
        try {
          if (window.localStorage) {
            // Clear only specific known vault-related keys
            const vaultKeys = ['ducat_vault_state', 'ducat_wallet_cache', 'ducat_credentials'];
            vaultKeys.forEach(key => {
              try {
                localStorage.removeItem(key);
              } catch (e) {
                // Could not remove key (silent fail)
              }
            });
          }
        } catch (e) {
          // Could not access localStorage (silent fail)
        }

        // Store credentials in window object
        window.mobileWalletCredentials = {
          satsAddress: '${walletCredentials.satsAddress}',
          satsPubkey: '${walletCredentials.satsPubkey}',
          runesAddress: '${walletCredentials.runesAddress}',
          runesPubkey: '${walletCredentials.runesPubkey}',
          vaultAddress: '${walletCredentials.vaultAddress}',
          vaultPubkey: '${walletCredentials.vaultPubkey}',
          network: 'mutinynet',
          timestamp: Date.now(),
          injectionAttempt: ${injectionAttemptRef.current}
        };

        // Send confirmation message back to app
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CREDENTIALS_RECEIVED',
            payload: {
              vaultPubkey: '${walletCredentials.vaultPubkey}',
              timestamp: Date.now(),
              attempt: ${injectionAttemptRef.current}
            }
          }));
        } catch (e) {
          // Failed to send CREDENTIALS_RECEIVED message (silent fail)
        }

        // Dispatch events to notify app (for backward compatibility)
        window.dispatchEvent(new CustomEvent('mobileWalletReady', {
          detail: window.mobileWalletCredentials
        }));

        window.dispatchEvent(new CustomEvent('mobileAccountChanged', {
          detail: window.mobileWalletCredentials
        }));

        // Mobile wallet credentials injected and events dispatched
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(credentialsScript);

    // Set timeout to retry if no confirmation received
    if (injectionTimeoutRef.current) {
      clearTimeout(injectionTimeoutRef.current);
    }

    injectionTimeoutRef.current = setTimeout(() => {
      if (!credentialsConfirmedRef.current && injectionAttemptRef.current < maxInjectionAttempts) {
        logger.debug(`⚠️ Vault hasn't confirmed credentials yet, retrying (attempt ${injectionAttemptRef.current + 1} of ${maxInjectionAttempts})`);
        injectWalletCredentials(true);
      } else if (injectionAttemptRef.current >= maxInjectionAttempts) {
        logger.error('❌ Failed to connect vault after 3 attempts - vault may not load properly. Try refreshing the vault tab.');
      }
    }, 3000); // Wait 3 seconds for confirmation

  }, [walletCredentials, validateCredentials]);

  // Handle credential confirmation from WebView
  const handleCredentialConfirmation = useCallback((pubkey) => {
    if (pubkey === walletCredentials?.vaultPubkey) {
      credentialsConfirmedRef.current = true;
      if (injectionTimeoutRef.current) {
        clearTimeout(injectionTimeoutRef.current);
        injectionTimeoutRef.current = null;
      }
      logger.debug('✅ Credentials confirmed by vault WebView');
    }
  }, [walletCredentials]);

  // Inject wallet credentials when vault becomes visible (first time only)
  useEffect(() => {
    if (visible && !hasLoadedOnceRef.current) {
      logger.debug('🏦 Vault opened for the first time - preparing to connect your wallet');
      setTimeout(() => {
        injectWalletCredentials();
      }, 1000);
    }
  }, [visible, injectWalletCredentials]);

  // Detect account change and trigger reload
  useEffect(() => {
    if (!walletCredentials?.vaultPubkey) return;

    const currentPubkey = walletCredentials.vaultPubkey;

    // If pubkey changed, immediately show loading
    if (loadedVaultPubkeyRef.current && loadedVaultPubkeyRef.current !== currentPubkey) {
      logger.debug('🔄 Account switch detected - updating vault to show new account data');

      const vaultDataFetched = vaultData !== undefined;

      if (vaultDataFetched) {
        logger.debug('🔄 New account data ready, reloading vault interface now');

        // Force reload by changing key
        const newReloadKey = Date.now();
        setForceReloadKey(newReloadKey);
        loadedVaultPubkeyRef.current = currentPubkey;

        // Re-inject credentials after reload
        setTimeout(() => {
          logger.debug('🔄 Connecting vault to your new account');
          injectWalletCredentials();
        }, 2000);
      } else {
        logger.debug('🔄 Fetching data for your new account...');
      }
    } else if (!loadedVaultPubkeyRef.current) {
      // Initial load - credentials just became available
      logger.debug('🔄 Loading vault for your current account');
      loadedVaultPubkeyRef.current = currentPubkey;

      // CRITICAL FIX: Inject credentials on first load if WebView is ready
      // This handles the case where credentials load after the vault tab is already visible
      if (webViewLoaded && visible) {
        logger.debug('🔄 Vault is ready - injecting credentials for first time');
        setTimeout(() => {
          injectWalletCredentials();
        }, 500);
      }
    }
  }, [walletCredentials, vaultData, injectWalletCredentials, visible, webViewLoaded]);

  // Reload when vaultData is fetched after account switch
  useEffect(() => {
    if (!walletCredentials?.vaultPubkey) return;

    const currentPubkey = walletCredentials.vaultPubkey;
    const vaultDataFetched = vaultData !== undefined;

    // If waiting for vault data after account switch
    if (vaultDataFetched && loadedVaultPubkeyRef.current !== currentPubkey) {
      logger.debug('🔄 Account data loaded, updating vault display');

      const newReloadKey = Date.now();
      setForceReloadKey(newReloadKey);
      loadedVaultPubkeyRef.current = currentPubkey;

      setTimeout(() => {
        logger.debug('🔄 Syncing vault with your account credentials');
        injectWalletCredentials();
      }, 2000);
    }
  }, [vaultData, walletCredentials, injectWalletCredentials]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (injectionTimeoutRef.current) {
        clearTimeout(injectionTimeoutRef.current);
        injectionTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    webViewRef,
    webViewUrl,
    forceReloadKey,
    webViewLoaded,
    setWebViewLoaded,
    hasLoadedOnceRef,
    injectWalletCredentials,
    handleCredentialConfirmation,
  };
}
