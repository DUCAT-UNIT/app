/**
 * AssetTurboList Component
 * Displays list of sent Turbo tokens in the Asset Detail screen
 * Uses responsive scaling with s() and sf() functions
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatTransactionDate } from '../../utils/formatters/dates';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import globalStyles from '../../styles';
import { useResponsive } from '../../hooks/useResponsive';
import {
  getSentLockedTokens,
} from '../../services/cashu/cashuLockedTokensService';
import { decodeToken } from '../../services/cashu/crypto';
import { checkProofsSpent } from '../../services/cashu/cashuMintClient';
import { useNotifications } from '../../stores/notificationStore';
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
  const { s, sf } = useResponsive();

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
          onCopy={handleCopyToken}
        />
      ))}
    </View>
  );
}
