/**
 * Component Type Definitions
 * Types specific to UI components
 */

import { ViewStyle, TextStyle, ImageStyle, StyleProp } from 'react-native';

// Re-export canonical types for backwards compatibility
export type { ToastType, Toast, SnackbarType, SnackbarParams } from './notification';
export type { DisplayAssetType, VaultAction, VaultTransactionData } from './assets';

/**
 * Icon component props
 */
export interface IconProps {
  name: string;
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
}

/**
 * SVG Icon props
 */
export interface SVGIconProps {
  width?: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Generic style props
 */
export type StyleType = ViewStyle | TextStyle | ImageStyle;
export type StylePropType = StyleProp<StyleType>;

/**
 * Modal props base interface
 */
export interface ModalBaseProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet props
 */
export interface BottomSheetBaseProps extends ModalBaseProps {
  title?: string;
  snapPoints?: (string | number)[];
}

/**
 * Transaction data for display (simplified from full Transaction)
 */
export interface TransactionDisplayData {
  amount: number | bigint;
  assetType: import('./assets').DisplayAssetType;
  isSent: boolean;
  isReceived: boolean;
}

/**
 * Display transaction (UI-focused version)
 * For full API transaction, use Transaction from './transaction'
 */
export interface DisplayTransaction {
  txid: string;
  vaultTransaction?: boolean;
  vaultData?: import('./assets').VaultTransactionData;
  ecashToken?: boolean;
  claimed?: boolean;
  partiallySpent?: boolean;
  timestamp?: number;
  status: import('./transaction').TransactionStatus;
  txData: TransactionDisplayData;
  vout?: Array<{
    scriptpubkey_address?: string;
    value?: number;
  }>;
}

/**
 * Ecash transaction display
 */
export interface EcashTransactionDisplay {
  txid: string;
  ecashToken: true;
  claimed?: boolean;
  partiallySpent?: boolean;
  timestamp: number;
  status: import('./transaction').TransactionStatus;
  txData: {
    amount: number;
  };
}

/**
 * Wallet styles type (for components receiving styles prop)
 */
export interface WalletStyles {
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
}

/**
 * Asset card styles type
 */
export interface AssetCardStyles {
  assetCard: ViewStyle;
  assetCardLast: ViewStyle;
  assetRow: ViewStyle;
  assetLeft: ViewStyle;
  btcIcon: ViewStyle;
  ducatIcon: ViewStyle;
  assetInfo: ViewStyle;
  assetName: TextStyle;
  balanceWithIcon: ViewStyle;
  assetAmountIcon: ViewStyle;
  assetAmount: TextStyle;
  assetValue: TextStyle;
  assetValueWithIcon: ViewStyle;
  assetIcon: ViewStyle;
}
