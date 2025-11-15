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
  autoOpenQR = false,
  preSelectedAddress = null,
  preSelectedType = null,
  dismissQRClosesSheet = true, // If false, dismissing QR just closes the QR, not the entire sheet
}) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const hasAutoOpenedRef = React.useRef(false);

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
    resetAfterQr,
    setOnQrSwipeDismiss,
  } = useReceiveScreenAnimations(showReceiveSheet, showQrModal, onClose);

  const handleCopyAddress = (address, type) => {
    Clipboard.setString(address);
    showToast(`${type} address copied to clipboard`);
  };

  // Set up swipe dismiss callback to do EXACTLY what back button does
  React.useEffect(() => {
    setOnQrSwipeDismiss(() => {
      console.log('[ReceiveScreen] Swipe dismiss triggered, autoOpenQR:', autoOpenQR);
      // If autoOpenQR is true, always dismiss the entire sheet
      if (autoOpenQR) {
        console.log('[ReceiveScreen] Auto-open mode (swipe): dismissing QR and closing sheet');
        handleQrBack().start(() => {
          console.log('[ReceiveScreen] Swipe animation complete, calling onClose');
          setShowQrModal(false);
          setSelectedAddress(null);
          setSelectedType(null);
          resetAfterQr();
          onClose(); // Close the entire receive sheet
        });
      } else {
        // Normal behavior: go back to address selection
        console.log('[ReceiveScreen] Normal mode (swipe): going back to address selection');
        handleQrBack().start(() => {
          setShowQrModal(false);
          setSelectedAddress(null);
          setSelectedType(null);
          resetAfterQr();
        });
      }
    });
  }, [setOnQrSwipeDismiss, handleQrBack, resetAfterQr, autoOpenQR, onClose]);

  // Handle auto-opening QR modal when sheet opens
  React.useEffect(() => {
    if (showReceiveSheet && autoOpenQR && preSelectedAddress && preSelectedType && !hasAutoOpenedRef.current) {
      console.log('[ReceiveScreen] Auto-opening QR modal');
      hasAutoOpenedRef.current = true;
      // Delay to ensure animation is ready
      setTimeout(() => {
        setShowQrModal(true);
        setSelectedAddress(preSelectedAddress);
        setSelectedType(preSelectedType);
        prepareQrAnimation();
      }, 50);
    } else if (!showReceiveSheet) {
      // Reset when sheet closes
      hasAutoOpenedRef.current = false;
    }
  }, [showReceiveSheet, autoOpenQR, preSelectedAddress, preSelectedType, prepareQrAnimation]);

  const handleQrPress = (address, type) => {
    setSelectedAddress(address);
    setSelectedType(type);
    setShowQrModal(true);
    prepareQrAnimation();
  };

  const handleQrBackPress = () => {
    console.log('[ReceiveScreen] handleQrBackPress called, autoOpenQR:', autoOpenQR);
    // If autoOpenQR is true, always dismiss the entire sheet (whether dismissQRClosesSheet is true or false)
    if (autoOpenQR) {
      console.log('[ReceiveScreen] Auto-open mode: dismissing QR and closing sheet');
      handleQrBack().start(() => {
        console.log('[ReceiveScreen] Animation complete, calling onClose');
        setShowQrModal(false);
        setSelectedAddress(null);
        setSelectedType(null);
        resetAfterQr();
        onClose(); // Close the entire receive sheet
      });
    } else {
      // Normal behavior: go back to address selection
      console.log('[ReceiveScreen] Normal mode: going back to address selection');
      handleQrBack().start(() => {
        setShowQrModal(false);
        setSelectedAddress(null);
        setSelectedType(null);
        resetAfterQr();
      });
    }
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
        allowBackdropDismiss={autoOpenQR}
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
  autoOpenQR: PropTypes.bool,
  preSelectedAddress: PropTypes.string,
  preSelectedType: PropTypes.string,
  dismissQRClosesSheet: PropTypes.bool,
};

export default ReceiveScreen;
