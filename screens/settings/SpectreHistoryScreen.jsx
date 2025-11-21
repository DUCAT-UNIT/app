/**
 * SpectreHistoryScreen - View all sent Spectre (P2PK locked) tokens
 * Shows history of locked tokens with ability to regenerate deeplinks/QR codes
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { getSentLockedTokens, deleteSentLockedToken, generateSpectreDeeplink } from '../../services/cashu/cashuLockedTokensService';

export default function SpectreHistoryScreen({ navigation }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const sentTokens = await getSentLockedTokens();
      setTokens(sentTokens);
    } catch (error) {
      console.error('[SpectreHistory] Failed to load tokens:', error);
      Alert.alert('Error', 'Failed to load Spectre history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTokens();
  };

  const handleShareToken = async (tokenRecord) => {
    try {
      const deeplink = generateSpectreDeeplink(
        tokenRecord.token,
        tokenRecord.recipient,
        tokenRecord.amount
      );

      await Share.share({
        message: `Spectre Token\n\nAmount: ${tokenRecord.amount / 100} UNIT\nLink: ${deeplink}`,
        url: deeplink,
      });
    } catch (error) {
      console.error('[SpectreHistory] Failed to share token:', error);
    }
  };

  const handleViewQR = async (tokenRecord) => {
    const deeplink = await generateSpectreDeeplink(
      tokenRecord.token,
      tokenRecord.recipient,
      tokenRecord.amount
    );

    navigation.navigate('SpectreQRCode', {
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
              console.error('[SpectreHistory] Failed to delete token:', error);
              Alert.alert('Error', 'Failed to delete token');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`;
  };

  const renderToken = ({ item }) => (
    <View style={styles.tokenCard}>
      <View style={styles.tokenHeader}>
        <View style={styles.tokenInfo}>
          <Text style={styles.amountText}>{item.amount / 100} UNIT</Text>
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteToken(item)}
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
          onPress={() => handleViewQR(item)}
        >
          <Icon name="qr" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>QR Code</Text>
        </TouchableScale>

        <TouchableScale
          style={styles.actionButton}
          onPress={() => handleShareToken(item)}
        >
          <Icon name="share" size={18} color={COLORS.BRAND_PURPLE} />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableScale>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Spectre History</Text>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow_left" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spectre History</Text>
        <View style={styles.placeholder} />
      </View>

      {tokens.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="spectre" size={64} color={COLORS.MID_GRAY} />
          <Text style={styles.emptyText}>No Spectre tokens sent yet</Text>
          <Text style={styles.emptySubtext}>
            Locked tokens you send will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={tokens}
          renderItem={renderToken}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.MID_GRAY,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tokenCard: {
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.BRAND_PURPLE,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.MID_GRAY,
  },
  deleteButton: {
    padding: 4,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipientText: {
    fontSize: 13,
    color: COLORS.LIGHT_GRAY,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  txidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  txidText: {
    fontSize: 12,
    color: COLORS.MID_GRAY,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.DARK_BACKGROUND,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.BRAND_PURPLE,
  },
});
