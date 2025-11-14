/**
 * ReceiveScreen
 * Displays Bitcoin addresses with QR codes for receiving funds
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Animated, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import AddressRow from '../../components/receive/AddressRow';
import QRModal from '../../components/receive/QRModal';
import { useReceiveScreenAnimations } from '../../hooks/useReceiveScreenAnimations';

const ReceiveScreen = React.memo(function ReceiveScreen({
  styles,
  showReceiveSheet,
  onClose,
  segwitAddress,
  taprootAddress,
  showToast,
}) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const {
    receiveSheetOpacity,
    receiveTranslateY,
    qrOpacity,
    translateX,
    translateY,
    panResponder,
    qrModalPanResponder,
    handleDismiss,
    handleQrBack,
    prepareQrAnimation,
  } = useReceiveScreenAnimations(showReceiveSheet, showQrModal, onClose);

  const handleCopyAddress = (address, type) => {
    Clipboard.setString(address);
    showToast(`${type} address copied to clipboard`);
  };

  const handleQrPress = (address, type) => {
    setSelectedAddress(address);
    setSelectedType(type);
    setShowQrModal(true);
    prepareQrAnimation();
  };

  const handleQrBackPress = () => {
    handleQrBack().start(() => {
      // Reset modal state after animation completes
      setShowQrModal(false);
      setSelectedAddress(null);
      setSelectedType(null);
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: selectedAddress,
      });
    } catch (error) {
      // Silently fail
    }
  };

  return (
    <>
      {showReceiveSheet && !showQrModal && (
        <TouchableOpacity
          style={styles.bottomSheetBackdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />
      )}

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            opacity: receiveSheetOpacity,
            transform: [{ translateY: receiveTranslateY }],
          },
        ]}
        pointerEvents={showReceiveSheet && !showQrModal ? 'auto' : 'none'}
        {...panResponder.panHandlers}
      >
        <View style={styles.bottomSheetHandle} />
        <Text style={styles.bottomSheetTitle}>Receive</Text>

        {/* Native SegWit Address Row */}
        <AddressRow
          label="Native SegWit"
          address={segwitAddress}
          tag="BTC"
          tagStyle={localStyles.btcTag}
          onCopy={() => handleCopyAddress(segwitAddress, 'SegWit')}
          onQrPress={() => handleQrPress(segwitAddress, 'Native SegWit')}
          styles={styles}
        />

        {/* Taproot Address Row */}
        <AddressRow
          label="Taproot"
          address={taprootAddress}
          tag="UNIT"
          tagStyle={localStyles.unitTag}
          onCopy={() => handleCopyAddress(taprootAddress, 'Taproot')}
          onQrPress={() => handleQrPress(taprootAddress, 'Taproot')}
          styles={styles}
        />
      </Animated.View>

      {/* QR Code Modal */}
      <QRModal
        visible={showQrModal}
        address={selectedAddress}
        addressType={selectedType}
        onBack={handleQrBackPress}
        onCopy={() => handleCopyAddress(selectedAddress, selectedType)}
        onShare={handleShare}
        qrOpacity={qrOpacity}
        translateX={translateX}
        translateY={translateY}
        qrModalPanResponder={qrModalPanResponder}
        styles={styles}
      />
    </>
  );
});

const localStyles = StyleSheet.create({
  btcTag: {
    container: {
      backgroundColor: COLORS.BITCOIN_ORANGE,
    },
    text: {
      color: COLORS.DARK_BG,
    },
  },
  unitTag: {
    container: {
      backgroundColor: COLORS.PRIMARY_BLUE,
    },
    text: {
      color: COLORS.VERY_LIGHT_GRAY,
    },
  },
});

ReceiveScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  showReceiveSheet: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  segwitAddress: PropTypes.string.isRequired,
  taprootAddress: PropTypes.string.isRequired,
  showToast: PropTypes.func.isRequired,
};

export default ReceiveScreen;
