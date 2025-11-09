import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';

export default function VaultScreen({ visible, walletCredentials, autoCreateVault }) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [preparingVault, setPreparingVault] = React.useState(false);

  // Auto-click create vault button when flag is set
  React.useEffect(() => {
    if (autoCreateVault && visible && webViewRef.current) {
      console.log('[VaultScreen] autoCreateVault is true, injecting auto-click script...');
      setPreparingVault(true);

      // Wait a bit for the page to be ready, then inject the script
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          (function() {
            console.log('[AutoCreateVault] Starting auto-click from effect...');

            function generateRandomVaultName() {
              const adjectives = ['Swift', 'Secure', 'Golden', 'Silver', 'Diamond', 'Stellar', 'Cosmic', 'Digital', 'Quantum', 'Thunder'];
              const nouns = ['Vault', 'Treasury', 'Reserve', 'Fortress', 'Chamber', 'Haven', 'Stronghold', 'Cache', 'Safe', 'Lock'];
              const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
              const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
              const randomNum = Math.floor(Math.random() * 1000);
              return randomAdj + ' ' + randomNoun + ' ' + randomNum;
            }

            function autoFillVaultName() {
              console.log('[AutoFillVaultName] Searching for vault name input...');

              // Find input fields
              const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]'));
              console.log('[AutoFillVaultName] Found ' + inputs.length + ' input fields');

              // Try to find the vault name input
              let vaultNameInput = inputs.find(input => {
                const placeholder = (input.placeholder || '').toLowerCase();
                const name = (input.name || '').toLowerCase();
                const id = (input.id || '').toLowerCase();
                return placeholder.includes('vault') || placeholder.includes('name') ||
                       name.includes('vault') || name.includes('name') ||
                       id.includes('vault') || id.includes('name');
              });

              // If not found by specific attributes, try the first visible text input
              if (!vaultNameInput && inputs.length > 0) {
                vaultNameInput = inputs[0];
              }

              if (vaultNameInput) {
                const vaultName = generateRandomVaultName();
                console.log('[AutoFillVaultName] Found input, filling with name: ' + vaultName);

                // Fill the input
                vaultNameInput.value = vaultName;
                vaultNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                vaultNameInput.dispatchEvent(new Event('change', { bubbles: true }));

                console.log('[AutoFillVaultName] Name filled, searching for submit button...');

                // Wait a bit then find and click the submit/continue/next button
                setTimeout(() => {
                  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                  const submitButton = buttons.find(btn => {
                    const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                    return text.includes('continue') || text.includes('next') || text.includes('submit') ||
                           text.includes('create') || text.includes('confirm');
                  });

                  if (submitButton) {
                    console.log('[AutoFillVaultName] Found submit button, clicking...');
                    submitButton.click();
                    console.log('[AutoFillVaultName] Submit button clicked');

                    // Notify React Native that vault creation is complete
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICKED' }));
                  } else {
                    console.log('[AutoFillVaultName] Submit button not found');
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICKED' }));
                  }
                }, 500);

                return true;
              } else {
                console.log('[AutoFillVaultName] Vault name input not found');
                return false;
              }
            }

            function autoClickCreateVault() {
              console.log('[AutoCreateVault] Searching for create vault button...');

              // Find all buttons on the page
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
              console.log('[AutoCreateVault] Found ' + buttons.length + ' clickable elements');

              // Log all button texts for debugging
              buttons.forEach((btn, idx) => {
                const text = (btn.textContent || btn.innerText || '').trim();
                if (text) {
                  console.log('[AutoCreateVault] Button ' + idx + ': "' + text + '"');
                }
              });

              // Try finding by text content (case insensitive, flexible matching)
              const createVaultButton = buttons.find(btn => {
                const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                return text.includes('create') && text.includes('vault');
              });

              if (createVaultButton) {
                const buttonText = (createVaultButton.textContent || createVaultButton.innerText || '').trim();
                console.log('[AutoCreateVault] Found button with text: "' + buttonText + '", clicking...');
                createVaultButton.click();
                console.log('[AutoCreateVault] Button clicked successfully');

                // After clicking, wait and try to fill in the vault name
                setTimeout(() => {
                  autoFillVaultName();
                }, 1500);

                return true;
              }

              console.log('[AutoCreateVault] Create vault button not found');
              return false;
            }

            // Try clicking with multiple retries
            let attempts = 0;
            const maxAttempts = 5;

            function tryAutoClick() {
              attempts++;
              console.log('[AutoCreateVault] Attempt ' + attempts + ' of ' + maxAttempts);

              if (autoClickCreateVault()) {
                console.log('[AutoCreateVault] Success!');
                return;
              }

              if (attempts < maxAttempts) {
                setTimeout(tryAutoClick, 1000);
              } else {
                console.log('[AutoCreateVault] Failed after ' + maxAttempts + ' attempts');
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
              }
            }

            // Start trying immediately
            tryAutoClick();
          })();
          true;
        `);
      }, 1000);
    }
  }, [autoCreateVault, visible]);

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

            ${autoCreateVault ? `
            // Auto-click create vault button when requested
            function autoClickCreateVault() {
              console.log('[AutoCreateVault] Searching for create vault button...');

              // Find all buttons on the page
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
              console.log('[AutoCreateVault] Found ' + buttons.length + ' clickable elements');

              // Log all button texts for debugging
              buttons.forEach((btn, idx) => {
                const text = (btn.textContent || btn.innerText || '').trim();
                if (text) {
                  console.log('[AutoCreateVault] Button ' + idx + ': "' + text + '"');
                }
              });

              // Try finding by text content (case insensitive, flexible matching)
              const createVaultButton = buttons.find(btn => {
                const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                return text.includes('create') && text.includes('vault');
              });

              if (createVaultButton) {
                const buttonText = (createVaultButton.textContent || createVaultButton.innerText || '').trim();
                console.log('[AutoCreateVault] Found button with text: "' + buttonText + '", clicking...');
                createVaultButton.click();
                console.log('[AutoCreateVault] Button clicked successfully');
                return true;
              }

              console.log('[AutoCreateVault] Create vault button not found');
              return false;
            }

            // Try clicking with multiple retries
            let attempts = 0;
            const maxAttempts = 5;

            function tryAutoClick() {
              attempts++;
              console.log('[AutoCreateVault] Attempt ' + attempts + ' of ' + maxAttempts);

              if (autoClickCreateVault()) {
                console.log('[AutoCreateVault] Success!');
                return;
              }

              if (attempts < maxAttempts) {
                setTimeout(tryAutoClick, 1000);
              } else {
                console.log('[AutoCreateVault] Failed after ' + maxAttempts + ' attempts');
              }
            }

            // Start trying after page loads
            setTimeout(tryAutoClick, 1000);
            ` : ''}

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
              setPreparingVault(false);
              return;
            }

            // Handle vault button clicked
            if (message.type === 'VAULT_BUTTON_CLICKED') {
              console.log('[VaultScreen] Vault creation button clicked, waiting for name input screen...');
              // Wait a bit for the next screen to load, then hide preparing message
              setTimeout(() => {
                setPreparingVault(false);
                setIsLoading(false);
              }, 2000);
              return;
            }

            // Handle vault button click failed
            if (message.type === 'VAULT_BUTTON_CLICK_FAILED') {
              console.log('[VaultScreen] Vault creation button click failed');
              setPreparingVault(false);
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
      {(isLoading || preparingVault) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          {preparingVault && (
            <Text style={styles.preparingText}>Preparing the vault for you</Text>
          )}
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
  autoCreateVault: PropTypes.bool,
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
  preparingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
