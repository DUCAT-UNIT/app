/**
 * ReceiveQRScreen - QR code display for receiving Bitcoin
 * Matches the design of the QRModal component but as a navigation screen
 */

import { NavigationProp, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/icons';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import { NETWORK_EDITION_LABEL } from '../../utils/constants';
import { analytics } from '../../services/analyticsService';
import { RECEIVE_EVENTS } from '../../constants/analyticsEvents';

/**
 * Route parameters for ReceiveQRScreen
 */
interface ReceiveQRRouteParams {
  address: string;
  addressType?: string;
  assetType?: 'BTC' | 'UNIT' | 'USDC' | 'ETH';
  networkLabel?: string;
}

/**
 * Props for ReceiveQRScreen
 */
interface ReceiveQRScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: ReceiveQRRouteParams }, 'params'>;
}

const BTC_QR_LOGO = require('../../assets/logos/btc-logo.png');
const UNIT_QR_LOGO = require('../../assets/logos/unit-log.png');

const ETH_QR_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 417">
  <polygon points="127.6,0 124.8,9.5 124.8,279.1 127.6,281.9 255.2,208.3" fill="#343434"/>
  <polygon points="127.6,0 0,208.3 127.6,281.9 127.6,151.1" fill="#8C8C8C"/>
  <polygon points="127.6,306.1 126,308 126,404.1 127.6,408.7 255.3,232.5" fill="#3C3C3B"/>
  <polygon points="127.6,408.7 127.6,306.1 0,232.5" fill="#8C8C8C"/>
  <polygon points="127.6,281.9 255.2,208.3 127.6,151.1" fill="#141414"/>
  <polygon points="0,208.3 127.6,281.9 127.6,151.1" fill="#393939"/>
</svg>`;

const USDC_QR_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000">
  <path d="M1000 2000c554.17 0 1000-445.83 1000-1000S1554.17 0 1000 0 0 445.83 0 1000s445.83 1000 1000 1000z" fill="#2775CA"/>
  <path d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z" fill="white"/>
  <path d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5z" fill="white"/>
  <path d="M1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z" fill="white"/>
</svg>`;

type QrLogoProps = Pick<React.ComponentProps<typeof QRCode>, 'logo' | 'logoSVG'>;

function getQrLogo(assetType: ReceiveQRRouteParams['assetType']): QrLogoProps {
  switch (assetType) {
    case 'UNIT':
      return { logo: UNIT_QR_LOGO };
    case 'BTC':
      return { logo: BTC_QR_LOGO };
    case 'USDC':
      return { logoSVG: USDC_QR_LOGO_SVG };
    case 'ETH':
      return { logoSVG: ETH_QR_LOGO_SVG };
    default:
      return {};
  }
}

