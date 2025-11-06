import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Alert, Image, Share, Animated, Dimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../utils/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ReceiveScreen({
  styles,
  showReceiveSheet,
  onClose,
  segwitAddress,
  taprootAddress,
}) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const receiveOpacity = useRef(new Animated.Value(1)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe-down to dismiss
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !showQrModal && false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      if (showQrModal) return false;
      return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (showQrModal) return;
      if (gestureState.dy > 100) {
        onClose();
      }
    },
  });

  // Pan responder for swipe-right to dismiss QR modal
  const qrModalPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Allow swipe right only
      const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      return isSwipeRight;
    },
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      return isSwipeRight;
    },
    onPanResponderMove: (_, gestureState) => {
      // Move with the finger (horizontal only)
      if (gestureState.dx > 0) {
        translateX.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 100 || gestureState.vx > 0.5) {
        // Animate slide to the right with fade
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(qrOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setTimeout(() => {
            setShowQrModal(false);
            receiveOpacity.setValue(1);
          }, 100);
        });
      } else {
        // Snap back
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }).start();
      }
    },
  });

  const handleCopyAddress = (address, type) => {
    Clipboard.setString(address);
    Alert.alert('Copied', `${type} address copied to clipboard`);
  };

  const handleQrPress = (address, type, tag) => {
    setSelectedAddress(address);
    setSelectedType(type);
    setShowQrModal(true);
    translateX.setValue(0);
    translateY.setValue(0);
    receiveOpacity.setValue(0);
    qrOpacity.setValue(1);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: selectedAddress,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (!showReceiveSheet) return null;

  return (
    <>
      {!showQrModal && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={onClose}
          />
          <Animated.View style={[styles.bottomSheet, { opacity: receiveOpacity }]} {...panResponder.panHandlers}>
            <View style={styles.bottomSheetHandle} />

            <Text style={styles.bottomSheetTitle}>Receive Bitcoin</Text>

        {/* Native SegWit Address Row */}
        <TouchableOpacity
          style={styles.receiveAddressRow}
          onPress={() => handleCopyAddress(segwitAddress, 'SegWit')}
          activeOpacity={0.7}
        >
          <View style={styles.receiveAddressInfo}>
            <View style={styles.receiveAddressLabelRow}>
              <Text style={styles.receiveAddressLabel}>Native SegWit</Text>
              <View style={styles.receiveAddressTag}>
                <Text style={styles.receiveAddressTagText}>BTC</Text>
              </View>
            </View>
            <Text style={styles.receiveAddress} numberOfLines={1} ellipsizeMode="middle">
              {segwitAddress}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.receiveQrButton}
            onPress={(e) => {
              e.stopPropagation();
              handleQrPress(segwitAddress, 'Native SegWit', 'BTC');
            }}
          >
            <Image
              source={require('../assets/qr-code.png')}
              style={styles.receiveQrIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Taproot Address Row */}
        <TouchableOpacity
          style={styles.receiveAddressRow}
          onPress={() => handleCopyAddress(taprootAddress, 'Taproot')}
          activeOpacity={0.7}
        >
          <View style={styles.receiveAddressInfo}>
            <View style={styles.receiveAddressLabelRow}>
              <Text style={styles.receiveAddressLabel}>Taproot</Text>
              <View style={styles.receiveAddressTag}>
                <Text style={styles.receiveAddressTagText}>Runes</Text>
              </View>
            </View>
            <Text style={styles.receiveAddress} numberOfLines={1} ellipsizeMode="middle">
              {taprootAddress}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.receiveQrButton}
            onPress={(e) => {
              e.stopPropagation();
              handleQrPress(taprootAddress, 'Taproot', 'Runes');
            }}
          >
            <Image
              source={require('../assets/qr-code.png')}
              style={styles.receiveQrIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
        </>
      )}

      {/* QR Code Modal */}
      {selectedAddress && (
        <Animated.View
          style={[
            styles.qrModalContainer,
            {
              opacity: qrOpacity,
              transform: [
                { translateX },
                { translateY },
              ],
            },
          ]}
          pointerEvents={showQrModal ? 'auto' : 'none'}
          {...qrModalPanResponder.panHandlers}
        >
              {/* Network header bar */}
              <View style={styles.qrModalNetworkBar}>
                <Text style={styles.qrModalNetworkText}>Mutinynet Edition</Text>
              </View>

            {/* Header with back button */}
            <View style={styles.qrModalHeader}>
              <TouchableOpacity
                onPress={() => {
                  Animated.parallel([
                    Animated.timing(translateX, {
                      toValue: SCREEN_WIDTH,
                      duration: 250,
                      useNativeDriver: true,
                    }),
                    Animated.timing(qrOpacity, {
                      toValue: 0,
                      duration: 250,
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    setTimeout(() => {
                      setShowQrModal(false);
                      receiveOpacity.setValue(1);
                    }, 100);
                  });
                }}
                style={styles.qrModalBackButton}
              >
                <Text style={styles.qrModalBackArrow}>‹</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalContent}>
              <Text style={styles.qrModalTitle}>Bitcoin address</Text>
              <Text style={styles.qrModalSubtitle}>Only use this address to receive Bitcoin.</Text>

              {/* QR Code */}
              <View style={styles.qrCodeContainer}>
                <QRCode
                  value={selectedAddress}
                  size={280}
                  backgroundColor="white"
                  color="black"
                  logo={require('../assets/btc-logo.png')}
                  logoSize={60}
                  logoBackgroundColor="white"
                  logoBorderRadius={30}
                />
              </View>

              {/* Address container with label and copy button */}
              <View style={styles.qrAddressContainer}>
                <View style={styles.qrAddressLeft}>
                  <Text style={styles.qrAddressLabelText}>{selectedType}</Text>
                  <Text style={styles.qrAddressFullText}>{selectedAddress}</Text>
                </View>
                <TouchableOpacity
                  style={styles.qrCopyButton}
                  onPress={() => handleCopyAddress(selectedAddress, selectedType)}
                >
                  <Text style={styles.qrCopyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>

              {/* Share button */}
              <TouchableOpacity style={styles.qrShareButton} onPress={handleShare}>
                <Text style={styles.qrShareIcon}>↗</Text>
                <Text style={styles.qrShareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
        </Animated.View>
      )}
    </>
  );
}
