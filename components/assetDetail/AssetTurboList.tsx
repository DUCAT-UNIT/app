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
import { formatUnitAmount } from '../../utils/formatters/amounts';
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
  taprootAddress?: string | null;
}

interface TurboTokenItemProps {
  item: TokenRecord;
  isClaimed: boolean;
  isSelfClaim: boolean;
  onCopy: (tokenRecord: TokenRecord) => Promise<void>;
}

// Memoized token item component to prevent unnecessary re-renders
const TurboTokenItem = memo(function TurboTokenItem({ item, isClaimed, isSelfClaim, onCopy }: TurboTokenItemProps) {
  // Determine status and styling based on claim state
  const getStatusConfig = () => {
    if (isSelfClaim) {
      return {
        chipStyle: localStyles.selfClaimChip,
        textStyle: localStyles.selfClaimChipText,
        statusText: 'Self Claim',
        amountColor: COLORS.GREEN,
      };
    }
    if (isClaimed) {
      return {
        chipStyle: localStyles.claimedChip,
        textStyle: localStyles.claimedChipText,
        statusText: 'Claimed',
        amountColor: '#DDDDDD',
      };
    }
    return {
      chipStyle: localStyles.activeChip,
      textStyle: localStyles.activeChipText,
      statusText: 'Active',
      amountColor: COLORS.GREEN,
    };
  };

  const { chipStyle, textStyle, statusText, amountColor } = getStatusConfig();

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
              <View style={[globalStyles.vaultAmountChip, chipStyle]}>
                <Text style={[globalStyles.vaultAmountChipText, textStyle]}>
                  {statusText}
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

  const handleCopyToken = useCallback(async (tokenRecord: TokenRecord) => {
    try {
      await Clipboard.setStringAsync(tokenRecord.token);
      showToast('Cashu token copied to clipboard', 'success');
    } catch (error: unknown) {
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
          isSelfClaim={selfClaimTokens.has(item.id)}
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
  selfClaimChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    marginLeft: 0,
  },
  selfClaimChipText: {
    color: COLORS.GREEN,
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
