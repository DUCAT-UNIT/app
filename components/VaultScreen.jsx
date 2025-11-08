import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';

export default function VaultScreen({ visible, walletCredentials }) {
  if (!visible) return null;

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
        source={{ uri: webViewUrl }}
        style={styles.webview}
        startInLoadingState={true}
        userAgent="DucatMobile/1.0"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          </View>
        )}
        onLoadStart={() => console.log('[VaultScreen] Loading started')}
        onLoadEnd={() => console.log('[VaultScreen] Loading completed')}
      />
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
});
