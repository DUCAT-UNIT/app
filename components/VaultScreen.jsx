import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';
import { API } from '../utils/constants';

const VaultScreen = React.memo(function VaultScreen({ visible, walletCredentials, _autoCreateVaultTrigger, vaultData, showToast, showNotification }) {
  const webViewRef = useRef(null);
  const messageIndexRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [preparingVault, setPreparingVault] = React.useState(true); // Start true to show loading initially
  const [preparingMessage, setPreparingMessage] = React.useState('Preparing the vault for you');
  const [_webViewLoaded, setWebViewLoaded] = React.useState(false);

  const shouldShowLoading = isLoading || preparingVault;

  // Rotate through preparing messages
  React.useEffect(() => {
    if (!preparingVault) {
      messageIndexRef.current = 0;
      setPreparingMessage('Preparing the vault for you');
      return;
    }

    const messages = [
      'Preparing the vault for you',
      'Initializing secure parameters',
      'Generating vault credentials',
      'Configuring collateral settings',
      'Establishing Bitcoin connection',
      'Verifying network parameters',
      'Almost there...',
    ];

    // Reset to first message when starting
    messageIndexRef.current = 0;
    setPreparingMessage(messages[0]);

    const interval = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % messages.length;
      const newMessage = messages[messageIndexRef.current];
      setPreparingMessage(newMessage);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [preparingVault]);

  // Reset loading message when leaving the vault screen (but keep loaded state)
  React.useEffect(() => {
    if (!visible) {
      setPreparingVault(false);
      setPreparingMessage('Preparing the vault for you');
      messageIndexRef.current = 0;
    }
  }, [visible]);

  // Force wallet connection when vault becomes visible AND page is loaded
  const injectWalletCredentials = React.useCallback(() => {
    if (webViewRef.current && walletCredentials) {
      console.log('🏦 Injecting wallet credentials into vault page');
      console.log('🏦 Credentials being injected:', {
        vaultPubkey: walletCredentials.vaultPubkey,
        vaultAddress: walletCredentials.vaultAddress,
        satsAddress: walletCredentials.satsAddress,
      });

      // Inject wallet credentials directly into the page
      const credentialsScript = `
        (function() {
          console.log('Mobile app injecting wallet credentials');
          console.log('Vault pubkey:', '${walletCredentials.vaultPubkey}');

          // Clear any existing credentials and localStorage
          delete window.mobileWalletCredentials;
          try {
            // Clear any cached vault data that might be stored
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

          // Store credentials in window object for the app to access
          window.mobileWalletCredentials = {
            satsAddress: '${walletCredentials.satsAddress}',
            satsPubkey: '${walletCredentials.satsPubkey}',
            runesAddress: '${walletCredentials.runesAddress}',
            runesPubkey: '${walletCredentials.runesPubkey}',
            vaultAddress: '${walletCredentials.vaultAddress}',
            vaultPubkey: '${walletCredentials.vaultPubkey}',
            network: 'mutinynet',
            timestamp: Date.now() // Add timestamp to force refresh detection
          };

          // Dispatch event to notify app that credentials are ready
          window.dispatchEvent(new CustomEvent('mobileWalletReady', {
            detail: window.mobileWalletCredentials
          }));

          // Also dispatch account change event for web app to detect
          window.dispatchEvent(new CustomEvent('mobileAccountChanged', {
            detail: window.mobileWalletCredentials
          }));

          console.log('Mobile wallet credentials injected and events dispatched');
          console.log('Credentials:', window.mobileWalletCredentials);
        })();
        true;
      `;

      webViewRef.current.injectJavaScript(credentialsScript);
    }
  }, [walletCredentials]);

  // Inject wallet credentials when vault becomes visible (only first time)
  React.useEffect(() => {
    if (visible && !hasLoadedOnceRef.current) {
      console.log('🏦 Vault became visible for first time - will inject wallet credentials');
      console.log('🏦 Vault WebView credentials:', {
        vaultAddress: walletCredentials?.vaultAddress,
        vaultPubkey: walletCredentials?.vaultPubkey,
        satsAddress: walletCredentials?.satsAddress,
        runesAddress: walletCredentials?.runesAddress,
      });
      setTimeout(() => {
        injectWalletCredentials();
      }, 1000);
    }
  }, [visible, injectWalletCredentials]);

  // Track the pubkey that corresponds to current WebView state
  const loadedVaultPubkeyRef = React.useRef('');
  const [forceReloadKey, setForceReloadKey] = React.useState(0);

  // Detect account change immediately and show loading, then reload when data is ready
  React.useEffect(() => {
    // Only trigger reload when we have wallet credentials
    if (!walletCredentials?.vaultPubkey) return;

    const currentPubkey = walletCredentials.vaultPubkey;

    // If pubkey changed, immediately show loading (prevent flash of old vault)
    if (loadedVaultPubkeyRef.current && loadedVaultPubkeyRef.current !== currentPubkey) {
      console.log('🔄 Account switch detected - showing loading immediately');
      console.log('Old pubkey:', loadedVaultPubkeyRef.current);
      console.log('New pubkey:', currentPubkey);

      // Immediately show loading spinner to prevent flash of old vault
      setIsLoading(true);
      setWebViewLoaded(false);
      hasLoadedOnceRef.current = false;
      setPreparingVault(true);

      // Check if vaultData has been fetched (or confirmed as null) for this pubkey
      // vaultData being null is valid (means no vault created yet)
      const vaultDataFetched = vaultData !== undefined;

      if (vaultDataFetched) {
        console.log('🔄 Vault data already fetched for new account, reloading now');
        console.log('New vault data:', vaultData ? {
          vaultTag: vaultData.vaultTag,
          totalDebt: vaultData.totalDebt,
          totalCollateral: vaultData.totalCollateral,
        } : 'No vault (null)');

        // Force complete reload by changing key (unmount/remount WebView)
        const newReloadKey = Date.now();
        console.log('🔄 Setting forceReloadKey to:', newReloadKey);
        setForceReloadKey(newReloadKey);

        // Update ref to track the new pubkey being loaded
        loadedVaultPubkeyRef.current = currentPubkey;

        // Inject credentials after WebView has time to fully reload
        setTimeout(() => {
          console.log('🔄 Re-injecting credentials after account switch (2000ms)');
          console.log('🔄 Injecting for vault:', currentPubkey);
          injectWalletCredentials();
        }, 2000);
      } else {
        console.log('🔄 Waiting for vault data to be fetched...');
        // Will trigger reload when vaultData changes
      }
    } else if (!loadedVaultPubkeyRef.current) {
      // Initial load - just set the ref without triggering reload
      console.log('🔄 Initial vault load for pubkey:', currentPubkey);
      loadedVaultPubkeyRef.current = currentPubkey;
    }
  }, [walletCredentials, injectWalletCredentials]);

  // Reload when vaultData is fetched after account switch
  React.useEffect(() => {
    if (!walletCredentials?.vaultPubkey) return;

    const currentPubkey = walletCredentials.vaultPubkey;
    const vaultDataFetched = vaultData !== undefined;

    // If we're waiting for vault data after account switch
    if (vaultDataFetched && loadedVaultPubkeyRef.current !== currentPubkey && isLoading) {
      console.log('🔄 Vault data fetched, reloading WebView now');
      console.log('New vault data:', vaultData ? {
        vaultTag: vaultData.vaultTag,
        totalDebt: vaultData.totalDebt,
        totalCollateral: vaultData.totalCollateral,
      } : 'No vault (null)');

      // Force complete reload by changing key (unmount/remount WebView)
      const newReloadKey = Date.now();
      console.log('🔄 Setting forceReloadKey to:', newReloadKey);
      setForceReloadKey(newReloadKey);

      // Update ref to track the new pubkey being loaded
      loadedVaultPubkeyRef.current = currentPubkey;

      // Inject credentials after WebView has time to fully reload
      setTimeout(() => {
        console.log('🔄 Re-injecting credentials after vault data fetch (2000ms)');
        console.log('🔄 Injecting for vault:', currentPubkey);
        injectWalletCredentials();
      }, 2000);
    }
  }, [vaultData, walletCredentials, isLoading, injectWalletCredentials]);

  // Don't return null - always render to preload in background
  // if (!visible) return null;

  // Build URL with wallet credentials + cache busting on account switch only
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

    const url = `${API.PHONE}/?${params.toString()}`;
    return url;
  }, [walletCredentials, forceReloadKey]);

  // Handle external link navigation - open in browser instead of WebView
  const handleShouldStartLoad = (request) => {
    const { url } = request;

    // Allow internal browser navigation (about:blank, data:, etc.)
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('file:')) {
      return true;
    }

    // Allow navigation within the vault app
    if (url.startsWith(API.PHONE)) {
      return true;
    }

    // Open external links (like mempool explorers) in system browser
    Linking.openURL(url).catch(() => {
      // Silently fail if URL can't be opened
    });

    // Prevent WebView from navigating to external URL
    return false;
  };

  return (
    <View style={styles.container}>
      <WebView
        key={`vault-webview-${forceReloadKey}`}
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={[styles.webview, shouldShowLoading && styles.webviewHidden]}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        webviewDebuggingEnabled={true}
        incognito={false}
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setIsLoading(true);
          setPreparingVault(true);
          setWebViewLoaded(false);
        }}
        onLoadEnd={() => {
          console.log('🏦 WebView onLoadEnd fired');
          setWebViewLoaded(true);
          hasLoadedOnceRef.current = true;

          // Longer timeout for slow networks or account switching
          const loadingTimeout = setTimeout(() => {
            console.log('⏱️ Loading timeout reached - hiding loading screen');
            setIsLoading(false);
            setPreparingVault(false);
          }, 15000);

          // Inject wallet credentials after page loads
          setTimeout(() => {
            console.log('🏦 Injecting credentials after page load');
            injectWalletCredentials();
          }, 800);

          return () => clearTimeout(loadingTimeout);
        }}
        injectedJavaScript={`
          // Intercept console logs and forward to React Native
          (function() {
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;

            console.log = function(...args) {
              originalLog.apply(console, args);
              try {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'CONSOLE_LOG',
                  level: 'log',
                  args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                }));
              } catch (e) {}
            };

            console.warn = function(...args) {
              originalWarn.apply(console, args);
              try {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'CONSOLE_LOG',
                  level: 'warn',
                  args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                }));
              } catch (e) {}
            };

            console.error = function(...args) {
              originalError.apply(console, args);
              try {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'CONSOLE_LOG',
                  level: 'error',
                  args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                }));
              } catch (e) {}
            };
          })();

          // Check for vault page loaded - with or without vault
          (function() {
            let notified = false;

            function checkForVaultLoaded() {
              if (notified) return true;

              const bodyText = document.body.innerText || document.body.textContent || '';

              // Check if vault exists (has vault health)
              const hasVaultHealth = bodyText.includes('Vault health') ||
                                     bodyText.includes('Vault Health') ||
                                     bodyText.includes('VAULT HEALTH');

              // Check if "create vault" UI is shown (no vault exists)
              const hasCreateVault = bodyText.includes('Create Vault') ||
                                     bodyText.includes('create vault') ||
                                     bodyText.includes('CREATE VAULT');

              // Check if main content is loaded
              const hasMainContent = document.querySelector('[class*="main"]') ||
                                    document.querySelector('[class*="content"]') ||
                                    document.querySelector('[id*="root"]');

              if ((hasVaultHealth || hasCreateVault) && hasMainContent) {
                console.log('✅ Vault page loaded:', hasVaultHealth ? 'Vault exists' : 'No vault (create UI)');
                notified = true;
                // Wait a moment before notifying that vault is loaded
                setTimeout(() => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_LOADED' }));
                }, 800);
                return true;
              }
              return false;
            }

            // Start checking after page load
            const observer = new MutationObserver(() => {
              if (checkForVaultLoaded()) {
                observer.disconnect();
              }
            });

            // Observe DOM changes
            if (document.body) {
              observer.observe(document.body, { childList: true, subtree: true });
            } else {
              // If body not ready, wait for it
              document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
              });
            }

            // Also check immediately in case content is already there
            setTimeout(checkForVaultLoaded, 200);
          })();
          true;
        `}
        onMessage={async (event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);

            // Forward WebView console logs to Metro console
            if (message.type === 'CONSOLE_LOG') {
              const prefix = message.level === 'error' ? '❌' : message.level === 'warn' ? '⚠️' : '📱';
              console.log(`${prefix} [WebView Console]`, ...message.args);
              return;
            }

            if (message.type === 'VAULT_LOADED') {
              console.log('✅ VAULT_LOADED message received - vault page is ready');
              setIsLoading(false);
              setPreparingVault(false);

              // Inject wallet credentials one more time when vault is fully loaded
              setTimeout(() => {
                console.log('🏦 Final credential injection after VAULT_LOADED');
                injectWalletCredentials();
              }, 500);
              return;
            }

            // Handle PSBT signing requests
            if (message.type === 'SIGN_PSBT_REQUEST') {
              const { requestId, psbt, signInputs } = message.payload;

              try {
                // Sign the PSBT using the mobile wallet
                const signedPsbt = await signPsbt(psbt, signInputs);

                // Send response back to WebView
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
              return;
            }

            // Handle notification messages from web app
            if (message.type === 'SHOW_NOTIFICATION') {
              console.log('📬 SHOW_NOTIFICATION received from web app:', message.payload);
              const {
                notificationType,
                message: notificationMessage,
                title,
                link,
                linkText,
                duration,
              } = message.payload;

              // Use rich notification if showNotification is available
              if (showNotification) {
                showNotification({
                  type: notificationType || 'success',
                  title: title,
                  message: notificationMessage,
                  link: link,
                  linkText: linkText,
                  duration: duration,
                });
                console.log(`✅ Displayed ${notificationType} notification: ${title || notificationMessage}`);
              } else if (showToast) {
                // Fallback to simple toast if showNotification not available
                const toastTypeMap = {
                  'success': 'success',
                  'error': 'error',
                  'warning': 'error',
                  'info': 'success',
                  'loading': 'success',
                };
                const toastType = toastTypeMap[notificationType] || 'success';
                showToast(notificationMessage, toastType);
                console.log(`✅ Displayed ${notificationType} toast: ${notificationMessage}`);
              }
              return;
            }
          } catch (e) {
            console.error('❌ Error parsing WebView message:', e);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          </View>
        )}
        onError={(_syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent: _nativeEvent } = _syntheticEvent;
        }}
        onHttpError={(_syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent: _nativeEvent } = _syntheticEvent;
        }}
      />
      {shouldShowLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          {preparingVault ? (
            <Text style={styles.preparingText}>{preparingMessage}</Text>
          ) : (
            <Text style={styles.preparingText}>Initialising Vault</Text>
          )}
        </View>
      )}
    </View>
  );
});

VaultScreen.propTypes = {
  visible: PropTypes.bool.isRequired,
  walletCredentials: PropTypes.shape({
    satsAddress: PropTypes.string.isRequired,
    satsPubkey: PropTypes.string.isRequired,
    runesAddress: PropTypes.string.isRequired,
    runesPubkey: PropTypes.string.isRequired,
    vaultAddress: PropTypes.string.isRequired,
    vaultPubkey: PropTypes.string.isRequired,
  }),
  _autoCreateVaultTrigger: PropTypes.number,
  vaultData: PropTypes.shape({
    vaultTag: PropTypes.string,
    totalDebt: PropTypes.number,
    totalCollateral: PropTypes.number,
    currentPrice: PropTypes.number,
  }),
  showToast: PropTypes.func,
  showNotification: PropTypes.func,
};

export default VaultScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  webviewHidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.DARK_BG,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
  preparingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
