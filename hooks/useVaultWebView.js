/**
 * useVaultWebView Hook
 * Manages WebView state, URL building, credential injection, and account switching
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { API } from '../utils/constants';

export function useVaultWebView(walletCredentials, vaultData, visible) {
  const webViewRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const loadedVaultPubkeyRef = useRef('');
  const [forceReloadKey, setForceReloadKey] = useState(0);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

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

  // Inject wallet credentials into WebView
  const injectWalletCredentials = useCallback(() => {
    if (webViewRef.current && walletCredentials) {
      console.log('🏦 Injecting wallet credentials into vault page');

      const credentialsScript = `
        (function() {
          console.log('Mobile app injecting wallet credentials');
          console.log('Vault pubkey:', '${walletCredentials.vaultPubkey}');

          // Clear any existing credentials and localStorage
          delete window.mobileWalletCredentials;
          try {
            if (window.localStorage) {
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('vault') || key.includes('wallet') || key.includes('credentials'))) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => localStorage.removeItem(key));
            }
          } catch (e) {
            console.log('Could not clear localStorage:', e);
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
            timestamp: Date.now()
          };

          // Dispatch events to notify app
          window.dispatchEvent(new CustomEvent('mobileWalletReady', {
            detail: window.mobileWalletCredentials
          }));

          window.dispatchEvent(new CustomEvent('mobileAccountChanged', {
            detail: window.mobileWalletCredentials
          }));

          console.log('Mobile wallet credentials injected and events dispatched');
        })();
        true;
      `;

      webViewRef.current.injectJavaScript(credentialsScript);
    }
  }, [walletCredentials]);

  // Inject wallet credentials when vault becomes visible (first time only)
  useEffect(() => {
    if (visible && !hasLoadedOnceRef.current) {
      console.log('🏦 Vault became visible for first time - will inject wallet credentials');
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
      console.log('🔄 Account switch detected');

      const vaultDataFetched = vaultData !== undefined;

      if (vaultDataFetched) {
        console.log('🔄 Vault data already fetched, reloading now');

        // Force reload by changing key
        const newReloadKey = Date.now();
        setForceReloadKey(newReloadKey);
        loadedVaultPubkeyRef.current = currentPubkey;

        // Re-inject credentials after reload
        setTimeout(() => {
          console.log('🔄 Re-injecting credentials after account switch');
          injectWalletCredentials();
        }, 2000);
      } else {
        console.log('🔄 Waiting for vault data to be fetched...');
      }
    } else if (!loadedVaultPubkeyRef.current) {
      // Initial load
      console.log('🔄 Initial vault load for pubkey:', currentPubkey);
      loadedVaultPubkeyRef.current = currentPubkey;
    }
  }, [walletCredentials, vaultData, injectWalletCredentials]);

  // Reload when vaultData is fetched after account switch
  useEffect(() => {
    if (!walletCredentials?.vaultPubkey) return;

    const currentPubkey = walletCredentials.vaultPubkey;
    const vaultDataFetched = vaultData !== undefined;

    // If waiting for vault data after account switch
    if (vaultDataFetched && loadedVaultPubkeyRef.current !== currentPubkey) {
      console.log('🔄 Vault data fetched, reloading WebView now');

      const newReloadKey = Date.now();
      setForceReloadKey(newReloadKey);
      loadedVaultPubkeyRef.current = currentPubkey;

      setTimeout(() => {
        console.log('🔄 Re-injecting credentials after vault data fetch');
        injectWalletCredentials();
      }, 2000);
    }
  }, [vaultData, walletCredentials, injectWalletCredentials]);

  return {
    webViewRef,
    webViewUrl,
    forceReloadKey,
    webViewLoaded,
    setWebViewLoaded,
    hasLoadedOnceRef,
    injectWalletCredentials,
  };
}
