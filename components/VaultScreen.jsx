import React from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../utils/colors';

export default function VaultScreen({ visible }) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://app.ducatprotocol.com' }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          </View>
        )}
      />
    </View>
  );
}

VaultScreen.propTypes = {
  visible: PropTypes.bool.isRequired,
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
