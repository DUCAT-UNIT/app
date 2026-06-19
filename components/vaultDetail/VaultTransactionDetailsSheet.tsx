/**
 * VaultTransactionDetailsSheet Component
 * Bottom sheet showing vault transaction details with before/after state changes
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import BottomSheet from '../common/BottomSheet';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { getOrdTxUrl } from '../../utils/constants';
import {
  formatVaultUsdFromSmallestUnits,
} from '../../utils/vaultFaceValue';
import type { VaultHistoryTransaction } from '../../services/vaultService';

const LIQUIDATION_RATE = 1.5;

interface VaultTransactionDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: VaultHistoryTransaction | null;
  previousTransaction: VaultHistoryTransaction | null;
}

// Calculate health percentage from vault state
const calculateHealth = (collateralBtc: number, debtCents: number, btcPrice: number): number => {
  if (debtCents <= 0 || collateralBtc <= 0) return 0;
  const collateralValue = collateralBtc * btcPrice;
  const debtValue = debtCents / 100;
  return Math.min((collateralValue / debtValue) * 100, 500);
};

// Calculate liquidation price
const calculateLiquidationPrice = (collateralBtc: number, debtCents: number): number => {
  if (collateralBtc <= 0 || debtCents <= 0) return 0;
  return (debtCents / 100 * LIQUIDATION_RATE) / collateralBtc;
};

// Get health color
const getHealthColor = (health: number): string => {
  if (health <= 160) return COLORS.RED;
  if (health <= 200) return '#fde37b';
  return COLORS.GREEN;
};

// Format action for display
const formatAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'open': 'Open Vault',
    'open_settled_to_usdc': 'Open Settled to Sepolia USDC',
    'borrow': 'Borrow Value',
    'borrow_settled_to_usdc': 'Borrow Settled to Sepolia USDC',
    'repay': 'Repay Value',
    'repay_from_usdc': 'Repay from Sepolia USDC',
    'deposit': 'Deposit BTC',
    'withdraw': 'Withdraw BTC',
    'liquidate': 'Liquidation',
    'repo': 'Liquidation',
    'trim': 'Liquidation',
  };
  return actionMap[action.toLowerCase()] || action;
};

// Get action description
const getActionDescription = (action: string, btcAmt: number, unitAmt: number): string => {
  const actionLower = action.toLowerCase();
  const btcFormatted = formatBalance(Math.abs(btcAmt) / 100_000_000);
  const debtFormatted = formatVaultUsdFromSmallestUnits(Math.abs(unitAmt));

  switch (actionLower) {
    case 'open':
      return `Opened vault with ${btcFormatted} BTC collateral`;
    case 'open_settled_to_usdc':
      return `Opened vault and settled ${debtFormatted} to Sepolia USDC`;
    case 'borrow':
      return `Borrowed ${debtFormatted} against BTC collateral`;
    case 'borrow_settled_to_usdc':
      return `Borrowed and settled ${debtFormatted} to Sepolia USDC`;
    case 'repay':
      return `Repaid ${debtFormatted} of vault debt`;
    case 'repay_from_usdc':
      return `Repaid ${debtFormatted} from Sepolia USDC settlement`;
    case 'deposit':
      return `Deposited ${btcFormatted} BTC`;
    case 'withdraw':
      return `Withdrew ${btcFormatted} BTC`;
    case 'liquidate':
    case 'repo':
    case 'trim':
      return 'Vault was liquidated';
    default:
      return action;
  }
};

// Format date
const formatDate = (timestamp: number): string => {
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

interface ChangeRowProps {
  label: string;
  beforeValue: string;
  afterValue: string;
  beforeColor?: string;
  afterColor?: string;
  icon?: string;
}

function ChangeRow({ label, beforeValue, afterValue, beforeColor = COLORS.SECONDARY_TEXT, afterColor = COLORS.WHITE, icon }: ChangeRowProps) {
  const hasChange = beforeValue !== afterValue;

  return (
    <View style={styles.changeRow}>
      <Text style={styles.changeLabel}>{label}</Text>
      <View style={styles.changeValues}>
        {hasChange && (
          <>
            <View style={styles.valueContainer}>
              {icon && <Icon name={icon as 'btc_symbol' | 'unit_symbol'} size={12} color={beforeColor} style={styles.valueIcon} />}
              <Text style={[styles.beforeValue, { color: beforeColor }]}>{beforeValue}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </>
        )}
        <View style={styles.valueContainer}>
          {icon && <Icon name={icon as 'btc_symbol' | 'unit_symbol'} size={12} color={afterColor} style={styles.valueIcon} />}
          <Text style={[styles.afterValue, { color: afterColor }]}>{afterValue}</Text>
        </View>
      </View>
    </View>
  );
}

export default function VaultTransactionDetailsSheet({
  visible,
  onClose,
  transaction,
  previousTransaction,
}: VaultTransactionDetailsSheetProps) {
  // Calculate before/after states
  const details = useMemo(() => {
    if (!transaction) return null;

    const oraclePrice = transaction.oracle_price;

    // After state (current transaction)
    const afterCollateral = transaction.vault_amount / 100_000_000;
    const afterDebt = transaction.amount_borrowed;
    const afterHealth = calculateHealth(afterCollateral, afterDebt, oraclePrice);
    const afterLiquidation = calculateLiquidationPrice(afterCollateral, afterDebt);

    // Before state (previous transaction or zero)
    let beforeCollateral = 0;
    let beforeDebt = 0;
    let beforeHealth = 0;
    let beforeLiquidation = 0;

    if (previousTransaction) {
      beforeCollateral = previousTransaction.vault_amount / 100_000_000;
      beforeDebt = previousTransaction.amount_borrowed;
      beforeHealth = calculateHealth(beforeCollateral, beforeDebt, oraclePrice);
      beforeLiquidation = calculateLiquidationPrice(beforeCollateral, beforeDebt);
    }

    // Calculate unit amount from debt change if unit_amt is 0
    let unitAmt = transaction.unit_amt;
    if (unitAmt === 0 && beforeDebt !== afterDebt) {
      unitAmt = Math.abs(beforeDebt - afterDebt);
    }

    return {
      action: transaction.action,
      btcAmt: transaction.btc_amt,
      unitAmt,
      oraclePrice,
      timestamp: transaction.timestamp,
      transactionId: transaction.transaction_id,
      before: {
        collateral: beforeCollateral,
        debt: beforeDebt,
        health: beforeHealth,
        liquidation: beforeLiquidation,
      },
      after: {
        collateral: afterCollateral,
        debt: afterDebt,
        health: afterHealth,
        liquidation: afterLiquidation,
      },
    };
  }, [transaction, previousTransaction]);

  // Open in explorer
  const openInExplorer = useCallback(async () => {
    if (!details?.transactionId) return;
    try {
      const url = getOrdTxUrl(details.transactionId);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silently fail
    }
  }, [details?.transactionId]);

  if (!details) return null;

  const actionLower = details.action.toLowerCase();
  const isPositiveAction = actionLower === 'deposit' || actionLower === 'repay';

  return (
    <BottomSheet visible={visible} onClose={onClose} showCloseButton={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Icon name="vault_logo" size={24} color="#DDDDDD" />
          <View style={styles.headerText}>
            <Text style={styles.title}>{formatAction(details.action)}</Text>
            <Text style={styles.subtitle}>{formatDate(details.timestamp)}</Text>
          </View>
        </View>
      </View>

      {/* Action Summary */}
      <View style={styles.summarySection}>
        <View style={[styles.summaryCard, { borderColor: isPositiveAction ? COLORS.GREEN : COLORS.RED }]}>
          <Text style={styles.summaryText}>
            {getActionDescription(details.action, details.btcAmt, details.unitAmt)}
          </Text>
          <Text style={styles.oraclePriceText}>
            Oracle Price: ${formatFiat(details.oraclePrice, 2)}
          </Text>
        </View>
      </View>

      {/* Changes Section */}
      <View style={styles.changesSection}>
        <Text style={styles.sectionTitle}>Vault Changes</Text>

        {/* Collateral Change */}
        <ChangeRow
          label="Collateral"
          beforeValue={formatBalance(details.before.collateral)}
          afterValue={formatBalance(details.after.collateral)}
          icon="btc_symbol"
          afterColor={details.after.collateral > details.before.collateral ? COLORS.GREEN : details.after.collateral < details.before.collateral ? COLORS.RED : COLORS.WHITE}
        />

        {/* Debt Change */}
        <ChangeRow
          label="Total Debt"
          beforeValue={formatVaultUsdFromSmallestUnits(details.before.debt)}
          afterValue={formatVaultUsdFromSmallestUnits(details.after.debt)}
          afterColor={details.after.debt < details.before.debt ? COLORS.GREEN : details.after.debt > details.before.debt ? COLORS.RED : COLORS.WHITE}
        />

        {/* Health Change */}
        <ChangeRow
          label="Health Ratio"
          beforeValue={details.before.health > 0 ? `${details.before.health.toFixed(0)}%` : 'N/A'}
          afterValue={details.after.health > 0 ? `${details.after.health.toFixed(0)}%` : 'N/A'}
          beforeColor={details.before.health > 0 ? getHealthColor(details.before.health) : COLORS.SECONDARY_TEXT}
          afterColor={details.after.health > 0 ? getHealthColor(details.after.health) : COLORS.SECONDARY_TEXT}
        />

        {/* Liquidation Price Change */}
        <ChangeRow
          label="Liquidation Price"
          beforeValue={details.before.liquidation > 0 ? `$${formatFiat(details.before.liquidation, 2)}` : '\u221E'}
          afterValue={details.after.liquidation > 0 ? `$${formatFiat(details.after.liquidation, 2)}` : '\u221E'}
          afterColor={details.after.liquidation < details.before.liquidation ? COLORS.GREEN : details.after.liquidation > details.before.liquidation ? COLORS.RED : COLORS.WHITE}
        />

        {/* Transaction ID */}
        {details.transactionId && (
          <TouchableOpacity style={styles.txIdRow} onPress={openInExplorer} activeOpacity={0.7}>
            <Text style={styles.changeLabel}>Transaction ID</Text>
            <View style={styles.txIdValueContainer}>
              <Text style={styles.txIdValue}>{formatTxid(details.transactionId)}</Text>
              <Icon name="external_link" size={14} color={COLORS.PRIMARY_BLUE} style={styles.linkIcon} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* View in Explorer Button */}
      {details.transactionId && (
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.explorerButton} onPress={openInExplorer} activeOpacity={0.7}>
            <Text style={styles.explorerButtonText}>View in Explorer</Text>
            <Icon name="external_link" size={16} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        </View>
      )}
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
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  oraclePriceText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  changesSection: {
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
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  changeLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    flex: 1,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueIcon: {
    marginRight: 4,
  },
  beforeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginHorizontal: 8,
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  txIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  txIdValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIdValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
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