export default function ReceiveQRScreen({
  route,
  navigation,
}: ReceiveQRScreenProps): React.JSX.Element {
  const { address, addressType = 'Native SegWit', assetType, networkLabel } = route.params || {};
  const [justCopied, setJustCopied] = useState(false);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, s, screenSize } = useResponsive();
  const { showSnackbar } = useNotifications();
  const { settingsHandlers } = useSettingsHandlers();
  const resolvedAssetType = assetType || (addressType === 'Taproot' ? 'UNIT' : 'BTC');
  const isHiddenSepoliaAsset =
    (resolvedAssetType === 'USDC' || resolvedAssetType === 'ETH') &&
    !settingsHandlers.usdcFeaturesEnabled;
  const title =
    resolvedAssetType === 'USDC'
      ? 'Sepolia USDC address'
      : resolvedAssetType === 'ETH'
        ? 'Sepolia ETH address'
        : resolvedAssetType === 'UNIT'
          ? 'UNIT address'
          : 'Bitcoin address';
  const subtitle =
    resolvedAssetType === 'USDC'
      ? 'Only use this address to receive Sepolia USDC on Ethereum Sepolia.'
      : resolvedAssetType === 'ETH'
        ? 'Only use this address to receive Sepolia ETH on Ethereum Sepolia.'
        : resolvedAssetType === 'UNIT'
          ? 'Only use this address to receive UNIT.'
          : 'Only use this address to receive Bitcoin.';
  const copyAccessibilityAssetLabel =
    resolvedAssetType === 'USDC'
      ? 'Sepolia USDC Address'
      : resolvedAssetType === 'ETH'
        ? 'Sepolia ETH Address'
        : resolvedAssetType === 'UNIT'
          ? 'UNIT Address'
          : 'BTC Address';
  const copyAccessibilityLabel = `${copyAccessibilityAssetLabel}, ${
    justCopied ? 'Copied' : 'Tap to copy'
  }, ${address}`;
  const qrLogo = getQrLogo(resolvedAssetType);

  useEffect(() => {
    if (isHiddenSepoliaAsset) {
      navigation.goBack();
    }
  }, [isHiddenSepoliaAsset, navigation]);

  useEffect(() => {
    analytics.track(RECEIVE_EVENTS.RECEIVE_SCREEN_VIEWED, { address_type: addressType });
  }, [addressType]);

  useEffect(
    () => () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    },
    []
  );

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
    analytics.track(RECEIVE_EVENTS.ADDRESS_COPIED, { address_type: addressType });
    await Clipboard.setStringAsync(address);
    setJustCopied(true);
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = setTimeout(() => {
      copyResetTimerRef.current = null;
      setJustCopied(false);
    }, 2000);
    (copyResetTimerRef.current as { unref?: () => void }).unref?.();
    const assetName = resolvedAssetType === 'USDC' ? 'Sepolia USDC' : resolvedAssetType;
    showSnackbar({
      message: `${assetName} address copied`,
      type: 'success',
    });
  };

  const handleShare = async () => {
    try {
      analytics.track(RECEIVE_EVENTS.ADDRESS_SHARED, { address_type: addressType });
      await Share.share({
        message: address,
      });
    } catch (error: unknown) {
      // Silently fail - user cancelled share or share not available
    }
  };

  if (isHiddenSepoliaAsset) {
    return <SafeAreaView style={styles.container} edges={['top']} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="receive-qr-screen">
      {/* Network header bar */}
      <View style={[styles.networkBar, { paddingVertical: responsiveValues.networkBarPadding }]}>
        <Text style={styles.networkText}>{networkLabel || NETWORK_EDITION_LABEL}</Text>
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            testID="receive-back-btn"
          >
            <Icon name="back" size={s(24)} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.title,
                {
                  fontSize: responsiveValues.titleSize,
                  marginBottom: responsiveValues.titleMarginBottom,
                },
              ]}
            >
              {title}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.subtitle,
            {
              fontSize: responsiveValues.subtitleSize,
              marginBottom: responsiveValues.subtitleMarginBottom,
            },
          ]}
        >
          {subtitle}
        </Text>

        {/* QR Code */}
        <View
          style={[
            styles.qrCodeContainer,
            {
              padding: responsiveValues.qrContainerPadding,
              marginBottom: responsiveValues.qrContainerMarginBottom,
            },
          ]}
          testID="receive-qr-code"
        >
          <QRCode
            value={address}
            size={responsiveValues.qrSize}
            backgroundColor="white"
            color="black"
            logo={qrLogo.logo}
            logoSVG={qrLogo.logoSVG}
            logoSize={responsiveValues.logoSize}
            logoBackgroundColor="white"
            logoBorderRadius={Math.floor(responsiveValues.logoSize / 2)}
            logoMargin={Math.max(3, Math.floor(responsiveValues.logoSize * 0.1))}
            ecl="H"
          />
        </View>

        {/* Address container - tap to copy */}
        <TouchableOpacity
          style={[
            styles.addressContainer,
            {
              padding: responsiveValues.addressContainerPadding,
              marginBottom: responsiveValues.addressContainerMarginBottom,
            },
          ]}
          onPress={handleCopy}
          activeOpacity={0.7}
          testID="receive-copy-btn"
          accessibilityRole="button"
          accessibilityLabel={copyAccessibilityLabel}
        >
          <View style={styles.addressContentContainer}>
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>
                {networkLabel ||
                  (resolvedAssetType === 'USDC'
                    ? 'Sepolia USDC'
                    : resolvedAssetType === 'ETH'
                      ? 'Ethereum Sepolia'
                      : resolvedAssetType === 'UNIT'
                        ? 'UNIT'
                        : addressType)}
              </Text>
              <Text style={styles.tapToCopyText}>{justCopied ? 'Copied!' : 'Tap to copy'}</Text>
            </View>
            <Text style={styles.addressFullText} testID="receive-address">
              {address}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity
          style={[
            styles.shareButton,
            { paddingVertical: responsiveValues.shareButtonPaddingVertical },
          ]}
          onPress={handleShare}
          testID="receive-share-btn"
        >
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
    marginRight: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    fontWeight: '600',
  },
});
