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
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { getSentLockedTokens, deleteSentLockedToken, generateTurboDeeplink } from '../../services/cashu/cashuLockedTokensService';
import { truncateAddress } from '../../utils/formatters/addresses';
import { logger } from '../../utils/logger';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import { useNotifications } from '../../contexts/NotificationContext';
import { useWallet } from '../../contexts/WalletContext';
import styles from './TurboHistoryScreen.styles';

// Token card component
function TokenCard({ item, onPress, onDelete, onViewQR, onShare, formatDate, formatAddress }) {
  return (
    <TouchableOpacity
      style={styles.tokenCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
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
          onPress={(e) => {
            e.stopPropagation();
            onViewQR(item);
          }}
        >
          <Icon name="qr" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>QR Code</Text>
        </TouchableScale>

        <TouchableScale
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onShare(item);
          }}
        >
          <Icon name="share" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableScale>
      </View>
    </TouchableOpacity>
  );
}

export default function TurboHistoryScreen({ navigation }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const { showToast } = useNotifications();
  const { wallet } = useWallet();

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      const sentTokens = await getSentLockedTokens(wallet?.taprootAddress);
      setTokens(sentTokens);
    } catch (error) {
      logger.error('[TurboHistory] Failed to load tokens:', error);
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

  const handleShareToken = async (tokenRecord) => {
    try {
      const deeplink = generateTurboDeeplink(
        tokenRecord.token,
        tokenRecord.recipient,
        tokenRecord.amount
      );

      await Share.share({
        message: `Turbo Token\n\nAmount: ${tokenRecord.amount / 100} UNIT\nLink: ${deeplink}`,
        url: deeplink,
      });
    } catch (error) {
      logger.error('[TurboHistory] Failed to share token:', error);
    }
  };

  const handleViewQR = async (tokenRecord) => {
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
  };

  const handleDeleteToken = (tokenRecord) => {
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
              logger.error('[TurboHistory] Failed to delete token:', error);
              Alert.alert('Error', 'Failed to delete token');
            }
          },
        },
      ]
    );
  };

  const handleTokenPress = async (tokenRecord) => {
    let shortUrl = tokenRecord.shortUrl;
    if (!shortUrl) {
      try {
        shortUrl = await generateTurboDeeplink(
          tokenRecord.token,
          tokenRecord.recipient,
          tokenRecord.amount
        );
      } catch (error) {
        logger.error('[TurboHistory] Failed to generate deeplink:', error);
        showToast('Failed to load token details', 'error');
        return;
      }
    }

    setSelectedToken({ ...tokenRecord, shortUrl });
    setShowTokenDetails(true);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return truncateAddress(address, 12, 8);
  };

  const renderToken = useCallback(({ item }) => (
    <TokenCard
      item={item}
      onPress={handleTokenPress}
      onDelete={handleDeleteToken}
      onViewQR={handleViewQR}
      onShare={handleShareToken}
      formatDate={formatDate}
      formatAddress={formatAddress}
    />
  ), [handleTokenPress, handleDeleteToken, handleViewQR, handleShareToken]);

  const keyExtractor = useCallback((item) => item.id, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Turbo History</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.BRAND_PURPLE} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Turbo History</Text>
        <View style={styles.placeholder} />
      </View>

      {tokens.length === 0 ? (
        <View style={styles.centerContainer}>
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
