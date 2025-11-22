/**
 * TokenDetailsSheet Component
 * Bottom sheet showing ecash token details with copy and share options
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import PropTypes from 'prop-types';
import { COLORS } from '../../theme';
import Icon from '../icons';
import BottomSheet from '../common/BottomSheet';

export default function TokenDetailsSheet({
  visible,
  onClose,
  recipientAddress,
  shortUrl,
  cashuToken,
  onCopy,
  advancedMode = false,
  claimed = false,
}) {
  const handleCopyShortUrl = async () => {
    await Clipboard.setStringAsync(shortUrl);
    onCopy?.('Short URL copied');
  };

  const handleCopyToken = async () => {
    await Clipboard.setStringAsync(cashuToken);
    onCopy?.('Token copied');
  };

  const handleOpenInSafari = () => {
    Linking.openURL(shortUrl);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: shortUrl,
      });
    } catch (error) {
      // Silently fail
    }
  };

  // Truncate token for display
  const truncatedToken = cashuToken.length > 50
    ? `${cashuToken.substring(0, 25)}...${cashuToken.substring(cashuToken.length - 25)}`
    : cashuToken;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Header with custom content */}
      <View style={styles.customHeader}>
        <View style={styles.headerContent}>
          <Icon name="unit_logo" size={24} color={COLORS.PRIMARY_BLUE} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Ecash Token</Text>
            <Text style={styles.subtitle}>
              {recipientAddress
                ? `Bound to address: ${recipientAddress.slice(0, 5)}...${recipientAddress.slice(-5)}`
                : 'Anyone can claim'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={24} color={COLORS.WHITE} />
        </TouchableOpacity>
      </View>

      {/* Shortened URL Card or Claimed Warning */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Shortened URL</Text>
        {claimed ? (
          <View style={styles.warningCard}>
            <Icon name="check" size={20} color={COLORS.YELLOW} />
            <Text style={styles.warningText}>Token already claimed</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardContent}
              onPress={handleCopyShortUrl}
              activeOpacity={0.7}
            >
              <Text style={styles.cardText} numberOfLines={1}>
                {shortUrl}
              </Text>
            </TouchableOpacity>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Icon name="share" size={20} color={COLORS.PRIMARY_BLUE} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenInSafari}
                activeOpacity={0.7}
              >
                <Icon name="external_link" size={20} color={COLORS.PRIMARY_BLUE} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Base64 Token Card - Only show in advanced mode */}
      {advancedMode && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cashu Token</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardContent}
              onPress={handleCopyToken}
              activeOpacity={0.7}
            >
              <Text style={styles.cardText} numberOfLines={2}>
                {truncatedToken}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCopyToken}
              activeOpacity={0.7}
            >
              <Icon name="copy" size={20} color={COLORS.PRIMARY_BLUE} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={COLORS.SECONDARY_TEXT} />
        <Text style={styles.infoText}>
          Share this token to send ecash. The recipient can claim it by opening the link.
        </Text>
      </View>
    </BottomSheet>
  );
}

TokenDetailsSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  recipientAddress: PropTypes.string,
  shortUrl: PropTypes.string.isRequired,
  cashuToken: PropTypes.string.isRequired,
  onCopy: PropTypes.func,
  advancedMode: PropTypes.bool,
  claimed: PropTypes.bool,
};

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
    marginTop: -50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 4,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'CabinetGrotesk-Medium',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Regular',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.YELLOW,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.YELLOW,
    fontFamily: 'CabinetGrotesk-Medium',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 24,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
