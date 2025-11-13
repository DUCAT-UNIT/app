import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';
import { API } from '../utils/constants';

const VaultScreen = React.memo(function VaultScreen({ visible, walletCredentials, _autoCreateVaultTrigger }) {
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

  // Reset state when leaving the vault screen
  React.useEffect(() => {
    if (!visible) {
      setPreparingVault(false);
      setPreparingMessage('Preparing the vault for you');
      setWebViewLoaded(false);
      messageIndexRef.current = 0;
    }
  }, [visible]);

  // Force wallet connection when vault becomes visible AND page is loaded
  const injectWalletCredentials = React.useCallback(() => {
    if (webViewRef.current && walletCredentials) {
      console.log('🏦 Injecting wallet credentials into vault page');

      // Inject wallet credentials directly into the page
      const credentialsScript = `
        (function() {
          console.log('Mobile app injecting wallet credentials');

          // Store credentials in window object for the app to access
          window.mobileWalletCredentials = {
            satsAddress: '${walletCredentials.satsAddress}',
            satsPubkey: '${walletCredentials.satsPubkey}',
            runesAddress: '${walletCredentials.runesAddress}',
            runesPubkey: '${walletCredentials.runesPubkey}',
            vaultAddress: '${walletCredentials.vaultAddress}',
            vaultPubkey: '${walletCredentials.vaultPubkey}',
            network: 'mutinynet'
          };

          // Dispatch event to notify app that credentials are ready
          window.dispatchEvent(new CustomEvent('mobileWalletReady', {
            detail: window.mobileWalletCredentials
          }));

          console.log('Mobile wallet credentials injected and event dispatched');
        })();
        true;
      `;

      webViewRef.current.injectJavaScript(credentialsScript);
    }
  }, [walletCredentials]);

  // Inject wallet credentials when vault becomes visible
  React.useEffect(() => {
    if (visible) {
      console.log('🏦 Vault became visible - will inject wallet credentials');
      setTimeout(() => {
        injectWalletCredentials();
      }, 1000);
    }
  }, [visible, injectWalletCredentials]);

  // Track when credentials change to force proper reload
  const credentialsKeyRef = React.useRef('');
  const [forceReloadKey, setForceReloadKey] = React.useState(0);

  // Reload webview when wallet credentials change (account switch)
  React.useEffect(() => {
    if (walletCredentials) {
      const newKey = `${walletCredentials.vaultPubkey}_${walletCredentials.satsAddress}`;

      if (credentialsKeyRef.current && credentialsKeyRef.current !== newKey) {
        console.log('🔄 Account switched detected - forcing complete vault reload');
        console.log('Old key:', credentialsKeyRef.current);
        console.log('New key:', newKey);

        // Reset loading state for new account
        setIsLoading(true);
        setWebViewLoaded(false);
        hasLoadedOnceRef.current = false;
        setPreparingVault(true);

        // Force complete reload by changing key (unmount/remount WebView)
        setForceReloadKey(prev => prev + 1);
      }

      credentialsKeyRef.current = newKey;
    }
  }, [walletCredentials]);

  // Don't return null - always render to preload in background
  // if (!visible) return null;

  // Build URL with wallet credentials
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
    });

    const url = `${API.PHONE}/?${params.toString()}`;
    return url;
  }, [walletCredentials]);

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
        webviewDebuggingEnabled={false}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setIsLoading(true);
          setPreparingVault(true);
          setWebViewLoaded(false);
        }}
        onLoadEnd={() => {
          setWebViewLoaded(true);
          hasLoadedOnceRef.current = true;
          setTimeout(() => {
            setIsLoading(false);
          }, 10000);

          // Inject wallet credentials after page loads
          setTimeout(() => {
            injectWalletCredentials();
          }, 500);
        }}
        injectedJavaScript={`
          // Check for "Vault health" text on the page
          (function() {
            function checkForVaultHealth() {
              const bodyText = document.body.innerText || document.body.textContent || '';

              // Check for various possible variations
              if (bodyText.includes('Vault health') ||
                  bodyText.includes('Vault Health') ||
                  bodyText.includes('VAULT HEALTH')) {
                // Wait 1 second before notifying that vault is loaded
                setTimeout(() => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_LOADED' }));
                }, 1000);
                return true;
              }
              return false;
            }

            // Start checking after page load
            const observer = new MutationObserver(() => {
              if (checkForVaultHealth()) {
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
            setTimeout(checkForVaultHealth, 100);
          })();
          true;
        `}
        onMessage={async (event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);

            if (message.type === 'VAULT_LOADED') {
              setIsLoading(false);
              setPreparingVault(false);

              // Inject wallet credentials when vault is fully loaded
              setTimeout(() => {
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
          } catch (e) {}
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
