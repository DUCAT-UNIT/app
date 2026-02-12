/**
 * TransactionItem Component
 * Displays a single transaction in the history list
 */

import React, { memo } from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import VaultTransactionItem from './VaultTransactionItem';
import EcashTransactionItem from './EcashTransactionItem';
import RegularTransactionItem from './RegularTransactionItem';
import type { DisplayAssetType, VaultAction, VaultTransactionData } from '../../types/assets';
import type { TransactionStatus } from '../../types/transaction';
import type { TransactionOutput } from '../../services/transactionHistoryService';

export interface TransactionItemStyles {
  historyTxRow: ViewStyle;
  historyTxTopRow: ViewStyle;
  historyTxBottomRow: ViewStyle;
  historyTxColumn1: ViewStyle;
  historyTxColumn2: ViewStyle;
  historyTxColumn3: ViewStyle;
  historyTxRightGroup: ViewStyle;
  historyTxAmount: TextStyle;
  historyTxDate: TextStyle;
  vaultAmountChip: ViewStyle;
  vaultAmountChipText: TextStyle;
  balanceWithIcon: ViewStyle;
  assetAmountIcon: ViewStyle;
  assetAmount: TextStyle;
  logoSize?: number;
}

interface TransactionData {
  amount: number | bigint;
  assetType: DisplayAssetType;
  isSent: boolean;
  isReceived: boolean;
}



// Union type for all transaction types
export interface BaseTransaction {
  txid: string;
  timestamp?: number;
  status: TransactionStatus;
}

export interface VaultTransaction extends BaseTransaction {
  vaultTransaction: true;
  vaultData: VaultTransactionData;
  ecashToken?: never;
  txData?: never;
}

export interface EcashTokenTransaction extends BaseTransaction {
  ecashToken: true;
  claimed?: boolean;
  partiallySpent?: boolean;
  timestamp: number;
  txData: {
    amount: number;
  };
  vaultTransaction?: never;
  vaultData?: never;
}

export interface RegularTransaction extends BaseTransaction {
  txData: TransactionData;
  vout?: TransactionOutput[];
  vaultTransaction?: false;
  ecashToken?: false;
  vaultData?: never;
}

export type Transaction = VaultTransaction | EcashTokenTransaction | RegularTransaction;

export interface TransactionItemProps {
  tx: Transaction;
  styles: TransactionItemStyles;
  onPress: () => void;
  advancedMode?: boolean;
}

function isVaultTransaction(tx: Transaction): tx is VaultTransaction {
  return tx.vaultTransaction === true;
}

function isEcashTransaction(tx: Transaction): tx is EcashTokenTransaction {
  return tx.ecashToken === true;
}

function TransactionItem({ tx, styles, onPress, advancedMode = false }: TransactionItemProps) {
  if (isVaultTransaction(tx)) {
    return <VaultTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  if (isEcashTransaction(tx)) {
    return <EcashTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  return <RegularTransactionItem tx={tx} styles={styles} onPress={onPress} advancedMode={advancedMode} />;
}

export default memo(TransactionItem, (prev: TransactionItemProps, next: TransactionItemProps) => {
  // Note: onPress is intentionally excluded from comparison.
  // The callback identity may change due to parent re-renders,
  // but we only need to re-render when the actual transaction data changes.
  return (
    prev.tx.txid === next.tx.txid &&
    prev.tx.status?.confirmed === next.tx.status?.confirmed &&
    prev.advancedMode === next.advancedMode
  );
});
