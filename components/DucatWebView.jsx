import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import PropTypes from 'prop-types';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

export default function DucatWebView({ url, onClose }) {
  const webViewRef = useRef(null);

  useEffect(() => {
    console.log('[DucatWebView] Opening URL:', url);
  }, [url]);

  // Handle messages from web frontend
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[DucatWebView] Received message from web:', message);

      switch (message.type) {
        case 'PAGE_READY':
          console.log('[DucatWebView] Web page is ready');
          break;

        case 'REQUEST_WALLET_CONNECT':
          console.log('[DucatWebView] Web requested wallet connection');
          // Note: Wallet credentials are already in the URL
          break;

        case 'SIGN_PSBT_REQUEST':
          console.log('[DucatWebView] PSBT signing request:', message.payload);
          // TODO: Implement PSBT signing
          break;

        case 'SIGN_MESSAGE_REQUEST':
          console.log('[DucatWebView] Message signing request:', message.payload);
          // TODO: Implement message signing
          break;

        default:
          console.log('[DucatWebView] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[DucatWebView] Error handling message:', error);
    }
  };

  // Send message to web frontend
  const sendMessage = (message) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(message));
      console.log('[DucatWebView] Sent message to web:', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        userAgent="DucatMobile/1.0" // Helps frontend detect WebView
        style={styles.webview}
        onLoadStart={() => console.log('[DucatWebView] Loading started')}
        onLoadEnd={() => console.log('[DucatWebView] Loading completed')}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[DucatWebView] WebView error:', nativeEvent);
        }}
      />
    </SafeAreaView>
  );
}

DucatWebView.propTypes = {
  url: PropTypes.string.isRequired,
  onClose: PropTypes.func,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    height: 56,
    backgroundColor: COLORS.CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '500',
  },
  webview: {
    flex: 1,
  },
});
