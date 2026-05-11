/**
 * TokenDetailsSheet Component
 * Bottom sheet showing ecash token details with copy and share options
 */

import * as Clipboard from 'expo-clipboard';
import React from 'react';
import {
Linking,
Share,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { COLORS } from '../../theme';
import { truncateAddress } from '../../utils/formatters/addresses';
import BottomSheet from '../common/BottomSheet';
import Icon from '../icons';
import {
  cashuUnitDisplayName,
  DEFAULT_CASHU_UNIT,
  type CashuUnit,
} from '../../services/cashu/cashuUnits';

interface TokenDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  recipientAddress?: string;
  shortUrl?: string | null;
  cashuToken: string;
  onCopy?: (message: string) => void;
  advancedMode?: boolean;
  claimed?: boolean;
  isSelfClaim?: boolean;
  cashuUnit?: CashuUnit;
}

export default function TokenDetailsSheet({
  visible,
  onClose,
  recipientAddress,
  shortUrl,
  cashuToken,
  onCopy,
  claimed = false,
  isSelfClaim = false,
  cashuUnit = DEFAULT_CASHU_UNIT,
}: TokenDetailsSheetProps) {
  const tokenLabel = cashuUnitDisplayName(cashuUnit);
  const isBtcCashu = cashuUnit === 'sat';
  const hasShortUrl = Boolean(shortUrl);
  const shareValue = shortUrl || cashuToken;
  const handleCopyToken = async () => {
    await Clipboard.setStringAsync(shareValue);
    onCopy?.(hasShortUrl ? 'Short URL copied' : 'Token copied');
  };

  const handleOpenInSafari = () => {
    if (shortUrl) {
      Linking.openURL(shortUrl);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: shareValue,
      });
    } catch (error: unknown) {
      // Silently fail
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Header with custom content */}
      <View style={styles.customHeader}>
        <View style={styles.headerContent}>
          <Icon name={isBtcCashu ? 'btc_logo' : 'unit_logo'} size={24} color={COLORS.PRIMARY_BLUE} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{tokenLabel}</Text>
            <Text style={styles.subtitle}>
              {recipientAddress
                ? `Bound to address: ${truncateAddress(recipientAddress, 5, 5)}`
                : 'Anyone can claim'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={24} color={COLORS.WHITE} />
        </TouchableOpacity>
      </View>

      {/* Token Card or Claimed/Self-Claim Warning */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{hasShortUrl ? 'Shortened URL' : 'Cashu Token'}</Text>
        {isSelfClaim ? (
          <View style={styles.selfClaimCard}>
            <Icon name="check" size={20} color={COLORS.GREEN} />
            <Text style={styles.selfClaimText}>Self Claim</Text>
          </View>
        ) : claimed ? (
          <View style={styles.warningCard}>
            <Icon name="check" size={20} color={COLORS.YELLOW} />
            <Text style={styles.warningText}>Token already claimed</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardContent}
              onPress={handleCopyToken}
              activeOpacity={0.7}
            >
              <Text style={styles.cardText} numberOfLines={1}>
                {shareValue}
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
              {hasShortUrl && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleOpenInSafari}
                  activeOpacity={0.7}
                >
                  <Icon name="external_link" size={20} color={COLORS.PRIMARY_BLUE} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={COLORS.SECONDARY_TEXT} />
        <Text style={styles.infoText}>
          Share this token to send {tokenLabel}. The recipient can claim it from the {hasShortUrl ? 'link' : 'token'}.
        </Text>
      </View>
    </BottomSheet>
  );
}


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
  selfClaimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(89, 170, 138, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.GREEN,
  },
  selfClaimText: {
    fontSize: 14,
    color: COLORS.GREEN,
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
