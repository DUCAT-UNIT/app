/**
 * TurboHistoryScreen - View all sent Turbo (P2PK locked) tokens
 * Shows history of locked tokens with ability to regenerate deeplinks/QR codes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { getSentLockedTokens, deleteSentLockedToken, generateTurboDeeplink, TokenRecord } from '../../services/cashu/cashuLockedTokensService';
import { truncateAddress } from '../../utils/formatters/addresses';
import { logger } from '../../utils/logger';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import { useNotifications } from '../../contexts/NotificationContext';
import { useWallet } from '../../contexts/WalletContext';
import styles from './TurboHistoryScreen.styles';

/**
 * Extended token record with shortUrl for display
 */
type TokenRecordWithShortUrl = TokenRecord & {
  shortUrl?: string;
};

/**
 * Props for TokenCard component
 */
interface TokenCardProps {
  item: TokenRecord;
  onPress: (item: TokenRecord) => void;
  onDelete: (item: TokenRecord) => void;
  onViewQR: (item: TokenRecord) => void;
  onShare: (item: TokenRecord) => void;
  formatDate: (timestamp: number) => string;
  formatAddress: (address: string | undefined | null) => string;
  index: number;
}

/**
 * Props for TurboHistoryScreen
 */
interface TurboHistoryScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

// Token card component
function TokenCard({ item, onPress, onDelete, onViewQR, onShare, formatDate, formatAddress, index }: TokenCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.tokenCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      testID={`turbo-history-item-${index}`}
    >
      <View style={styles.tokenHeader}>
        <View style={styles.tokenInfo}>
          <Text style={styles.amountText}>{item.amount / 100} UNIT</Text>
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(item);
          }}
        >
          <Icon name="trash" size={20} color={COLORS.DANGER_RED} />
        </TouchableOpacity>
      </View>

      <View style={styles.recipientRow}>
        <Icon name="wallet" size={16} color={COLORS.MID_GRAY} />
        <Text style={styles.recipientText}>{formatAddress(item.recipient)}</Text>
      </View>

      {item.txid && (
        <View style={styles.txidRow}>
          <Icon name="btc_symbol" size={14} color={COLORS.MID_GRAY} />
          <Text style={styles.txidText}>{formatAddress(item.txid)}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableScale
          style={styles.actionButton}
          onPress={() => onViewQR(item)}
        >
          <Icon name="qr" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>QR Code</Text>
        </TouchableScale>

        <TouchableScale
          style={styles.actionButton}
          onPress={() => onShare(item)}
        >
          <Icon name="share" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableScale>
      </View>
    </TouchableOpacity>
  );
}

export default function TurboHistoryScreen({ navigation }: TurboHistoryScreenProps): React.JSX.Element {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenRecordWithShortUrl | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const { showToast } = useNotifications();
  const { wallet } = useWallet();

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      const sentTokens = await getSentLockedTokens(wallet?.taprootAddress);
      setTokens(sentTokens);
    } catch (error) {
      logger.error('[TurboHistory] Failed to load tokens:', { error: error instanceof Error ? error.message : String(error) });
      Alert.alert('Error', 'Failed to load Turbo history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [wallet?.taprootAddress]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTokens();
  };

  const handleShareToken = useCallback(async (tokenRecord: TokenRecord): Promise<void> => {
    try {
      const deeplink = await generateTurboDeeplink(
        tokenRecord.token,
        tokenRecord.recipient,
        tokenRecord.amount
      );

      await Share.share({
        message: `Turbo Token\n\nAmount: ${tokenRecord.amount / 100} UNIT\nLink: ${deeplink}`,
        url: deeplink,
      });
    } catch (error) {
      logger.error('[TurboHistory] Failed to share token:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const handleViewQR = useCallback(async (tokenRecord: TokenRecord): Promise<void> => {
    const deeplink = await generateTurboDeeplink(
      tokenRecord.token,
      tokenRecord.recipient,
      tokenRecord.amount
    );

    navigation.navigate('TurboQRCode', {
      deeplink,
      amount: tokenRecord.amount,
      recipient: tokenRecord.recipient,
      timestamp: tokenRecord.timestamp,
    });
  }, [navigation]);

  const handleDeleteToken = useCallback((tokenRecord: TokenRecord): void => {
    Alert.alert(
      'Delete Token',
      'Are you sure you want to remove this token from history? The recipient can still claim it if they have the link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSentLockedToken(tokenRecord.id);
              loadTokens();
            } catch (error) {
              logger.error('[TurboHistory] Failed to delete token:', { error: error instanceof Error ? error.message : String(error) });
              Alert.alert('Error', 'Failed to delete token');
            }
          },
        },
      ]
    );
  }, [loadTokens]);

  const handleTokenPress = useCallback(async (tokenRecord: TokenRecord): Promise<void> => {
    let shortUrl = tokenRecord.shortUrl;
    if (!shortUrl) {
      try {
        shortUrl = await generateTurboDeeplink(
          tokenRecord.token,
          tokenRecord.recipient,
          tokenRecord.amount
        );
      } catch (error) {
        logger.error('[TurboHistory] Failed to generate deeplink:', { error: error instanceof Error ? error.message : String(error) });
        showToast('Failed to load token details', 'error');
        return;
      }
    }

    setSelectedToken({ ...tokenRecord, shortUrl });
    setShowTokenDetails(true);
  }, [showToast]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (address: string | undefined | null): string => {
    if (!address) return 'Unknown';
    return truncateAddress(address, 12, 8);
  };

  const renderToken = useCallback(({ item, index }: { item: TokenRecord; index: number }): React.JSX.Element => (
    <TokenCard
      item={item}
      index={index}
      onPress={handleTokenPress}
      onDelete={handleDeleteToken}
      onViewQR={handleViewQR}
      onShare={handleShareToken}
      formatDate={formatDate}
      formatAddress={formatAddress}
    />
  ), [handleTokenPress, handleDeleteToken, handleViewQR, handleShareToken]);

  const keyExtractor = useCallback((item: TokenRecord): string => item.id, []);

  if (loading) {
    return (
      <View style={styles.container} testID="turbo-history-screen">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="turbo-history-back-btn">
            <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Turbo History</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.BRAND_PURPLE} testID="turbo-history-loading" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="turbo-history-screen">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="turbo-history-back-btn">
          <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Turbo History</Text>
        <View style={styles.placeholder} />
      </View>

      {tokens.length === 0 ? (
        <View style={styles.centerContainer} testID="turbo-history-empty">
          <Icon name="turbo" size={64} color={COLORS.MID_GRAY} />
          <Text style={styles.emptyText}>No Turbo tokens sent yet</Text>
          <Text style={styles.emptySubtext}>Locked tokens you send will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={tokens}
          renderItem={renderToken}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          testID="turbo-history-list"
        />
      )}

      {selectedToken && (
        <TokenDetailsSheet
          visible={showTokenDetails}
          onClose={() => setShowTokenDetails(false)}
          recipientAddress={selectedToken.recipient}
          shortUrl={selectedToken.shortUrl}
          cashuToken={selectedToken.token}
          onCopy={(msg) => showToast(msg, 'success')}
          advancedMode={true}
          claimed={selectedToken.claimed}
        />
      )}
    </View>
  );
}
