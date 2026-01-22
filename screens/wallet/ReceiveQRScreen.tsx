/**
 * ReceiveQRScreen - QR code display for receiving Bitcoin
 * Matches the design of the QRModal component but as a navigation screen
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Share } from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Icon from '../../components/icons';
import { COLORS } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { useNotifications } from '../../stores/notificationStore';

/**
 * Route parameters for ReceiveQRScreen
 */
interface ReceiveQRRouteParams {
  address: string;
  addressType?: string;
}

/**
 * Props for ReceiveQRScreen
 */
interface ReceiveQRScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: ReceiveQRRouteParams }, 'params'>;
}

export default function ReceiveQRScreen({ route, navigation }: ReceiveQRScreenProps): React.JSX.Element {
  const { address, addressType = 'Native SegWit' } = route.params || {};
  const [justCopied, setJustCopied] = useState(false);
  const { width, s, sf, screenSize } = useResponsive();
  const { showSnackbar } = useNotifications();

  // Calculate responsive values
  const responsiveValues = useMemo(() => {
    const horizontalPadding = screenSize === 'XS' ? 16 : 20;
    const qrSize = screenSize === 'XS' ? Math.min(width * 0.5, 180) : Math.min(width * 0.6, 220);
    const logoSize = Math.floor(qrSize * 0.21);
    const isSmallScreen = screenSize === 'XS' || screenSize === 'S';

    return {
      horizontalPadding,
      qrSize,
      logoSize,
      networkBarPadding: isSmallScreen ? 4 : 6,
      contentPaddingTop: width <= 400 ? 10 : 20,
      contentPaddingBottom: width <= 400 ? 24 : 32,
      titleSize: isSmallScreen ? 20 : 28,
      titleMarginBottom: isSmallScreen ? 4 : 8,
      subtitleSize: isSmallScreen ? 12 : 15,
      subtitleMarginBottom: width <= 400 ? 8 : 40,
      qrContainerPadding: isSmallScreen ? 10 : 20,
      qrContainerMarginBottom: isSmallScreen ? 12 : 32,
      addressContainerPadding: isSmallScreen ? 12 : 16,
      addressContainerMarginBottom: isSmallScreen ? 16 : 32,
      shareButtonPaddingVertical: isSmallScreen ? 12 : 14,
    };
  }, [width, screenSize]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(address);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    const assetName = addressType === 'Taproot' ? 'UNIT' : 'BTC';
    showSnackbar({
      message: `${assetName} address copied`,
      type: 'success',
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: address,
      });
    } catch (error: unknown) {
      // Silently fail - user cancelled share or share not available
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="receive-qr-screen">
      {/* Network header bar */}
      <View style={[styles.networkBar, { paddingVertical: responsiveValues.networkBarPadding }]}>
        <Text style={styles.networkText}>Mutinynet Edition</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: responsiveValues.horizontalPadding,
            paddingTop: responsiveValues.contentPaddingTop,
            paddingBottom: responsiveValues.contentPaddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button and title */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} testID="receive-back-btn">
            <Icon name="back" size={s(24)} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { fontSize: responsiveValues.titleSize, marginBottom: responsiveValues.titleMarginBottom }]}>
              {addressType === 'Taproot' ? 'UNIT address' : 'Bitcoin address'}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { fontSize: responsiveValues.subtitleSize, marginBottom: responsiveValues.subtitleMarginBottom }]}>
          {addressType === 'Taproot'
            ? 'Only use this address to receive UNIT.'
            : 'Only use this address to receive Bitcoin.'}
        </Text>

        {/* QR Code */}
        <View style={[styles.qrCodeContainer, { padding: responsiveValues.qrContainerPadding, marginBottom: responsiveValues.qrContainerMarginBottom }]} testID="receive-qr-code">
          <QRCode
            value={address}
            size={responsiveValues.qrSize}
            backgroundColor="white"
            color="black"
            logo={
              addressType === 'Taproot'
                ? require('../../assets/logos/unit-log.png')
                : require('../../assets/logos/btc-logo.png')
            }
            logoSize={responsiveValues.logoSize}
            logoBackgroundColor="white"
            logoBorderRadius={Math.floor(responsiveValues.logoSize / 2)}
          />
        </View>

        {/* Address container - tap to copy */}
        <TouchableOpacity
          style={[styles.addressContainer, { padding: responsiveValues.addressContainerPadding, marginBottom: responsiveValues.addressContainerMarginBottom }]}
          onPress={handleCopy}
          activeOpacity={0.7}
          testID="receive-copy-btn"
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
            <Text style={styles.addressFullText} testID="receive-address">{address}</Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity style={[styles.shareButton, { paddingVertical: responsiveValues.shareButtonPaddingVertical }]} onPress={handleShare} testID="receive-share-btn">
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
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: 'bold',
  },
  subtitle: {
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  qrCodeContainer: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    flexDirection: 'row',
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
