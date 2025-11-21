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
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;

export default function SpectreQRCodeScreen({ navigation, route }) {
  const { deeplink, amount } = route.params;
  const [justCopied, setJustCopied] = useState(false);

  // Extract emoji token from deeplink
  const emojiToken = useMemo(() => {
    try {
      // New format: ducat://unit?👻 (emoji directly after ?)
      if (deeplink.includes('unit?')) {
        const queryStart = deeplink.indexOf('unit?') + 5;
        return deeplink.substring(queryStart);
      }

      // Old format fallback: ducat://spectre?token=👻
      const url = new URL(deeplink);
      const token = url.searchParams.get('token');
      if (!token) {
        throw new Error('No token parameter found in deeplink');
      }
      return decodeURIComponent(token);
    } catch (error) {
      console.error('[SpectreQRCode] Failed to extract emoji token:', error);
      return null;
    }
  }, [deeplink]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(deeplink);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Spectre Token 👻\n\nAmount: ${amount / 100} UNIT\n\nTap to claim:\n${deeplink}\n\nOr copy this ghost:\n${emojiToken}`,
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

        {/* Emoji Token Display - Ghost emoji with encoded data */}
        <View style={styles.emojiQRContainer}>
          <Text style={styles.emojiText} selectable>
            {emojiToken}
          </Text>
          <Text style={styles.emojiHint}>
            Tap the ghost to copy
          </Text>
        </View>

        {/* Deeplink - tap to copy */}
        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          <View style={styles.addressContentContainer}>
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>
                Deeplink
              </Text>
              <Text style={styles.tapToCopyText}>
                {justCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </View>
            <Text style={styles.addressFullText} numberOfLines={3}>
              {deeplink}
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
  emojiQRContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SCREEN_WIDTH < 375 ? 20 : 32,
    borderRadius: 16,
    marginBottom: SCREEN_WIDTH < 375 ? 12 : 32,
    minHeight: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 64,
    lineHeight: 80,
    color: COLORS.DARK_BG,
    textAlign: 'center',
  },
  emojiHint: {
    fontSize: 12,
    color: COLORS.DARK_BG,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.6,
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
  deeplinkContainer: {
    width: '100%',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: SCREEN_WIDTH < 375 ? 12 : 16,
    marginBottom: SCREEN_WIDTH < 375 ? 16 : 32,
  },
  deeplinkLabel: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
    marginBottom: 8,
  },
  deeplinkText: {
    fontSize: 13,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 18,
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
