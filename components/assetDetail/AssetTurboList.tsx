/**
 * AssetTurboList Component
 * Displays list of sent Turbo tokens in the Asset Detail screen
 * Uses responsive scaling with s() and sf() functions
 */

import * as Clipboard from 'expo-clipboard';
import React,{ memo,useCallback,useEffect,useState } from 'react';
import { ActivityIndicator,Modal,StyleSheet as RNStyleSheet,Share,Text,TouchableOpacity,View } from 'react-native';

import { useWallet } from '../../contexts/WalletContext';
import { useResponsive } from '../../hooks/useResponsive';
import {
getSentLockedTokens,
} from '../../services/cashu/cashuLockedTokensService';
import { checkProofsSpent, decodeToken } from '../../services/cashu/cashuWalletService';
import { useNotifications } from '../../stores/notificationStore';
import globalStyles from '../../styles';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { COLORS } from '../../theme';
import { truncateAddress } from '../../utils/formatters/addresses';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { logger } from '../../utils/logger';
import Icon from '../icons';

interface TokenRecord {
  id: string;
  token: string;
  amount: number;
  timestamp: number;
  taprootAddress?: string | null;
  shortUrl?: string | null;
  recipient?: string | null;
}

interface TurboTokenItemProps {
  item: TokenRecord;
  isClaimed: boolean;
  isSelfClaim: boolean;
  onCopy: (tokenRecord: TokenRecord) => void;
}

