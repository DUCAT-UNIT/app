import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';

export default function VaultScreen({ visible, walletCredentials }) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Don't return null - always render to preload in background
  // if (!visible) return null;

  // Build URL with wallet credentials
  const webViewUrl = useMemo(() => {
    const baseUrl = 'https://phone.ducatprotocol.com';

    if (!walletCredentials) {
      console.log('[VaultScreen] No wallet credentials, loading base URL');
      return baseUrl;
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

    const url = `${baseUrl}/?${params.toString()}`;
    console.log('[VaultScreen] Loading with credentials:', walletCredentials);
    console.log('[VaultScreen] Full URL:', url);
    return url;
  }, [walletCredentials]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={styles.webview}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        webviewDebuggingEnabled={true}
        onLoadStart={() => {
          console.log('[VaultScreen] Loading started');
          setIsLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[VaultScreen] Initial page load completed, waiting for Vault Health...');
          // Set a timeout fallback in case VAULT_LOADED never comes
          setTimeout(() => {
            console.log('[VaultScreen] Timeout reached, hiding loader anyway');
            setIsLoading(false);
          }, 10000); // 10 second fallback
        }}
        injectedJavaScript={`
          // Intercept console logs from the web page
          (function() {
            const originalLog = console.log;
            const originalError = console.error;
            const originalDebug = console.debug;

            console.log = function(...args) {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSOLE_LOG', level: 'log', args: args.map(String) }));
              originalLog.apply(console, args);
            };

            console.error = function(...args) {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSOLE_LOG', level: 'error', args: args.map(String) }));
              originalError.apply(console, args);
            };

            console.debug = function(...args) {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSOLE_LOG', level: 'debug', args: args.map(String) }));
              originalDebug.apply(console, args);
            };

            // Check for "Vault health" text on the page (note: lowercase 'h')
            function checkForVaultHealth() {
              const bodyText = document.body.innerText || document.body.textContent || '';
              console.log('[VaultHealth Check] Body text length:', bodyText.length);

              // Check for various possible variations
              if (bodyText.includes('Vault health') ||
                  bodyText.includes('Vault Health') ||
                  bodyText.includes('VAULT HEALTH')) {
                console.log('[VaultHealth Check] Found vault health text! Waiting 1 second...');
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
          console.log('[VaultScreen] onMessage triggered, raw data:', event.nativeEvent.data);
          try {
            const message = JSON.parse(event.nativeEvent.data);
            console.log('[VaultScreen] Parsed message type:', message.type);

            // Handle vault loaded event
            if (message.type === 'VAULT_LOADED') {
              console.log('[VaultScreen] Vault Health detected, hiding loader');
              setIsLoading(false);
              return;
            }

            // Handle console logs from WebView
            if (message.type === 'CONSOLE_LOG') {
              const prefix = `[WebView ${message.level}]`;
              console.log(prefix, ...message.args);
              return;
            }

            // Handle PSBT signing requests
            if (message.type === 'SIGN_PSBT_REQUEST') {
              console.log('[VaultScreen] Received PSBT signing request:', message.payload);
              const { requestId, psbt, signInputs } = message.payload;

              try {
                // Sign the PSBT using the mobile wallet
                console.log('[VaultScreen] Starting PSBT signing...');
                const signedPsbt = await signPsbt(psbt, signInputs);
                console.log('[VaultScreen] PSBT signed successfully');

                // Send response back to WebView
                const responseData = {
                  type: 'SIGN_PSBT_RESPONSE',
                  payload: {
                    requestId,
                    signedPsbt,
                  },
                };

                console.log('[VaultScreen] Sending success response back to WebView');
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    window.postMessage(${JSON.stringify(responseData)}, '*');
                  })();
                  true;
                `);
              } catch (error) {
                console.error('[VaultScreen] PSBT signing failed:', error);

                // Send error response back to WebView
                const responseData = {
                  type: 'SIGN_PSBT_RESPONSE',
                  payload: {
                    requestId,
                    error: error.message || String(error),
                  },
                };

                console.log('[VaultScreen] Sending error response back to WebView');
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    window.postMessage(${JSON.stringify(responseData)}, '*');
                  })();
                  true;
                `);
              }
              return;
            }

            console.log('[VaultScreen] Unknown message type:', message.type);
          } catch (e) {
            console.log('[VaultScreen] Message parsing error:', e);
            console.log('[VaultScreen] Raw message:', event.nativeEvent.data);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          </View>
        )}
        onError={(syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent } = syntheticEvent;
          console.error('[VaultScreen] WebView error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent } = syntheticEvent;
          console.error('[VaultScreen] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
        </View>
      )}
    </View>
  );
}

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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
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
});
