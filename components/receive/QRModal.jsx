/**
 * QRModal Component
 * Displays QR code with address and share functionality
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../../theme';
import Icon from '../icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Calculate QR code size based on screen width
const QR_SIZE =
  SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default function QRModal({
  visible,
  address,
  addressType,
  onBack,
  onCopy,
  onShare,
  qrOpacity,
  translateX,
  translateY,
  qrModalPanResponder,
  styles,
  allowBackdropDismiss = false,
}) {
  if (!address) return null;

  return (
    <>
      {/* Backdrop for dismiss */}
      {visible && allowBackdropDismiss && (
        <TouchableOpacity
          style={localStyles.qrBackdrop}
          activeOpacity={1}
          onPress={onBack}
        />
      )}

      <Animated.View
        style={[
          styles.qrModalContainer,
          {
            opacity: qrOpacity,
            transform: [{ translateX }, { translateY }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
        {...qrModalPanResponder.panHandlers}
      >
      {/* Network header bar */}
      <View style={styles.qrModalNetworkBar}>
        <Text style={styles.qrModalNetworkText}>Mutinynet Edition</Text>
      </View>

      <ScrollView
        style={localStyles.scrollContainer}
        contentContainerStyle={styles.qrModalContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button and title */}
        <View style={localStyles.qrHeader}>
          <TouchableOpacity onPress={onBack} style={localStyles.backButton}>
            <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={localStyles.titleContainer}>
            <Text style={styles.qrModalTitle}>Bitcoin address</Text>
          </View>
        </View>
        <Text style={styles.qrModalSubtitle}>Only use this address to receive Bitcoin.</Text>

        {/* QR Code */}
        <View style={styles.qrCodeContainer}>
          <QRCode
            value={address}
            size={QR_SIZE}
            backgroundColor="white"
            color="black"
            logo={require('../../assets/logos/btc-logo.png')}
            logoSize={LOGO_SIZE}
            logoBackgroundColor="white"
            logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
          />
        </View>

        {/* Address container - tap to copy */}
        <TouchableOpacity
          style={styles.qrAddressContainer}
          onPress={onCopy}
          activeOpacity={0.7}
        >
          <View style={localStyles.addressContentContainer}>
            <View style={localStyles.addressLabelRow}>
              <Text style={styles.qrAddressLabelText}>{addressType}</Text>
              <Text style={localStyles.tapToCopyText}>Tap to copy</Text>
            </View>
            <Text style={styles.qrAddressFullText}>{address}</Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity style={styles.qrShareButton} onPress={onShare}>
          <Text style={styles.qrShareIcon}>↗</Text>
          <Text style={styles.qrShareButtonText}>Share</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  qrBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 998,
  },
  scrollContainer: {
    flex: 1,
  },
  qrHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: -10,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  addressContentContainer: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tapToCopyText: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});

QRModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  address: PropTypes.string,
  addressType: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onCopy: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  qrOpacity: PropTypes.object.isRequired,
  translateX: PropTypes.object.isRequired,
  translateY: PropTypes.object.isRequired,
  qrModalPanResponder: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  allowBackdropDismiss: PropTypes.bool,
};
