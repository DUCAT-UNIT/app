import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';
import { signPsbt } from '../utils/wallet';

export default function VaultScreen({ visible, walletCredentials, autoCreateVaultTrigger }) {
  const webViewRef = useRef(null);
  const messageIndexRef = useRef(0);
  const hasAutoClickedRef = useRef(false);
  const lastTriggerValueRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const targetLoadGenerationRef = useRef(0);
  const [webViewKey, setWebViewKey] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [preparingVault, setPreparingVault] = React.useState(false);
  const [preparingMessage, setPreparingMessage] = React.useState('Preparing the vault for you');
  const [webViewLoaded, setWebViewLoaded] = React.useState(false);

  const shouldShowLoading = (isLoading || preparingVault) || (visible && autoCreateVaultTrigger > 0 && !webViewLoaded);

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
    console.log('[VaultScreen] Visible changed:', visible);
    if (!visible) {
      console.log('[VaultScreen] Resetting state (screen hidden)');
      setPreparingVault(false);
      setPreparingMessage('Preparing the vault for you');
      setWebViewLoaded(false);
      messageIndexRef.current = 0;
      hasAutoClickedRef.current = false;
      lastTriggerValueRef.current = 0;
    }
  }, [visible]);

  // Show loading overlay immediately when auto-create is triggered
  React.useEffect(() => {
    console.log('[VaultScreen] Auto-create effect:', { autoCreateVaultTrigger, visible });
    if (autoCreateVaultTrigger > 0 && visible) {
      console.log('[VaultScreen] Starting vault preparation');
      setPreparingVault(true);
      setIsLoading(true);
      setPreparingMessage('Preparing the vault for you');
    }
  }, [autoCreateVaultTrigger, visible]);

  // Handle auto-create vault trigger
  React.useEffect(() => {
    console.log('[VaultScreen] Trigger effect check:', {
      autoCreateVaultTrigger,
      visible,
      lastTrigger: lastTriggerValueRef.current,
      shouldTrigger: autoCreateVaultTrigger > 0 && visible && autoCreateVaultTrigger !== lastTriggerValueRef.current
    });

    if (autoCreateVaultTrigger > 0 && visible && autoCreateVaultTrigger !== lastTriggerValueRef.current) {
      console.log('[VaultScreen] 🔥 TRIGGERING VAULT CREATION FLOW');
      lastTriggerValueRef.current = autoCreateVaultTrigger;
      hasAutoClickedRef.current = false;
      setWebViewLoaded(false);
      console.log('[VaultScreen] Reset refs - hasAutoClicked:', false, 'webViewLoaded:', false);

      setTimeout(() => {
        const newKey = webViewKey + 1;
        console.log('[VaultScreen] Reloading WebView - key:', webViewKey, '->', newKey);
        setWebViewKey(newKey);
        targetLoadGenerationRef.current = loadGenerationRef.current + 1;
        console.log('[VaultScreen] Target load generation:', targetLoadGenerationRef.current);
      }, 100);

      const safetyTimeout = setTimeout(() => {
        console.log('[VaultScreen] ⚠️ Safety timeout reached (10s) - hiding loading');
        setPreparingVault(false);
        setIsLoading(false);
      }, 10000);

      return () => clearTimeout(safetyTimeout);
    }
  }, [autoCreateVaultTrigger, visible, webViewKey]);

  // Inject auto-click script when conditions are met
  React.useEffect(() => {
    const shouldInject = autoCreateVaultTrigger > 0 &&
                        visible &&
                        webViewLoaded &&
                        !hasAutoClickedRef.current &&
                        loadGenerationRef.current >= targetLoadGenerationRef.current;

    console.log('[VaultScreen] Script injection check:', {
      autoCreateVaultTrigger,
      visible,
      webViewLoaded,
      hasAutoClicked: hasAutoClickedRef.current,
      loadGen: loadGenerationRef.current,
      targetGen: targetLoadGenerationRef.current,
      shouldInject
    });

    if (shouldInject) {
      console.log('[VaultScreen] ✅ INJECTING AUTO-CLICK SCRIPT');
      hasAutoClickedRef.current = true;

      if (!webViewRef.current) {
        console.warn('[VaultScreen] WebView ref is null, cannot inject script');
        return;
      }

      const timeoutId = setTimeout(() => {
        if (!webViewRef.current) {
          console.warn('[VaultScreen] WebView ref is null after timeout');
          return;
        }
        console.log('[VaultScreen] Executing script injection (after 500ms delay)');

        const scriptToInject = `
            (function() {
              try {
                if (window.__vaultScriptExecuted) {
                  console.log('[WebView] Script already executed, skipping');
                  return;
                }
                window.__vaultScriptExecuted = true;

                console.log('[WebView] 🚀 Auto-click script starting');
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCRIPT_EXECUTING' }));

                function generateRandomVaultName() {
                  const adjectives = ['Safe', 'Gold', 'Fast', 'Big', 'Deep', 'Quick', 'Prime', 'Smart', 'Cool', 'Bold'];
                  const nouns = ['Vault', 'Box', 'Safe', 'Lock', 'Keep', 'Hold', 'Stack', 'Stash'];
                  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
                  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
                  const randomNum = Math.floor(Math.random() * 999) + 1;
                  return randomAdj + randomNoun + randomNum;
                }

                function autoFillVaultName() {
                  const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]'));

                  let vaultNameInput = inputs.find(input => {
                    const placeholder = (input.placeholder || '').toLowerCase();
                    const name = (input.name || '').toLowerCase();
                    const id = (input.id || '').toLowerCase();
                    return placeholder.includes('vault') || placeholder.includes('name') ||
                           name.includes('vault') || name.includes('name') ||
                           id.includes('vault') || id.includes('name');
                  });

                  if (!vaultNameInput && inputs.length > 0) {
                    vaultNameInput = inputs.find(input => input.offsetParent !== null);
                  }

                  if (!vaultNameInput && inputs.length > 0) {
                    vaultNameInput = inputs[0];
                  }

                  if (vaultNameInput) {
                    const vaultName = generateRandomVaultName();

                    try {
                      vaultNameInput.focus();
                      vaultNameInput.value = '';
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                      for (let i = 0; i < vaultName.length; i++) {
                        const currentValue = vaultName.substring(0, i + 1);
                        nativeInputValueSetter.call(vaultNameInput, currentValue);
                        const inputEvent = new Event('input', { bubbles: true });
                        vaultNameInput.dispatchEvent(inputEvent);
                      }

                      vaultNameInput.dispatchEvent(new Event('change', { bubbles: true }));
                      vaultNameInput.blur();
                    } catch (e) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'SCRIPT_ERROR',
                        error: 'Failed to fill input: ' + e.toString()
                      }));
                    }

                    setTimeout(() => {
                      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                      const submitButton = buttons.find(btn => {
                        const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                        return (text.includes('continue') || text.includes('next') ||
                                text.includes('submit') || text.includes('create') ||
                                text.includes('confirm')) && !btn.disabled;
                      });

                      if (submitButton) {
                        submitButton.click();
                      } else {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
                      }
                    }, 300);

                    return true;
                  } else {
                    return false;
                  }
                }

                function autoClickCreateVault() {
                  const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
                  const buttonTexts = buttons.map(btn => (btn.textContent || btn.innerText || '').trim()).filter(t => t);

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG_BUTTONS',
                    buttons: buttonTexts.slice(0, 10)
                  }));

                  let vaultButton = buttons.find(btn => {
                    const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                    return text.includes('create vault');
                  });

                  if (!vaultButton) {
                    vaultButton = buttons.find(btn => {
                      const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                      return text.includes('vault') && !text.includes('overview');
                    });
                  }

                  if (vaultButton) {
                    vaultButton.click();

                    setTimeout(() => {
                      const buttons2 = Array.from(document.querySelectorAll('button, [role="button"], a'));
                      const createButton = buttons2.find(btn => {
                        const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                        return text.includes('create vault');
                      });

                      if (createButton) {
                        createButton.click();
                      }

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
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
                        }
                      }

                      setTimeout(tryFillName, 500);
                    }, 500);

                    return true;
                  } else {
                    return false;
                  }
                }

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
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VAULT_BUTTON_CLICK_FAILED' }));
                  }
                }

                tryAutoClick();
              } catch (error) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SCRIPT_ERROR',
                  error: error.toString()
                }));
              }
            })();
            true;
          `;

        webViewRef.current.injectJavaScript(scriptToInject);
      }, 500); // Wait 500ms for page to render

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

  // Handle external link navigation - open in browser instead of WebView
  const handleShouldStartLoad = (request) => {
    const { url } = request;
    const baseUrl = 'https://phone.ducatprotocol.com';

    // Allow internal browser navigation (about:blank, data:, etc.)
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('file:')) {
      return true;
    }

    // Allow navigation within the vault app
    if (url.startsWith(baseUrl)) {
      return true;
    }

    // Open external links (like mempool explorers) in system browser
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
    });

    // Prevent WebView from navigating to external URL
    return false;
  };

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={[styles.webview, shouldShowLoading && styles.webviewHidden]}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        webviewDebuggingEnabled={true}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          loadGenerationRef.current += 1;
          console.log('[VaultScreen] WebView load start - generation:', loadGenerationRef.current);
          setIsLoading(true);
          setWebViewLoaded(false);
        }}
        onLoadEnd={() => {
          const currentGen = loadGenerationRef.current;
          const targetGen = targetLoadGenerationRef.current;

          console.log('[VaultScreen] WebView load end - current gen:', currentGen, 'target gen:', targetGen);

          if (currentGen >= targetGen) {
            console.log('[VaultScreen] ✅ Target generation reached, marking webView as loaded');
            setWebViewLoaded(true);
          } else {
            console.log('[VaultScreen] ⏳ Waiting for target generation');
          }

          setTimeout(() => {
            console.log('[VaultScreen] Hiding loading spinner (after 10s)');
            setIsLoading(false);
          }, 10000);
        }}
        onError={(syntheticEvent) => {
          setIsLoading(false);
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
            console.log('[VaultScreen] Message from WebView:', message.type, message);

            if (message.type === 'SCRIPT_EXECUTING') {
              console.log('[VaultScreen] ✓ Script is executing in WebView');
              return;
            }

            if (message.type === 'SCRIPT_ERROR') {
              console.error('[VaultScreen] ❌ Script error:', message.error);
              setPreparingVault(false);
              setIsLoading(false);
              return;
            }

            if (message.type === 'DEBUG_BUTTONS') {
              console.log('[VaultScreen] 📋 Buttons found on page:', message.buttons);
              return;
            }

            if (message.type === 'VAULT_LOADED') {
              console.log('[VaultScreen] ✅ VAULT LOADED - hiding loading states');
              setIsLoading(false);
              setPreparingVault(false);
              return;
            }

            if (message.type === 'VAULT_BUTTON_CLICK_FAILED') {
              console.error('[VaultScreen] ❌ Vault button click failed');
              setPreparingVault(false);
              setIsLoading(false);
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
      {shouldShowLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          {(preparingVault || autoCreateVaultTrigger > 0) && (
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
