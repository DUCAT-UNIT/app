import React, { useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { COLORS } from '../../theme';
import { API } from '../../utils/constants';
import { combinedInjectedScript } from '../../utils/vaultWebViewScripts';
import { useVaultLoading } from '../../hooks/useVaultLoading';
import { useVaultWebView, WalletCredentials, VaultData } from '../../hooks/useVaultWebView';
import { useVaultMessages } from '../../hooks/useVaultMessages';
import { logger } from '../../utils/logger';

/**
 * Extended vault data structure for screen display
 */
interface ExtendedVaultData extends VaultData {
  vaultTag?: string;
  totalDebt?: number;
  totalCollateral?: number;
  currentPrice?: number;
}

/**
 * Snackbar params for vault messages
 */
interface VaultSnackbarParams {
  type: string;
  action?: string;
  message?: string;
}

/**
 * Props for VaultScreen
 */
interface VaultScreenProps {
  visible: boolean;
  walletCredentials?: WalletCredentials | null;
  vaultData?: ExtendedVaultData;
  showSnackbar?: (params: VaultSnackbarParams) => void;
}

const VaultScreen = React.memo(function VaultScreen({
  visible,
  walletCredentials,
  vaultData,
  showSnackbar
}: VaultScreenProps): React.ReactElement {
  // Timeout ref to track and clear loading timeout
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loading state management
  const {
    setIsLoading,
    preparingVault,
    setPreparingVault,
    preparingMessage,
    shouldShowLoading,
  } = useVaultLoading(visible);

  // WebView management
  const {
    webViewRef,
    webViewUrl,
    setWebViewLoaded,
    hasLoadedOnceRef,
    injectWalletCredentials,
    handleCredentialConfirmation,
  } = useVaultWebView(walletCredentials ?? null, vaultData, visible);

  // Message handling
  const { handleMessage } = useVaultMessages(
    webViewRef,
    showSnackbar,
    injectWalletCredentials,
    setIsLoading,
    setPreparingVault,
    loadingTimeoutRef,
    handleCredentialConfirmation
  );

  // Handle external link navigation - open in browser instead of WebView
  const handleShouldStartLoad = (request: WebViewNavigation): boolean => {
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
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={[styles.webview, shouldShowLoading && styles.webviewHidden]}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        webviewDebuggingEnabled={true}
        incognito={false}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setIsLoading(true);
          setPreparingVault(true);
          setWebViewLoaded(false);
        }}
        onLoadEnd={() => {
          logger.debug('🏦 WebView onLoadEnd fired');
          setWebViewLoaded(true);
          hasLoadedOnceRef.current = true;

          // Clear any existing timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          // Set timeout for slow networks or account switching
          // Reduced from 15s to 3s since we now use caching
          loadingTimeoutRef.current = setTimeout(() => {
            logger.debug('⏱️ Loading timeout reached - hiding loading screen');
            setIsLoading(false);
            setPreparingVault(false);
            loadingTimeoutRef.current = null;
          }, 3000);

          // Inject wallet credentials immediately after page loads
          // The injection now has built-in retry logic and confirmation
          logger.debug('🏦 Page loaded, injecting credentials');
          injectWalletCredentials();
        }}
        injectedJavaScript={combinedInjectedScript}
        onMessage={handleMessage}
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
            <Text style={styles.preparingText}>Loading your vault</Text>
          )}
        </View>
      )}
    </View>
  );
});

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