// Memoized token item component to prevent unnecessary re-renders
const TurboTokenItem = memo(function TurboTokenItem({ item, isClaimed, isSelfClaim, onCopy }: TurboTokenItemProps) {
  const { s } = useResponsive();

  // Determine status and styling based on claim state
  const getStatusConfig = () => {
    if (isSelfClaim) {
      return {
        chipBgColor: 'rgba(89, 170, 138, 0.2)',
        chipBorderColor: 'transparent',
        chipBorderWidth: 0,
        textColor: COLORS.GREEN,
        statusText: 'Self Claim',
        amountColor: COLORS.GREEN,
      };
    }
    if (isClaimed) {
      return {
        chipBgColor: 'transparent',
        chipBorderColor: COLORS.PRIMARY_BLUE,
        chipBorderWidth: 1,
        textColor: COLORS.PRIMARY_BLUE,
        statusText: 'Claimed',
        amountColor: '#DDDDDD',
      };
    }
    return {
      chipBgColor: 'rgba(89, 170, 138, 0.2)',
      chipBorderColor: 'transparent',
      chipBorderWidth: 0,
      textColor: COLORS.GREEN,
      statusText: 'Active',
      amountColor: COLORS.GREEN,
    };
  };

  const { chipBgColor, chipBorderColor, chipBorderWidth, textColor, statusText, amountColor } = getStatusConfig();

  return (
    <TouchableOpacity
      style={globalStyles.historyTxRow}
      onPress={() => onCopy(item)}
      activeOpacity={0.7}
    >
      <View style={{ marginRight: s(10) }}>
        <Icon name="turbo" size={s(40)} color="#DDDDDD" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={globalStyles.historyTxTopRow}>
          <View style={globalStyles.historyTxColumn1}>
            <Text style={[globalStyles.historyTxAmount, { color: '#DDDDDD' }]}>
              Turbo
            </Text>
          </View>
          <View style={globalStyles.historyTxRightGroup}>
            <View style={globalStyles.historyTxColumn2}>
              <View style={[globalStyles.vaultAmountChip, {
                backgroundColor: chipBgColor,
                borderColor: chipBorderColor,
                borderWidth: chipBorderWidth,
                marginLeft: 0,
              }]}>
                <Text style={[globalStyles.vaultAmountChipText, { color: textColor }]}>
                  {statusText}
                </Text>
              </View>
            </View>
            <View style={globalStyles.historyTxColumn3}>
              <View style={globalStyles.balanceWithIcon}>
                <Icon
                  name="unit_symbol"
                  size={s(12)}
                  color={amountColor}
                  style={globalStyles.assetAmountIcon}
                />
                <Text style={[globalStyles.assetAmount, { color: amountColor }]}>
                  {formatUnitAmount(item.amount)}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={globalStyles.historyTxBottomRow}>
          <Text style={globalStyles.historyTxDate}>
            {formatTransactionDate(Math.floor(item.timestamp / 1000))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.isClaimed === next.isClaimed && prev.isSelfClaim === next.isSelfClaim);

export function AssetTurboList() {
  const { s, sf } = useResponsive();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [claimedTokens, setClaimedTokens] = useState(new Set<string>());
  const [selfClaimTokens, setSelfClaimTokens] = useState(new Set<string>());
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useNotifications();
  const { wallet } = useWallet();

  const checkTokensClaimed = useCallback(async (tokensList: TokenRecord[], currentTaprootAddress?: string) => {
    const claimed = new Set<string>();
    const selfClaim = new Set<string>();

    // Check all tokens in parallel for much faster loading
    const results = await Promise.all(
      tokensList.map(async (tokenData) => {
        try {
          const decoded = decodeToken(tokenData.token);
          const result = await checkProofsSpent(decoded.proofs);

          if (result && result.states && Array.isArray(result.states)) {
            const isSpent = (result.states as Array<{ state: string }>).some(
              (state) => state.state === 'SPENT'
            );
            return { id: tokenData.id, isSpent, taprootAddress: tokenData.taprootAddress };
          }
          return { id: tokenData.id, isSpent: false, taprootAddress: tokenData.taprootAddress };
        } catch (error: unknown) {
          logger.error(error, { component: 'AssetTurboList', action: 'checkTokensClaimed' });
          return { id: tokenData.id, isSpent: false, taprootAddress: tokenData.taprootAddress };
        }
      })
    );

    // Process results
    for (const { id, isSpent, taprootAddress } of results) {
      if (isSpent) {
        claimed.add(id);
        // Check if this is a self-claim (token sent from current account and claimed)
        if (taprootAddress && currentTaprootAddress && taprootAddress === currentTaprootAddress) {
          selfClaim.add(id);
        }
      }
    }

    setClaimedTokens(claimed);
    setSelfClaimTokens(selfClaim);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.debug('AssetTurboList', 'Loading tokens for address', { address: wallet?.taprootAddress });
      const savedTokens = await getSentLockedTokens(wallet?.taprootAddress);
      logger.debug('AssetTurboList', 'Loaded tokens', { count: savedTokens.length });
      setTokens(savedTokens as TokenRecord[]);
      await checkTokensClaimed(savedTokens as TokenRecord[], wallet?.taprootAddress ?? undefined);
    } catch (error: unknown) {
      logger.error(error, { component: 'AssetTurboList', action: 'loadTokens' });
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.taprootAddress, checkTokensClaimed]);

  useEffect(() => {
    logger.debug('AssetTurboList', 'useEffect triggered', { address: wallet?.taprootAddress });
    if (wallet?.taprootAddress) {
      loadTokens();
    }
  }, [wallet?.taprootAddress, loadTokens]);

  // Poll for claimed status updates every 5 seconds
  useEffect(() => {
    if (!wallet?.taprootAddress || tokens.length === 0) {
      return;
    }

    // Only poll if there are unclaimed tokens
    const hasUnclaimedTokens = tokens.some(t => !claimedTokens.has(t.id));
    if (!hasUnclaimedTokens) {
      return;
    }

    const pollInterval = setInterval(() => {
      logger.debug('AssetTurboList', 'Polling for claimed status updates');
      checkTokensClaimed(tokens, wallet.taprootAddress);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [wallet?.taprootAddress, tokens, claimedTokens, checkTokensClaimed]);

  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);

  const handleTokenPress = useCallback((tokenRecord: TokenRecord) => {
    setSelectedToken(tokenRecord);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!selectedToken) return;
    try {
      const textToCopy = selectedToken.shortUrl || selectedToken.token;
      await Clipboard.setStringAsync(textToCopy);
      showToast(selectedToken.shortUrl ? 'Link copied' : 'Token copied', 'success');
    } catch (error: unknown) {
      logger.error(error, { component: 'AssetTurboList', action: 'handleCopyLink' });
      showToast('Failed to copy', 'error');
    }
  }, [selectedToken, showToast]);

  const handleShare = useCallback(async () => {
    if (!selectedToken) return;
    try {
      const shareUrl = selectedToken.shortUrl || selectedToken.token;
      await Share.share({
        message: shareUrl,
      });
    } catch (error: unknown) {
      logger.error(error, { component: 'AssetTurboList', action: 'handleShare' });
    }
  }, [selectedToken]);

  // Show loading spinner while checking token states
  if (isLoading) {
    return (
      <View style={{
        paddingHorizontal: s(24),
        paddingBottom: s(5),
      }}>
        <View style={{
          alignItems: 'center',
          paddingVertical: s(20),
          gap: s(12),
        }}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
          <Text style={{
            color: '#DDDDDD',
            fontSize: sf(14),
          }}>Checking token status...</Text>
        </View>
      </View>
    );
  }

  if (tokens.length === 0) {
    return (
      <View style={{
        paddingHorizontal: s(24),
        paddingBottom: s(5),
      }}>
        <View style={{
          alignItems: 'center',
          paddingVertical: s(12),
        }}>
          <Text style={{
            color: '#DDDDDD',
            fontSize: sf(16),
          }}>No Turbo tokens sent</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      paddingHorizontal: s(24),
      paddingBottom: s(5),
    }}>
      {tokens.map((item) => (
        <TurboTokenItem
          key={item.id}
          item={item}
          isClaimed={claimedTokens.has(item.id)}
          isSelfClaim={selfClaimTokens.has(item.id)}
          onCopy={handleTokenPress}
        />
      ))}

      {/* Token Detail Modal */}
      {selectedToken && (
        <Modal
          visible={!!selectedToken}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedToken(null)}
        >
          <TouchableOpacity
            style={detailStyles.overlay}
            activeOpacity={1}
            onPress={() => setSelectedToken(null)}
          >
            <View style={[detailStyles.modal, { borderRadius: s(radii.xl), padding: s(spacing.xl) }]}>
              {/* Header */}
              <View style={detailStyles.header}>
                <Icon name="turbo" size={s(40)} color="#DDDDDD" />
                <Text style={[detailStyles.title, { fontSize: sf(fontSizes.lg), marginLeft: s(12) }]}>
                  Turbo UNIT
                </Text>
              </View>

              {/* Amount */}
              <View style={[detailStyles.row, { marginTop: s(spacing.lg) }]}>
                <Text style={[detailStyles.label, { fontSize: sf(fontSizes.sm) }]}>Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="unit_symbol" size={s(12)} color={COLORS.GREEN} style={{ marginRight: s(4) }} />
                  <Text style={[detailStyles.value, { fontSize: sf(fontSizes.md), color: COLORS.GREEN }]}>
                    {formatUnitAmount(selectedToken.amount)}
                  </Text>
                </View>
              </View>

              {/* Recipient */}
              {selectedToken.recipient && (
                <View style={[detailStyles.row, { marginTop: s(spacing.sm) }]}>
                  <Text style={[detailStyles.label, { fontSize: sf(fontSizes.sm) }]}>Recipient</Text>
                  <Text style={[detailStyles.value, { fontSize: sf(fontSizes.sm) }]}>
                    {truncateAddress(selectedToken.recipient)}
                  </Text>
                </View>
              )}

              {/* Date */}
              <View style={[detailStyles.row, { marginTop: s(spacing.sm) }]}>
                <Text style={[detailStyles.label, { fontSize: sf(fontSizes.sm) }]}>Date</Text>
                <Text style={[detailStyles.value, { fontSize: sf(fontSizes.sm) }]}>
                  {formatTransactionDate(Math.floor(selectedToken.timestamp / 1000))}
                </Text>
              </View>

              {/* Status */}
              <View style={[detailStyles.row, { marginTop: s(spacing.sm) }]}>
                <Text style={[detailStyles.label, { fontSize: sf(fontSizes.sm) }]}>Status</Text>
                <Text style={[detailStyles.value, {
                  fontSize: sf(fontSizes.sm),
                  color: claimedTokens.has(selectedToken.id) ? COLORS.PRIMARY_BLUE : COLORS.GREEN,
                }]}>
                  {selfClaimTokens.has(selectedToken.id) ? 'Self Claim' : claimedTokens.has(selectedToken.id) ? 'Claimed' : 'Active'}
                </Text>
              </View>

              {/* Link */}
              {selectedToken.shortUrl && (
                <View style={[detailStyles.linkContainer, { marginTop: s(spacing.lg), borderRadius: s(radii.md), padding: s(spacing.md) }]}>
                  <Text style={[detailStyles.linkText, { fontSize: sf(fontSizes.sm) }]} numberOfLines={2}>
                    {selectedToken.shortUrl}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={[detailStyles.buttons, { marginTop: s(spacing.lg), gap: s(12) }]}>
                <TouchableOpacity
                  style={[detailStyles.button, detailStyles.shareBtn, { paddingVertical: s(14), borderRadius: s(radii.lg) }]}
                  onPress={handleShare}
                >
                  <Icon name="share" size={s(16)} color={COLORS.PRIMARY_BLUE} />
                  <Text style={[detailStyles.shareBtnText, { fontSize: sf(fontSizes.md), marginLeft: s(8) }]}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[detailStyles.button, detailStyles.copyBtn, { paddingVertical: s(14), borderRadius: s(radii.lg) }]}
                  onPress={handleCopyLink}
                >
                  <Icon name="copy" size={s(16)} color={colors.text.primary} />
                  <Text style={[detailStyles.copyBtnText, { fontSize: sf(fontSizes.md), marginLeft: s(8) }]}>
                    {selectedToken.shortUrl ? 'Copy Link' : 'Copy Token'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Close */}
              <TouchableOpacity
                style={[detailStyles.closeBtn, { marginTop: s(spacing.md), paddingVertical: s(12) }]}
                onPress={() => setSelectedToken(null)}
              >
                <Text style={[detailStyles.closeBtnText, { fontSize: sf(fontSizes.md) }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const detailStyles = RNStyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.bg.secondary,
    width: '88%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  value: {
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  linkContainer: {
    backgroundColor: colors.bg.tertiary,
  },
  linkText: {
    fontFamily: fonts.regular,
    color: COLORS.PRIMARY_BLUE,
  },
  buttons: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  shareBtnText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: COLORS.PRIMARY_BLUE,
  },
  copyBtn: {
    backgroundColor: colors.bg.tertiary,
  },
  copyBtnText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  closeBtn: {
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
});
