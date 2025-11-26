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

    let checkCount = 0;
    const maxChecks = 10; // Maximum 10 checks (3 seconds at 300ms intervals)

    function checkForVaultLoaded() {
      if (notified) return true;

      checkCount++;
      const bodyText = document.body?.innerText || document.body?.textContent || '';

      // Check for exact vault page content
      const hasCreateVaultPage =
        bodyText.includes('Create Vault') &&
        (bodyText.includes('Deposit BTC') || bodyText.includes('Borrow UNIT'));

      const hasExistingVaultPage =
        bodyText.includes('Vault health') ||
        bodyText.includes('BTC Deposited in Vault') ||
        bodyText.includes('UNIT Loan Balance') ||
        bodyText.includes('Liquidation price');

      const hasVaultContent = hasCreateVaultPage || hasExistingVaultPage;

      // Check if main content structure is loaded
      const hasMainContent =
        document.querySelector('[class*="main"]') ||
        document.querySelector('[class*="content"]') ||
        document.querySelector('[id*="root"]') ||
        document.querySelector('main') ||
        document.querySelector('article') ||
        document.querySelector('section');

      // Check for vault-specific interactive elements
      const hasVaultButtons =
        bodyText.includes('Preview') ||
        bodyText.includes('Deposit') ||
        bodyText.includes('Withdraw') ||
        bodyText.includes('Borrow') ||
        bodyText.includes('Repay');

      const hasInteractiveElements =
        document.querySelector('button') ||
        document.querySelector('input') ||
        document.querySelector('a[href]') ||
        hasVaultButtons;

      // More lenient check - if we have content structure and some meaningful content
      const isPageReady = hasMainContent && (hasVaultContent || hasInteractiveElements || bodyText.length > 100);

      // Fast fallback - after 3 checks (900ms), if we have basic structure, assume ready
      const earlyFallback = checkCount >= 3 && hasMainContent && bodyText.length > 50;

      if (isPageReady || earlyFallback) {
        // Vault page ready (check #' + checkCount + ')
        notified = true;
        // Much shorter delay for faster response
        setTimeout(() => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_LOADED' }));
        }, 200);
        return true;
      }

      // Stop checking after max attempts
      if (checkCount >= maxChecks) {
        // Max checks reached, sending VAULT_LOADED
        notified = true;
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'VAULT_LOADED' }));
        return true;
      }

      return false;
    }

    // Start checking after page load
    const observer = new MutationObserver(() => {
      if (checkForVaultLoaded()) {
        observer.disconnect();
        clearInterval(intervalCheck);
      }
    });

    // Also check periodically in case mutation observer misses something
    const intervalCheck = setInterval(() => {
      if (checkForVaultLoaded()) {
        clearInterval(intervalCheck);
        observer.disconnect();
      }
    }, 300); // Check every 300ms

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
    setTimeout(checkForVaultLoaded, 100);
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
