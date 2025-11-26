/**
 * ReceiveScreen
 * Displays Bitcoin addresses with QR codes for receiving funds
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Share, ViewStyle, TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AddressRow from '../../components/receive/AddressRow';
import QRModal from '../../components/receive/QRModal';
import { useReceiveScreenAnimations } from '../../hooks/useReceiveScreenAnimations';

/**
 * Style object for ReceiveScreen
 * Combines styles for all child components
 */
interface ReceiveScreenStyles {
  bottomSheetBackdrop: ViewStyle;
  bottomSheet: ViewStyle;
  bottomSheetHandle: ViewStyle;
  bottomSheetTitle: TextStyle;
  // AddressRow styles
  receiveAddressRow: ViewStyle;
  receiveAddressInfo: ViewStyle;
  receiveAddressLabel: TextStyle;
  receiveAddress: TextStyle;
  receiveQrButton: ViewStyle;
  // QRModal styles
  qrModalContainer: ViewStyle;
  qrModalNetworkBar: ViewStyle;
  qrModalNetworkText: TextStyle;
  qrModalContent: ViewStyle;
  qrModalTitle: TextStyle;
  qrModalSubtitle: TextStyle;
  qrCodeContainer: ViewStyle;
  qrAddressContainer: ViewStyle;
  qrAddressLabelText: TextStyle;
  qrAddressFullText: TextStyle;
  qrShareButton: ViewStyle;
  qrShareIcon: TextStyle;
  qrShareButtonText: TextStyle;
  [key: string]: ViewStyle | TextStyle;
}

/**
 * Props for ReceiveScreen
 */
interface ReceiveScreenProps {
  styles: ReceiveScreenStyles;
  showReceiveSheet: boolean;
  onClose: () => void;
  segwitAddress: string;
  taprootAddress: string;
  showToast: (message: string) => void;
  autoOpenQR?: boolean;
  preSelectedAddress?: string | null;
  preSelectedType?: string | null;
  dismissQRClosesSheet?: boolean;
}

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
  dismissQRClosesSheet: _dismissQRClosesSheet = true,
}: ReceiveScreenProps): React.ReactElement {
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
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

  const handleCopyAddress = (address: string, type: string): void => {
    Clipboard.setString(address);
    showToast(`${type} address copied to clipboard`);
  };

  // Set up swipe dismiss callback to do EXACTLY what back button does
  React.useEffect(() => {
    setOnQrSwipeDismiss(() => {
      // If autoOpenQR is true, always dismiss the entire sheet
      if (autoOpenQR) {
        handleQrBack().start(() => {
          setShowQrModal(false);
          setSelectedAddress(null);
          setSelectedType(null);
          resetAfterQr();
          onClose(); // Close the entire receive sheet
        });
      } else {
        // Normal behavior: go back to address selection
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

  const handleQrPress = (address: string, type: string): void => {
    setSelectedAddress(address);
    setSelectedType(type);
    setShowQrModal(true);
    prepareQrAnimation();
  };

  const handleQrBackPress = (): void => {
    // If autoOpenQR is true, always dismiss the entire sheet (whether dismissQRClosesSheet is true or false)
    if (autoOpenQR) {
      handleQrBack().start(() => {
        setShowQrModal(false);
        setSelectedAddress(null);
        setSelectedType(null);
        resetAfterQr();
        onClose(); // Close the entire receive sheet
      });
    } else {
      // Normal behavior: go back to address selection
      handleQrBack().start(() => {
        setShowQrModal(false);
        setSelectedAddress(null);
        setSelectedType(null);
        resetAfterQr();
      });
    }
  };

  const handleShare = async (): Promise<void> => {
    try {
      await Share.share({
        message: selectedAddress || '',
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

        {/* BTC Address Row */}
        <AddressRow
          label="BTC Address"
          address={segwitAddress}
          tag="BTC"
          onCopy={() => handleCopyAddress(segwitAddress, 'BTC')}
          onQrPress={() => handleQrPress(segwitAddress, 'BTC Address')}
          styles={styles}
        />

        {/* UNIT Address Row */}
        <AddressRow
          label="UNIT Address"
          address={taprootAddress}
          tag="UNIT"
          onCopy={() => handleCopyAddress(taprootAddress, 'UNIT')}
          onQrPress={() => handleQrPress(taprootAddress, 'UNIT Address')}
          styles={styles}
        />
      </Animated.View>

      {/* QR Code Modal */}
      <QRModal
        visible={showQrModal}
        address={selectedAddress || ''}
        addressType={selectedType || ''}
        onBack={handleQrBackPress}
        onCopy={() => handleCopyAddress(selectedAddress || '', selectedType || '')}
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

export default ReceiveScreen;
