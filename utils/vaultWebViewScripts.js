/**
 * Vault WebView Injected Scripts
 * Scripts injected into the vault WebView for console logging and vault detection
 */

/**
 * Script to intercept console logs and forward to React Native
 */
export const consoleLogScript = `
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
`;

/**
 * Script to detect when vault page is loaded
 */
export const vaultLoadedDetectionScript = `
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
        // Wait a moment before notifying
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
`;

/**
 * Combined injected JavaScript for WebView
 */
export const combinedInjectedScript = `
  ${consoleLogScript}
  ${vaultLoadedDetectionScript}
  true;
`;
