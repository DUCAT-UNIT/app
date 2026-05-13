/**
 * TransactionDetailsSheet Component
 * Bottom sheet showing transaction details for regular BTC/UNIT transactions
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import BottomSheet from '../common/BottomSheet';
import { formatBalance, formatUnitAmount, formatFiat } from '../../utils/formatters';
import { getTxUrl, getOrdTxUrl } from '../../utils/constants';
import { usePrice } from '../../stores/priceStore';
import type { DisplayAssetType } from '../../types/assets';
import { EVM_CONFIG } from '../../constants/evm';

interface TransactionData {
  amount: number | bigint;
  assetType: DisplayAssetType;
  isSent: boolean;
  isReceived: boolean;
  displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
}

interface TransactionDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  txid: string | null;
  timestamp?: number;
  confirmed: boolean;
  txData: TransactionData | null;
  fee?: number;
}

// Format date
const formatDate = (timestamp: number | undefined): string => {
  if (!timestamp) return 'Pending';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format txid for display (truncated)
const formatTxid = (txid: string): string => {
  if (txid.length <= 16) return txid;
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
};

// Get action label
const getActionLabel = (txData: TransactionData): string => {
  if (txData.displayKind === 'turbo_mint_claim') return 'Claimed TurboUNIT';
  if (txData.displayKind === 'turbo_redeem') return 'Received';
  if (txData.isSent && txData.isReceived) return 'Self Transfer';
  return txData.isSent ? 'Sent' : 'Received';
};

// Get action description
const getActionDescription = (txData: TransactionData): string => {
  const numericAmount = typeof txData.amount === 'bigint' ? Number(txData.amount) : txData.amount;
  const absAmount = Math.abs(numericAmount);

  if (txData.assetType === 'UNIT') {
    const formatted = formatUnitAmount(absAmount);
    if (txData.displayKind === 'turbo_mint_claim') return `Claimed ${formatted} TurboUNIT`;
    if (txData.displayKind === 'turbo_redeem') return `Received ${formatted}`;
    if (txData.isSent && txData.isReceived) return `Moved ${formatted} UNIT to self`;
    return txData.isSent ? `Sent ${formatted} UNIT` : `Received ${formatted} UNIT`;
  } else if (txData.assetType === 'USDC') {
    const formatted = formatFiat(absAmount, 2);
    if (txData.isSent && txData.isReceived) return `Moved $${formatted} Sepolia USDC to self`;
    return txData.isSent ? `Sent $${formatted} Sepolia USDC` : `Received $${formatted} Sepolia USDC`;
  } else if (txData.assetType === 'ETH') {
    const formatted = formatBalance(absAmount, 6);
    if (txData.isSent && txData.isReceived) return `Moved ${formatted} Sepolia ETH to self`;
    return txData.isSent ? `Sent ${formatted} Sepolia ETH` : `Received ${formatted} Sepolia ETH`;
  } else {
    const formatted = formatBalance(absAmount / 100_000_000);
    if (txData.isSent && txData.isReceived) return `Moved ${formatted} BTC to self`;
    return txData.isSent ? `Sent ${formatted} BTC` : `Received ${formatted} BTC`;
  }
};

interface DetailRowProps {
  label: string;
  value: string;
  valueColor?: string;
  icon?: string;
  onPress?: () => void;
}

function DetailRow({ label, value, valueColor = COLORS.WHITE, icon, onPress }: DetailRowProps) {
  const content = (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueContainer}>
        {icon && (
          <Icon
            name={icon as 'btc_symbol' | 'unit_symbol' | 'usdc_logo' | 'eth_logo'}
            size={icon === 'usdc_logo' || icon === 'eth_logo' ? 16 : 14}
            color={valueColor}
            style={styles.valueIcon}
          />
        )}
        <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
        {onPress && <Icon name="external_link" size={14} color={COLORS.PRIMARY_BLUE} style={styles.linkIcon} />}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function TransactionDetailsSheet({
  visible,
  onClose,
  txid,
  timestamp,
  confirmed,
  txData,
  fee,
}: TransactionDetailsSheetProps) {
  const { btcPrice, ethPrice } = usePrice();

  // Calculate values
  const details = useMemo(() => {
    if (!txData || !txid) return null;

    const numericAmount = typeof txData.amount === 'bigint' ? Number(txData.amount) : txData.amount;
    const absAmount = Math.abs(numericAmount);

    // Format amount based on asset type
    const formattedAmount = txData.assetType === 'UNIT'
      ? formatUnitAmount(absAmount)
      : txData.assetType === 'USDC'
        ? formatFiat(absAmount, 2)
        : txData.assetType === 'ETH'
          ? formatBalance(absAmount, 6)
          : formatBalance(absAmount / 100_000_000);

    // Calculate USD value for priced assets
    let usdValue: string | null = null;
    if (txData.assetType === 'BTC' && btcPrice) {
      const btcAmount = absAmount / 100_000_000;
      usdValue = formatFiat(btcAmount * btcPrice, 2);
    } else if (txData.assetType === 'ETH' && ethPrice) {
      usdValue = formatFiat(absAmount * ethPrice, 2);
    }

    // Format fee if available
    let formattedFee: string | null = null;
    if (fee && fee > 0) {
      formattedFee = `${fee.toLocaleString()} sats`;
    }

    return {
      actionLabel: getActionLabel(txData),
      actionDescription: getActionDescription(txData),
      formattedAmount,
      usdValue,
      formattedFee,
      assetType: txData.assetType,
      isSent: txData.isSent,
      isReceived: txData.isReceived,
      isTurboMintClaim: txData.displayKind === 'turbo_mint_claim',
    };
  }, [txData, txid, btcPrice, ethPrice, fee]);

  // Open in explorer
  const openInExplorer = useCallback(async () => {
    if (!txid || !details) return;
    try {
      const url = details.assetType === 'UNIT'
        ? getOrdTxUrl(txid)
        : details.assetType === 'USDC' || details.assetType === 'ETH'
          ? `${EVM_CONFIG.explorerBaseUrl}/tx/${txid}`
          : getTxUrl(txid);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silently fail
    }
  }, [txid, details]);

  if (!details || !txid) return null;

  const isSelfTransfer = details.isSent && details.isReceived;
  const isPositiveAction = details.isTurboMintClaim || (details.isReceived && !details.isSent);
  const amountColor = isSelfTransfer ? COLORS.WHITE : isPositiveAction ? COLORS.GREEN : COLORS.RED;
  const summaryBorderColor = isSelfTransfer ? COLORS.BORDER_COLOR : isPositiveAction ? COLORS.GREEN : COLORS.RED;
  const amountPrefix = isSelfTransfer ? '' : details.isSent ? '-' : '+';

  return (
    <BottomSheet visible={visible} onClose={onClose} showCloseButton={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Icon
            name={details.assetType === 'UNIT' ? 'unit_logo' : details.assetType === 'USDC' ? 'usdc_logo' : details.assetType === 'ETH' ? 'eth_logo' : 'btc_logo'}
            size={32}
          />
          <View style={styles.headerText}>
            <Text style={styles.title}>{details.actionLabel}</Text>
            <Text style={styles.subtitle}>{formatDate(timestamp)}</Text>
          </View>
        </View>
      </View>

      {/* Action Summary */}
      <View style={styles.summarySection}>
        <View style={[styles.summaryCard, { borderColor: summaryBorderColor }]}>
          {details.assetType === 'USDC' ? (
            <Text style={[styles.summaryAmount, { color: amountColor }]}>
              {amountPrefix}${details.formattedAmount}
            </Text>
          ) : details.assetType === 'ETH' ? (
            <Text style={[styles.summaryAmount, { color: amountColor }]}>
              {amountPrefix}{details.formattedAmount} ETH
            </Text>
          ) : (
            <View style={styles.summaryAmountRow}>
              <Icon
                name={details.assetType === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                size={20}
                color={amountColor}
              />
              <Text style={[styles.summaryAmount, { color: amountColor }]}>
                {amountPrefix}{details.formattedAmount}
              </Text>
            </View>
          )}
          {details.usdValue && (
            <Text style={styles.summaryUsd}>≈ ${details.usdValue} USD</Text>
          )}
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Transaction Details</Text>

        {/* Status */}
        <DetailRow
          label="Status"
          value={confirmed ? 'Confirmed' : 'Pending'}
          valueColor={confirmed ? COLORS.GREEN : COLORS.YELLOW}
        />

        {/* Asset Type */}
        <DetailRow
          label="Asset"
          value={details.isTurboMintClaim ? 'TurboUNIT' : details.assetType === 'UNIT' ? 'UNIT' : details.assetType === 'USDC' ? 'Sepolia USDC' : details.assetType === 'ETH' ? 'Sepolia ETH' : 'Bitcoin'}
          icon={details.assetType === 'UNIT' ? 'unit_symbol' : details.assetType === 'USDC' ? 'usdc_logo' : details.assetType === 'ETH' ? 'eth_logo' : 'btc_symbol'}
        />

        {/* Network Fee (if available) */}
        {details.formattedFee && (
          <DetailRow
            label="Network Fee"
            value={details.formattedFee}
          />
        )}

        {/* Transaction ID */}
        <DetailRow
          label="Transaction ID"
          value={formatTxid(txid)}
          valueColor={COLORS.PRIMARY_BLUE}
          onPress={openInExplorer}
        />
      </View>

      {/* View in Explorer Button */}
      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.explorerButton} onPress={openInExplorer} activeOpacity={0.7}>
          <Text style={styles.explorerButtonText}>View in Explorer</Text>
          <Icon name="external_link" size={16} color={COLORS.PRIMARY_BLUE} />
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginTop: -10,
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
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 4,
  },
  summarySection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  summaryUsd: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 4,
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueIcon: {
    marginRight: 6,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkIcon: {
    marginLeft: 6,
  },
  buttonSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  explorerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
  },
});
