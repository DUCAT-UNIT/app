import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';

export default function VaultScreen({ visible, walletCredentials, autoCreateVaultTrigger }) {
  const webViewRef = useRef(null);
  const messageIndexRef = useRef(0);
  const hasAutoClickedRef = useRef(false);
  const [webViewKey, setWebViewKey] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [preparingVault, setPreparingVault] = React.useState(false);
  const [preparingMessage, setPreparingMessage] = React.useState('Preparing the vault for you');
  const [scriptInjected, setScriptInjected] = React.useState(false);

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
      'Almost there...'
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
      setScriptInjected(false);
      messageIndexRef.current = 0;
      hasAutoClickedRef.current = false;
    }
  }, [visible]);

  // Track when webview loads to inject script
  const [webViewLoaded, setWebViewLoaded] = React.useState(false);

  // Auto-click create vault button when trigger counter changes
  React.useEffect(() => {
    if (autoCreateVaultTrigger > 0 && visible) {

      // Reset all state including hasAutoClickedRef
      hasAutoClickedRef.current = false;
      setWebViewLoaded(false);
      setScriptInjected(false);

      // Increment the key to force webview reload with fresh state
      setWebViewKey(prev => prev + 1);

      setPreparingVault(true);
      setPreparingMessage('Preparing the vault for you');
    }
  }, [autoCreateVaultTrigger, visible]);

  // Inject script after webview loads
  React.useEffect(() => {
    if (autoCreateVaultTrigger > 0 && visible && webViewLoaded && !hasAutoClickedRef.current) {

      // Mark as clicked BEFORE injecting to prevent double injection
      hasAutoClickedRef.current = true;

      // Give a little extra time for the page to fully render
      const timeoutId = setTimeout(() => {
        setScriptInjected(true);

        if (!webViewRef.current) {
          return;
        }

        webViewRef.current.injectJavaScript(`
          (function() {

            function generateRandomVaultName() {
              const adjectives = ['Safe', 'Gold', 'Fast', 'Big', 'Deep', 'Quick', 'Prime', 'Smart', 'Cool', 'Bold'];
              const nouns = ['Vault', 'Box', 'Safe', 'Lock', 'Keep', 'Hold', 'Stack', 'Stash'];
              const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
              const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
              const randomNum = Math.floor(Math.random() * 999) + 1;
              return randomAdj + randomNoun + randomNum; // No spaces, under 20 chars
            }

            function autoFillVaultName() {

              // Find input fields
              const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]'));

              // Log all inputs for debugging
              inputs.forEach((input, idx) => {
                  placeholder: input.placeholder,
                  name: input.name,
                  id: input.id,
                  type: input.type,
                  visible: input.offsetParent !== null
                });
              });

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
                vaultNameInput = inputs.find(input => input.offsetParent !== null);
              }

              // If still not found, just use the first input
              if (!vaultNameInput && inputs.length > 0) {
                vaultNameInput = inputs[0];
              }

              if (vaultNameInput) {
                const vaultName = generateRandomVaultName();

                // Try multiple methods to fill the input
                try {
                  // Focus the input first
                  vaultNameInput.focus();

                  // Clear any existing value
                  vaultNameInput.value = '';

                  // Get React's internal value setter
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                  // Simulate typing each character
                  for (let i = 0; i < vaultName.length; i++) {
                    const char = vaultName[i];

                    // Set the value incrementally
                    const currentValue = vaultName.substring(0, i + 1);
                    nativeInputValueSetter.call(vaultNameInput, currentValue);

                    // Dispatch input event for each character (React listens to this)
                    const inputEvent = new Event('input', { bubbles: true });
                    vaultNameInput.dispatchEvent(inputEvent);
                  }

                  // Dispatch final change event
                  vaultNameInput.dispatchEvent(new Event('change', { bubbles: true }));

                  // Remove focus
                  vaultNameInput.blur();

                } catch (e) {
                }


                // Wait a tiny bit for React to process the input and enable the button
                setTimeout(() => {
                  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));

                  const submitButton = buttons.find(btn => {
                    const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                    const isMatch = text.includes('continue') || text.includes('next') || text.includes('submit') ||
                           text.includes('create') || text.includes('confirm');
                    if (isMatch) {
                    }
                    return isMatch && !btn.disabled;
                  });

                  if (submitButton) {
                    submitButton.click();
                    // Don't notify yet - wait for VAULT_LOADED message when vault health appears
                  } else {
                    // If we can't find the button, notify that we're done trying
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
                  }
                }, 300);

                return true;
              } else {
                return false;
              }
            }

            function autoClickCreateVault() {

              // Find all buttons on the page
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));

              // Log all button texts for debugging
              buttons.forEach((btn, idx) => {
                const text = (btn.textContent || btn.innerText || '').trim();
                if (text) {
                }
              });

              // Try finding by text content (case insensitive, flexible matching)
              const createVaultButton = buttons.find(btn => {
                const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                return text.includes('create') && text.includes('vault');
              });

              if (createVaultButton) {
                const buttonText = (createVaultButton.textContent || createVaultButton.innerText || '').trim();
                createVaultButton.click();

                // After clicking, immediately try to fill in the vault name with retries
                let fillAttempts = 0;
                const maxFillAttempts = 10;

                function tryFillName() {
                  fillAttempts++;

                  if (autoFillVaultName()) {
                    return;
                  }

                  if (fillAttempts < maxFillAttempts) {
                    setTimeout(tryFillName, 200);
                  } else {
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
                  }
                }

                // Start trying immediately
                setTimeout(tryFillName, 100);

                return true;
              }

              return false;
            }

            // Try clicking with multiple retries
            let attempts = 0;
            const maxAttempts = 5;

            function tryAutoClick() {
              attempts++;

              if (autoClickCreateVault()) {
                return;
              }

              if (attempts < maxAttempts) {
                setTimeout(tryAutoClick, 1000);
              } else {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
              }
            }

            // Start trying immediately
            tryAutoClick();
          })();
          true;
        `);
      }, 1000); // Wait 1 second after load for page to render

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [autoCreateVaultTrigger, visible, webViewLoaded]); // Trigger when webview loads

  // Don't return null - always render to preload in background
  // if (!visible) return null;

  // Build URL with wallet credentials
  const webViewUrl = useMemo(() => {
    const baseUrl = 'https://phone.ducatprotocol.com';

    if (!walletCredentials) {
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
    return url;
  }, [walletCredentials]);

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={styles.webview}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        webviewDebuggingEnabled={true}
        onLoadStart={() => {
          setIsLoading(true);
          setWebViewLoaded(false);
        }}
        onLoadEnd={() => {
          setWebViewLoaded(true);

          // Set a timeout fallback in case VAULT_LOADED never comes
          setTimeout(() => {
            setIsLoading(false);
          }, 10000); // 10 second fallback
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

            // Handle vault loaded event
            if (message.type === 'VAULT_LOADED') {
              setIsLoading(false);
              setPreparingVault(false);
              return;
            }

            // Handle vault button click failed
            if (message.type === 'VAULT_BUTTON_CLICK_FAILED') {
              setPreparingVault(false);
              setIsLoading(false);
              return;
            }

            // Handle console logs from WebView
            if (message.type === 'CONSOLE_LOG') {
              const prefix = `[WebView ${message.level}]`;
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

          } catch (e) {
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
        }}
        onHttpError={(syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent } = syntheticEvent;
        }}
      />
      {(isLoading || preparingVault) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          {preparingVault && (
            <>
              <Text style={styles.preparingText}>{preparingMessage}</Text>
            </>
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
  autoCreateVaultTrigger: PropTypes.number,
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
