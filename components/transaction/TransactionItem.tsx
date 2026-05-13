/**
 * TransactionItem Component
 * Displays a single transaction in the history list
 */

import React,{ memo } from 'react';
import { TextStyle,ViewStyle } from 'react-native';
import type { TransactionOutput } from '../../services/transactionHistoryService';
import type { DisplayAssetType,VaultTransactionData } from '../../types/assets';
import type { TransactionStatus } from '../../types/transaction';
import EcashTransactionItem from './EcashTransactionItem';
import RegularTransactionItem from './RegularTransactionItem';
import VaultTransactionItem from './VaultTransactionItem';

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
  displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
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
  pendingRedeem?: boolean;
  tokenData?: {
    amount?: number;
    unit?: string;
    shortUrl?: string | null;
    pendingRedeem?: boolean;
  };
  timestamp: number;
  txData: {
    amount: number;
    assetType?: DisplayAssetType;
    isSent?: boolean;
    isReceived?: boolean;
    displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
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

function getStatusFailed(tx: Transaction): boolean | undefined {
  return (tx.status as TransactionStatus & { failed?: boolean })?.failed;
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
  const prevEcash = isEcashTransaction(prev.tx) ? prev.tx : null;
  const nextEcash = isEcashTransaction(next.tx) ? next.tx : null;

  return (
    prev.tx.txid === next.tx.txid &&
    prev.tx.timestamp === next.tx.timestamp &&
    prev.tx.status?.confirmed === next.tx.status?.confirmed &&
    getStatusFailed(prev.tx) === getStatusFailed(next.tx) &&
    prev.tx.txData?.displayKind === next.tx.txData?.displayKind &&
    prev.tx.txData?.amount === next.tx.txData?.amount &&
    prev.tx.txData?.assetType === next.tx.txData?.assetType &&
    prev.tx.txData?.isSent === next.tx.txData?.isSent &&
    prev.tx.txData?.isReceived === next.tx.txData?.isReceived &&
    prevEcash?.claimed === nextEcash?.claimed &&
    prevEcash?.partiallySpent === nextEcash?.partiallySpent &&
    prevEcash?.pendingRedeem === nextEcash?.pendingRedeem &&
    prevEcash?.tokenData?.pendingRedeem === nextEcash?.tokenData?.pendingRedeem &&
    prevEcash?.tokenData?.unit === nextEcash?.tokenData?.unit &&
    prevEcash?.tokenData?.amount === nextEcash?.tokenData?.amount &&
    prevEcash?.tokenData?.shortUrl === nextEcash?.tokenData?.shortUrl &&
    prev.advancedMode === next.advancedMode
  );
});
