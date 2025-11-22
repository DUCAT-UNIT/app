/**
 * TokenDetailsSheet Component
 * Bottom sheet showing ecash token details with copy and share options
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import PropTypes from 'prop-types';
import { COLORS } from '../../theme';
import Icon from '../icons';

export default function TokenDetailsSheet({
  visible,
  onClose,
  recipientAddress,
  shortUrl,
  cashuToken,
  onCopy,
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

  // Truncate token for display
  const truncatedToken = cashuToken.length > 50
    ? `${cashuToken.substring(0, 25)}...${cashuToken.substring(cashuToken.length - 25)}`
    : cashuToken;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Icon name="unit_logo" size={24} color={COLORS.PRIMARY_BLUE} />
              <View style={styles.headerText}>
                <Text style={styles.title}>Ecash Token</Text>
                <Text style={styles.subtitle}>
                  {recipientAddress ? `Bound to ${recipientAddress.slice(0, 5)}...` : 'Anyone can claim'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
          </View>

          {/* Shortened URL Card */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Shortened URL</Text>
            <TouchableOpacity
              style={styles.card}
              onPress={handleCopyShortUrl}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <Icon name="link" size={20} color={COLORS.PRIMARY_BLUE} />
                <Text style={styles.cardText} numberOfLines={1}>
                  {shortUrl}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenInSafari}
                activeOpacity={0.7}
              >
                <Icon name="external_link" size={20} color={COLORS.PRIMARY_BLUE} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Base64 Token Card */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Cashu Token</Text>
            <TouchableOpacity
              style={styles.card}
              onPress={handleCopyToken}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <Icon name="copy" size={20} color={COLORS.PRIMARY_BLUE} />
                <Text style={styles.cardText} numberOfLines={2}>
                  {truncatedToken}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Icon name="info" size={16} color={COLORS.SECONDARY_TEXT} />
            <Text style={styles.infoText}>
              Share this token to send ecash. The recipient can claim it by opening the link.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

TokenDetailsSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  recipientAddress: PropTypes.string,
  shortUrl: PropTypes.string.isRequired,
  cashuToken: PropTypes.string.isRequired,
  onCopy: PropTypes.func,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  actionButton: {
    padding: 8,
    marginLeft: 8,
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
