/**
 * AssetTurboList Component
 * Displays list of sent Turbo tokens in the Asset Detail screen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import PropTypes from 'prop-types';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatTransactionDate } from '../../utils/transactionFormatters';
import globalStyles from '../../styles';
import {
  getSentLockedTokens,
  deleteSentLockedToken,
  generateTurboDeeplink,
} from '../../services/cashu/cashuLockedTokensService';
import { decodeToken } from '../../services/cashu/cashuCrypto';
import { checkProofsSpent } from '../../services/cashu/cashuMintClient';
import { useNotifications } from '../../contexts/NotificationContext';
import { useWallet } from '../../contexts/WalletContext';

export function AssetTurboList({ navigation }) {
  const [tokens, setTokens] = useState([]);
  const [claimedTokens, setClaimedTokens] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useNotifications();
  const { wallet } = useWallet();

  const loadTokens = async () => {
    try {
      setIsLoading(true);
      console.log('[AssetTurboList] Loading tokens for address:', wallet?.taprootAddress);
      // Filter tokens by current account's taproot address
      const savedTokens = await getSentLockedTokens(wallet?.taprootAddress);
      console.log('[AssetTurboList] Loaded tokens:', savedTokens.length);
      console.log('[AssetTurboList] Token details:', savedTokens.map(t => ({
        id: t.id,
        address: t.taprootAddress,
        amount: t.amount
      })));
      setTokens(savedTokens);

      // Check which tokens have been claimed
      await checkTokensClaimed(savedTokens);
    } catch (error) {
      console.error('[AssetTurboList] Failed to load tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkTokensClaimed = async (tokensList) => {
    const claimed = new Set();

    for (const tokenData of tokensList) {
      try {
        const decoded = decodeToken(tokenData.token);
        const result = await checkProofsSpent(decoded.proofs);

        // If any proof is spent, the token has been claimed
        if (result && result.states && Array.isArray(result.states)) {
          const isSpent = result.states.some(state => state.state === 'SPENT');
          if (isSpent) {
            claimed.add(tokenData.id);
          }
        }
      } catch (error) {
        console.error('[AssetTurboList] Failed to check token:', error);
      }
    }

    setClaimedTokens(claimed);
  };

  useEffect(() => {
    console.log('[AssetTurboList] useEffect triggered, wallet address:', wallet?.taprootAddress);
    if (wallet?.taprootAddress) {
      loadTokens();
    }
  }, [wallet?.taprootAddress]);

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
      console.error('[AssetTurboList] Failed to share token:', error);
    }
  };

  const handleCopyToken = async (tokenRecord) => {
    try {
      // Copy the raw Cashu token to clipboard
      await Clipboard.setStringAsync(tokenRecord.token);
      showToast('Cashu token copied to clipboard', 'success');
    } catch (error) {
      console.error('[AssetTurboList] Failed to copy token:', error);
      showToast('Failed to copy token to clipboard', 'error');
    }
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
              console.error('[AssetTurboList] Failed to delete token:', error);
              Alert.alert('Error', 'Failed to delete token');
            }
          },
        },
      ]
    );
  };

  const renderToken = (item) => {
    const isClaimed = claimedTokens.has(item.id);
    const statusChipStyle = isClaimed ? localStyles.claimedChip : localStyles.activeChip;
    const statusTextStyle = isClaimed ? localStyles.claimedChipText : localStyles.activeChipText;
    const amountColor = isClaimed ? '#DDDDDD' : COLORS.GREEN;

    return (
      <TouchableOpacity
        style={globalStyles.historyTxRow}
        onPress={() => handleCopyToken(item)}
        activeOpacity={0.7}
      >
        {/* Turbo Logo */}
        <View style={localStyles.assetLogo}>
          <Icon name="turbo" size={40} color="#DDDDDD" />
        </View>

        {/* Main Content Container */}
        <View style={localStyles.txContentContainer}>
          {/* First Row: Turbo label on left, Status + Amount on right */}
          <View style={globalStyles.historyTxTopRow}>
            <View style={globalStyles.historyTxColumn1}>
              <Text style={[globalStyles.historyTxAmount, localStyles.actionText]}>
                Turbo
              </Text>
            </View>
            <View style={globalStyles.historyTxRightGroup}>
              <View style={globalStyles.historyTxColumn2}>
                <View style={[globalStyles.vaultAmountChip, statusChipStyle]}>
                  <Text style={[globalStyles.vaultAmountChipText, statusTextStyle]}>
                    {isClaimed ? 'Claimed' : 'Active'}
                  </Text>
                </View>
              </View>
              <View style={globalStyles.historyTxColumn3}>
                <View style={globalStyles.balanceWithIcon}>
                  <Icon
                    name="unit_symbol"
                    size={12}
                    color={amountColor}
                    style={globalStyles.assetAmountIcon}
                  />
                  <Text style={[globalStyles.assetAmount, { color: amountColor }]}>
                    {(item.amount / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {/* Second Row: Date */}
          <View style={globalStyles.historyTxBottomRow}>
            <Text style={globalStyles.historyTxDate}>
              {formatTransactionDate(Math.floor(item.timestamp / 1000))}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading spinner while checking token states
  if (isLoading) {
    return (
      <View style={localStyles.activityContainer}>
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
          <Text style={localStyles.loadingText}>Checking token status...</Text>
        </View>
      </View>
    );
  }

  if (tokens.length === 0) {
    return (
      <View style={localStyles.activityContainer}>
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>No Turbo tokens sent</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={localStyles.activityContainer}>
      {tokens.map((item) => (
        <View key={item.id}>
          {renderToken(item)}
        </View>
      ))}
    </View>
  );
}

AssetTurboList.propTypes = {
  navigation: PropTypes.object.isRequired,
};

const localStyles = StyleSheet.create({
  assetLogo: {
    marginRight: 10,
  },
  txContentContainer: {
    flex: 1,
  },
  actionText: {
    color: '#DDDDDD',
  },
  activeChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  activeChipText: {
    color: COLORS.GREEN,
  },
  claimedChip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
    marginLeft: 0,
  },
  claimedChipText: {
    color: COLORS.PRIMARY_BLUE,
  },
  activityContainer: {
    paddingHorizontal: 4,
    paddingBottom: 5,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    color: '#DDDDDD',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    color: '#DDDDDD',
    fontSize: 16,
  },
});
