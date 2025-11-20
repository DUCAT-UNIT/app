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
  Alert,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { encodeCashuToken } from '../../utils/emojiEncoder';

export default function SpectreQRCodeScreen({ navigation, route }) {
  const { deeplink, amount, recipient, timestamp } = route.params;
  const [showEmoji, setShowEmoji] = useState(true);

  // Extract token from deeplink and encode to emoji
  const emojiToken = useMemo(() => {
    try {
      // Pass deeplink directly - encodeCashuToken will handle extraction
      return encodeCashuToken(deeplink);
    } catch (error) {
      console.error('[SpectreQRCode] Failed to encode token:', error);
      return null;
    }
  }, [deeplink]);

  const displayContent = showEmoji ? emojiToken : deeplink;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(displayContent);
    Alert.alert('Copied', showEmoji ? 'Emoji token copied to clipboard' : 'Deeplink copied to clipboard');
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

  const formatDate = (ts) => {
    const date = new Date(ts);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 16)}...${address.substring(address.length - 16)}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spectre Token</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Icon name="share" size={24} color={COLORS.BRAND_PURPLE} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Amount */}
        <View style={styles.amountContainer}>
          <Icon name="spectre" size={32} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.amountText}>{amount / 100} UNIT</Text>
        </View>

        {/* Format Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !showEmoji && styles.toggleButtonActive]}
            onPress={() => setShowEmoji(false)}
          >
            <Text style={[styles.toggleText, !showEmoji && styles.toggleTextActive]}>Link</Text>
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
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText} selectable>
                {emojiToken}
              </Text>
            </View>
            <Text style={styles.emojiHint}>
              Share these emojis to send the token! Much shorter than a link.
            </Text>
          </>
        ) : (
          <>
            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCode
                value={deeplink}
                size={250}
                color={COLORS.VERY_LIGHT_GRAY}
                backgroundColor={COLORS.MID_DARK_GRAY}
              />
            </View>

            {/* Info */}
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Recipient</Text>
                <Text style={styles.infoValue}>{formatAddress(recipient)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{formatDate(timestamp)}</Text>
              </View>
            </View>
          </>
        )}

        {/* Copy Button */}
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
          <Icon name="copy" size={20} color={COLORS.VERY_LIGHT_GRAY} />
          <Text style={styles.copyButtonText}>
            {showEmoji ? 'Copy Emoji Token' : 'Copy Deeplink'}
          </Text>
        </TouchableOpacity>

        {/* Warning */}
        <View style={styles.warningContainer}>
          <Icon name="warning" size={16} color={COLORS.BURNT_ORANGE} />
          <Text style={styles.warningText}>
            Anyone with this {showEmoji ? 'emoji token' : 'QR code or link'} can claim the tokens
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.BRAND_PURPLE,
  },
  qrContainer: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    padding: 30,
    borderRadius: 20,
    marginBottom: 40,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.MID_GRAY,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'monospace',
    maxWidth: '65%',
  },
  copyButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 20,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.BRAND_PURPLE,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.MID_GRAY,
  },
  toggleTextActive: {
    color: COLORS.VERY_LIGHT_GRAY,
  },
  emojiContainer: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 32,
    lineHeight: 48,
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'center',
  },
  emojiHint: {
    fontSize: 14,
    color: COLORS.MID_GRAY,
    textAlign: 'center',
    marginBottom: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.BURNT_ORANGE,
  },
});
