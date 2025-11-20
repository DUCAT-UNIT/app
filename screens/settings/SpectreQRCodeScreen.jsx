/**
 * SpectreQRCodeScreen - Display QR code for a Spectre token
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { encodeCashuToken } from '../../utils/emojiEncoder';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;

// Calculate QR code size based on screen width
const QR_SIZE =
  SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default function SpectreQRCodeScreen({ navigation, route }) {
  const { deeplink, amount, recipient, timestamp } = route.params;
  const [showEmoji, setShowEmoji] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Extract token from deeplink and encode to emoji
  const emojiToken = useMemo(() => {
    try {
      return encodeCashuToken(deeplink);
    } catch (error) {
      console.error('[SpectreQRCode] Failed to encode token:', error);
      return null;
    }
  }, [deeplink]);

  const displayContent = showEmoji ? emojiToken : deeplink;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(displayContent);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: showEmoji
          ? `Spectre Token 👻\n\nAmount: ${amount / 100} UNIT\n\n${emojiToken}`
          : `Spectre Token\n\nAmount: ${amount / 100} UNIT\nLink: ${deeplink}`,
        url: showEmoji ? undefined : deeplink,
      });
    } catch (error) {
      console.error('[SpectreQRCode] Failed to share:', error);
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
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Spectre Token</Text>
          </View>
        </View>

        {/* Amount subtitle */}
        <Text style={styles.subtitle}>
          {amount / 100} UNIT
        </Text>

        {/* Format Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !showEmoji && styles.toggleButtonActive]}
            onPress={() => setShowEmoji(false)}
          >
            <Text style={[styles.toggleText, !showEmoji && styles.toggleTextActive]}>QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showEmoji && styles.toggleButtonActive]}
            onPress={() => setShowEmoji(true)}
          >
            <Text style={[styles.toggleText, showEmoji && styles.toggleTextActive]}>Emoji</Text>
          </TouchableOpacity>
        </View>

        {showEmoji ? (
          <>
            {/* Emoji Token Display */}
            <View style={styles.emojiQRContainer}>
              <Text style={styles.emojiText} selectable>
                {emojiToken}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* QR Code */}
            <View style={styles.qrCodeContainer}>
              <QRCode
                value={deeplink}
                size={QR_SIZE}
                backgroundColor="white"
                color="black"
                logo={require('../../assets/icons/spectre.svg')}
                logoSize={LOGO_SIZE}
                logoBackgroundColor="white"
                logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
              />
            </View>
          </>
        )}

        {/* Content container - tap to copy */}
        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          <View style={styles.addressContentContainer}>
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>
                {showEmoji ? 'Emoji Token' : 'Deeplink'}
              </Text>
              <Text style={styles.tapToCopyText}>
                {justCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </View>
            <Text style={styles.addressFullText} numberOfLines={showEmoji ? undefined : 2}>
              {displayContent}
            </Text>
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
    marginBottom: SCREEN_WIDTH <= 400 ? 16 : 24,
    textAlign: 'center',
  },
  toggleContainer: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 4,
    marginBottom: SCREEN_WIDTH < 375 ? 16 : 24,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.PURPLE,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  toggleTextActive: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
  qrCodeContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SCREEN_WIDTH < 375 ? 10 : 20,
    borderRadius: 16,
    marginBottom: SCREEN_WIDTH < 375 ? 12 : 32,
  },
  emojiQRContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SCREEN_WIDTH < 375 ? 16 : 24,
    borderRadius: 16,
    marginBottom: SCREEN_WIDTH < 375 ? 12 : 32,
    minHeight: QR_SIZE + 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 28,
    lineHeight: 42,
    color: COLORS.DARK_BG,
    textAlign: 'center',
    fontWeight: '600',
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
    fontSize: 14,
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
