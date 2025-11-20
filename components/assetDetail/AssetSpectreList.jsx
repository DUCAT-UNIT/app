/**
 * AssetSpectreList Component
 * Displays list of sent Spectre tokens in the Asset Detail screen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatTransactionDate } from '../../utils/transactionFormatters';
import globalStyles from '../../styles';
import {
  getSentLockedTokens,
  deleteSentLockedToken,
  generateSpectreDeeplink,
} from '../../services/cashu/cashuLockedTokensService';
import { decodeToken } from '../../services/cashu/cashuCrypto';
import { checkProofsSpent } from '../../services/cashu/cashuMintClient';

export function AssetSpectreList({ navigation }) {
  const [tokens, setTokens] = useState([]);
  const [claimedTokens, setClaimedTokens] = useState(new Set());

  const loadTokens = async () => {
    try {
      const savedTokens = await getSentLockedTokens();
      setTokens(savedTokens);

      // Check which tokens have been claimed
      await checkTokensClaimed(savedTokens);
    } catch (error) {
      console.error('[AssetSpectreList] Failed to load tokens:', error);
    }
  };

  const checkTokensClaimed = async (tokensList) => {
    const claimed = new Set();

    for (const tokenData of tokensList) {
      try {
        const decoded = decodeToken(tokenData.token);
        const result = await checkProofsSpent(decoded.proofs);

        // If any proof is spent, the token has been claimed
        const isSpent = result.states.some(state => state.state === 'SPENT');
        if (isSpent) {
          claimed.add(tokenData.id);
        }
      } catch (error) {
        console.error('[AssetSpectreList] Failed to check token:', error);
      }
    }

    setClaimedTokens(claimed);
  };

  useEffect(() => {
    loadTokens();
  }, []);

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
      console.error('[AssetSpectreList] Failed to share token:', error);
    }
  };

  const handleViewQR = (tokenRecord) => {
    const deeplink = generateSpectreDeeplink(
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
              console.error('[AssetSpectreList] Failed to delete token:', error);
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
        onPress={() => handleViewQR(item)}
        activeOpacity={0.7}
      >
        {/* Spectre Logo */}
        <View style={localStyles.assetLogo}>
          <Icon name="spectre" size={40} color="#DDDDDD" />
        </View>

        {/* Main Content Container */}
        <View style={localStyles.txContentContainer}>
          {/* First Row: Spectre label on left, Status + Amount on right */}
          <View style={globalStyles.historyTxTopRow}>
            <View style={globalStyles.historyTxColumn1}>
              <Text style={[globalStyles.historyTxAmount, localStyles.actionText]}>
                Spectre
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

  if (tokens.length === 0) {
    return (
      <View style={localStyles.activityContainer}>
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>No Spectre tokens sent</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={localStyles.activityContainer}>
      {tokens.map((item) => renderToken(item))}
    </View>
  );
}

AssetSpectreList.propTypes = {
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    color: '#DDDDDD',
    fontSize: 16,
  },
});
