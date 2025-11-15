/**
 * ReceiveQRScreen - QR code display for receiving Bitcoin
 * Matches the design of the QRModal component but as a navigation screen
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Icon from '../../components/icons';
import { COLORS } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;

// Calculate QR code size based on screen width (same as QRModal)
const QR_SIZE =
  SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default function ReceiveQRScreen({ route, navigation }) {
  const { address, addressType = 'Native SegWit' } = route.params || {};
  const [justCopied, setJustCopied] = useState(false);


  const handleCopy = async () => {
    await Clipboard.setStringAsync(address);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: address,
      });
    } catch (error) {
      console.error('[ReceiveQRScreen] Error sharing address:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Network header bar */}
      <View style={styles.networkBar}>
        <Text style={styles.networkText}>Mutinynet Edition</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button and title */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              {addressType === 'Taproot' ? 'UNIT address' : 'Bitcoin address'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {addressType === 'Taproot'
            ? 'Only use this address to receive UNIT.'
            : 'Only use this address to receive Bitcoin.'}
        </Text>

        {/* QR Code */}
        <View style={styles.qrCodeContainer}>
          <QRCode
            value={address}
            size={QR_SIZE}
            backgroundColor="white"
            color="black"
            logo={
              addressType === 'Taproot'
                ? require('../../assets/logos/unit-logo.png')
                : require('../../assets/logos/btc-logo.png')
            }
            logoSize={LOGO_SIZE}
            logoBackgroundColor="white"
            logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
          />
        </View>

        {/* Address container - tap to copy */}
        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          <View style={styles.addressContentContainer}>
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>
                {addressType === 'Taproot' ? 'UNIT' : addressType}
              </Text>
              <Text style={styles.tapToCopyText}>
                {justCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </View>
            <Text style={styles.addressFullText}>{address}</Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareIcon}>↗</Text>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  networkBar: {
    backgroundColor: COLORS.CARD_BG,
    paddingVertical: SCREEN_WIDTH < 375 ? 4 : 6,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
    borderBottomWidth: 0.8,
    borderBottomColor: COLORS.BORDER_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkText: {
    color: COLORS.PURPLE,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: SCREEN_WIDTH <= 400 ? 10 : 20,
    paddingBottom: SCREEN_WIDTH <= 400 ? 24 : 32,
    flexGrow: 1,
  },
  header: {
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
  title: {
    fontSize: SCREEN_WIDTH < 375 ? 20 : 28,
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
    marginBottom: SCREEN_WIDTH < 375 ? 4 : 8,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH < 375 ? 12 : 15,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: SCREEN_WIDTH <= 400 ? 8 : 40,
    textAlign: 'center',
  },
  qrCodeContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SCREEN_WIDTH < 375 ? 10 : 20,
    borderRadius: 16,
    marginBottom: SCREEN_WIDTH < 375 ? 12 : 32,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: SCREEN_WIDTH < 375 ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH < 375 ? 16 : 32,
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
  addressLabelText: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  tapToCopyText: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  addressFullText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 20,
  },
  shareButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    paddingVertical: SCREEN_WIDTH < 375 ? 12 : 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 20,
    color: COLORS.VERY_LIGHT_GRAY,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
});
