/**
 * AssetTurboList Component
 * Displays list of sent Turbo tokens in the Asset Detail screen
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatTransactionDate } from '../../utils/formatters/dates';
import globalStyles from '../../styles';
import {
  getSentLockedTokens,
} from '../../services/cashu/cashuLockedTokensService';
import { decodeToken } from '../../services/cashu/crypto';
import { checkProofsSpent } from '../../services/cashu/cashuMintClient';
import { useNotifications } from '../../contexts/NotificationContext';
import { useWallet } from '../../contexts/WalletContext';
import { logger } from '../../utils/logger';

interface TokenRecord {
  id: string;
  token: string;
  amount: number;
  timestamp: number;
}

interface TurboTokenItemProps {
  item: TokenRecord;
  isClaimed: boolean;
  onCopy: (tokenRecord: TokenRecord) => Promise<void>;
}

// Memoized token item component to prevent unnecessary re-renders
const TurboTokenItem = memo(function TurboTokenItem({ item, isClaimed, onCopy }: TurboTokenItemProps) {
  const statusChipStyle = isClaimed ? localStyles.claimedChip : localStyles.activeChip;
  const statusTextStyle = isClaimed ? localStyles.claimedChipText : localStyles.activeChipText;
  const amountColor = isClaimed ? '#DDDDDD' : COLORS.GREEN;

  return (
    <TouchableOpacity
      style={globalStyles.historyTxRow}
      onPress={() => onCopy(item)}
      activeOpacity={0.7}
    >
      <View style={localStyles.assetLogo}>
        <Icon name="turbo" size={40} color="#DDDDDD" />
      </View>
      <View style={localStyles.txContentContainer}>
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
        <View style={globalStyles.historyTxBottomRow}>
          <Text style={globalStyles.historyTxDate}>
            {formatTransactionDate(Math.floor(item.timestamp / 1000))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.isClaimed === next.isClaimed);

export function AssetTurboList() {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [claimedTokens, setClaimedTokens] = useState(new Set<string>());
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useNotifications();
  const { wallet } = useWallet();

  const checkTokensClaimed = useCallback(async (tokensList: TokenRecord[]) => {
    const claimed = new Set<string>();

    for (const tokenData of tokensList) {
      try {
        const decoded = decodeToken(tokenData.token);
        const result = await checkProofsSpent(decoded.proofs);

        if (result && result.states && Array.isArray(result.states)) {
          const isSpent = (result.states as Array<{ state: string }>).some(
            (state) => state.state === 'SPENT'
          );
          if (isSpent) {
            claimed.add(tokenData.id);
          }
        }
      } catch (error) {
        logger.error(error, { component: 'AssetTurboList', action: 'checkTokensClaimed' });
      }
    }

    setClaimedTokens(claimed);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.debug('AssetTurboList', 'Loading tokens for address', { address: wallet?.taprootAddress });
      const savedTokens = await getSentLockedTokens(wallet?.taprootAddress);
      logger.debug('AssetTurboList', 'Loaded tokens', { count: savedTokens.length });
      setTokens(savedTokens as TokenRecord[]);
      await checkTokensClaimed(savedTokens as TokenRecord[]);
    } catch (error) {
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

  const handleCopyToken = useCallback(async (tokenRecord: TokenRecord) => {
    try {
      await Clipboard.setStringAsync(tokenRecord.token);
      showToast('Cashu token copied to clipboard', 'success');
    } catch (error) {
      logger.error(error, { component: 'AssetTurboList', action: 'handleCopyToken' });
      showToast('Failed to copy token to clipboard', 'error');
    }
  }, [showToast]);

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
        <TurboTokenItem
          key={item.id}
          item={item}
          isClaimed={claimedTokens.has(item.id)}
          onCopy={handleCopyToken}
        />
      ))}
    </View>
  );
}

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
