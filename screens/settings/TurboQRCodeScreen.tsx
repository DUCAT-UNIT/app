/**
 * TurboQRCodeScreen - Display QR code for a Turbo token
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { logger } from '../../utils/logger';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;

/**
 * Route parameters for TurboQRCodeScreen
 */
interface TurboQRCodeRouteParams {
  deeplink: string;
  amount: number;
  recipient?: string;
  timestamp?: number;
}

/**
 * Props for TurboQRCodeScreen
 */
interface TurboQRCodeScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: TurboQRCodeRouteParams }, 'params'>;
}

export default function TurboQRCodeScreen({ navigation, route }: TurboQRCodeScreenProps): React.JSX.Element {
  const { deeplink, amount } = route.params;
  const [justCopied, setJustCopied] = useState(false);

  // For short URLs, just display the ghost emoji as decoration
  // The actual token is in the base64 URL, but we show 👻 for visual appeal
  const displayEmoji = '👻';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(deeplink);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Turbo Token 👻\n\nAmount: ${formatUnitAmount(amount)} UNIT\n\nTap to claim:\n${deeplink}`,
      });
    } catch (error: unknown) {
      logger.error('[TurboQRCode] Failed to share:', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="turbo-qr-screen">
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} testID="turbo-qr-back-btn">
            <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Turbo Token</Text>
          </View>
        </View>

        {/* Amount subtitle */}
        <Text style={styles.subtitle} testID="turbo-qr-amount">
          {formatUnitAmount(amount)} UNIT
        </Text>

        {/* Emoji Token Display - Ghost emoji decoration */}
        <View style={styles.emojiQRContainer} testID="turbo-qr-emoji">
          <Text style={styles.emojiText} selectable>
            {displayEmoji}
          </Text>
          <Text style={styles.emojiHint}>
            Turbo Token
          </Text>
        </View>

        {/* Deeplink - tap to copy */}
        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleCopy}
          activeOpacity={0.7}
          testID="turbo-qr-copy-btn"
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
            <Text style={styles.addressFullText} numberOfLines={3} testID="turbo-qr-deeplink">
              {deeplink}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} testID="turbo-qr-share-btn">
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
