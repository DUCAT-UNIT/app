import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, PanResponder, Image, Share, Animated, Dimensions, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Calculate QR code size based on screen width
// iPhone SE has 320px width, larger phones have 375-430px
const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21); // 21% of QR size

export default function ReceiveScreen({
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
  const isDismissing = useRef(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const receiveSheetOpacity = useRef(new Animated.Value(0)).current;
  const receiveOpacity = useRef(new Animated.Value(1)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe-down to dismiss
  const receiveTranslateY = useRef(new Animated.Value(0)).current;

  const panResponderRef = useRef(null);
  const qrModalPanResponderRef = useRef(null);

  const handleCopyAddress = (address, type) => {
    Clipboard.setString(address);
    showToast(`${type} address copied to clipboard`);
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

  const handleDismiss = () => {
    Animated.timing(receiveTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      receiveSheetOpacity.setValue(0);
      onClose();
    });
  };

  // Create pan responders once after functions are defined
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showQrModal) return false;
        const isDownwardSwipe = gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (showQrModal) return;
        if (gestureState.dy > 0) {
          receiveTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (showQrModal) return;

        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(receiveTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!qrModalPanResponderRef.current) {
    qrModalPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
          const progress = Math.min(gestureState.dx / 100, 1);
          receiveOpacity.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          setShowQrModal(false);

          Animated.parallel([
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(qrOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(receiveOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }),
            Animated.timing(receiveOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    });
  }

  // Reset position when opening, force invisible when closed
  const prevShowReceiveSheet = useRef(showReceiveSheet);
  if (showReceiveSheet && !prevShowReceiveSheet.current) {
    // Just opened - reset to visible position
    receiveTranslateY.setValue(0);
    receiveSheetOpacity.setValue(1);
  } else if (!showReceiveSheet && prevShowReceiveSheet.current) {
    // Just closed - force invisible immediately
    receiveSheetOpacity.setValue(0);
  }
  prevShowReceiveSheet.current = showReceiveSheet;

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
        pointerEvents={!showReceiveSheet || showQrModal ? 'none' : 'auto'}
        {...panResponderRef.current.panHandlers}
      >
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
          {...qrModalPanResponderRef.current.panHandlers}
        >
              {/* Network header bar */}
              <View style={styles.qrModalNetworkBar}>
                <Text style={styles.qrModalNetworkText}>Mutinynet Edition</Text>
              </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.qrModalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header with back button and title on same line for small screens */}
              <View style={[
                SCREEN_WIDTH <= 400 && {
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: '100%',
                  justifyContent: 'center',
                  position: 'relative',
                  marginTop: 20,
                }
              ]}>
                <TouchableOpacity
                  onPress={() => {
                    // Start showing receive sheet immediately, then animate
                    setShowQrModal(false);

                    Animated.parallel([
                      Animated.timing(translateX, {
                        toValue: SCREEN_WIDTH,
                        duration: 250,
                        useNativeDriver: true,
                      }),
                      Animated.timing(qrOpacity, {
                        toValue: 0,
                        duration: 150,
                        useNativeDriver: true,
                      }),
                      Animated.timing(receiveOpacity, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  }}
                  style={[SCREEN_WIDTH <= 400 && { position: 'absolute', left: 0 }]}
                >
                  <Icon name="back" size={SCREEN_WIDTH <= 400 ? 28 : 24} color={COLORS.VERY_LIGHT_GRAY} />
                </TouchableOpacity>
                <Text style={styles.qrModalTitle}>Bitcoin address</Text>
              </View>
              <Text style={styles.qrModalSubtitle}>Only use this address to receive Bitcoin.</Text>

              {/* QR Code */}
              <View style={styles.qrCodeContainer}>
                <QRCode
                  value={selectedAddress}
                  size={QR_SIZE}
                  backgroundColor="white"
                  color="black"
                  logo={require('../assets/logos/btc-logo.png')}
                  logoSize={LOGO_SIZE}
                  logoBackgroundColor="white"
                  logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
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
            </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

ReceiveScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  showReceiveSheet: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  segwitAddress: PropTypes.string.isRequired,
  taprootAddress: PropTypes.string.isRequired,
  showToast: PropTypes.func.isRequired,
};
