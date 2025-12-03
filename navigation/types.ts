/**
 * Navigation Type Definitions
 * Defines the navigation structure and param lists for the entire app
 */

import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams, ParamListBase } from '@react-navigation/native';

// Re-export types from types/assets.d.ts
export type { AssetTypeParam, AddressTypeParam } from '../types/assets';

/**
 * Send Flow Navigator
 * Modal stack for send transaction flow
 */
export type SendStackParamList = {
  AssetSelector: undefined;
  AddressInput: { assetType?: string };
  AmountInput: { assetType?: string; address?: string };
  TurboLoading: undefined;
  Review: { assetType?: string; address?: string; amount?: number };
  Processing: undefined;
  TurboProcessing: undefined;
  TurboClaiming: { tokenAmount?: number };
  Confirmation: { txid?: string; amount?: number };
};

/**
 * Vault Creation Navigator
 * Stack for vault creation flow
 */
export type VaultCreateStackParamList = {
  VaultAmounts: undefined;
  VaultConfirm: undefined;
  VaultProcessing: undefined;
  VaultSuccess: { txid?: string };
};

/**
 * Borrow Navigator
 * Stack for borrow flow (borrowing more UNIT from existing vault)
 */
export type BorrowStackParamList = {
  BorrowInput: undefined;
  BorrowConfirm: undefined;
  BorrowProcessing: undefined;
  BorrowSuccess: { txid?: string };
};

/**
 * Deposit Navigator
 * Stack for deposit flow (adding more BTC collateral to existing vault)
 */
export type DepositStackParamList = {
  DepositInput: undefined;
  DepositConfirm: undefined;
  DepositProcessing: undefined;
  DepositSuccess: { vaultTxid?: string };
};

/**
 * Repay Navigator
 * Stack for repay flow (paying back UNIT debt)
 */
export type RepayStackParamList = {
  RepayInput: undefined;
  RepayConfirm: undefined;
  RepayProcessing: undefined;
  RepaySuccess: { vaultTxid?: string };
};

/**
 * Withdraw Navigator
 * Stack for withdraw flow (withdrawing BTC collateral from existing vault)
 */
export type WithdrawStackParamList = {
  WithdrawInput: undefined;
  WithdrawConfirm: undefined;
  WithdrawProcessing: undefined;
  WithdrawSuccess: { vaultTxid?: string };
};

/**
 * Root Stack Navigator (top level)
 * Switches between Auth flow and Main app
 */
export type RootNavigatorParamList = {
  Auth: undefined;
  Main: undefined;
  SendFlow: NavigatorScreenParams<SendStackParamList> | undefined;
  VaultCreateFlow: NavigatorScreenParams<VaultCreateStackParamList> | undefined;
  BorrowFlow: NavigatorScreenParams<BorrowStackParamList> | undefined;
  DepositFlow: NavigatorScreenParams<DepositStackParamList> | undefined;
  RepayFlow: NavigatorScreenParams<RepayStackParamList> | undefined;
  WithdrawFlow: NavigatorScreenParams<WithdrawStackParamList> | undefined;
};

/**
 * Auth Stack Navigator (onboarding/authentication)
 * All screens before user is authenticated
 */
export type AuthStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  PinSetup: { isChangingPin?: boolean };
  LockScreen: undefined;
};

/**
 * Wallet Stack Navigator (nested in WalletTab)
 * Stack navigation within the wallet section
 */
export type WalletStackParamList = {
  WalletHome: undefined;
  AssetDetail: { assetId: string; assetType: string };
  VaultDetail: undefined;
  ReceiveQR: { addressType: 'segwit' | 'taproot' };
  CashuReceive: { token?: string };
  RecoverMint: undefined;
  Preferences: undefined;
  Security: undefined;
  Advanced: undefined;
  CashuSettings: undefined;
  About: undefined;
};

/**
 * Main Tab Navigator (authenticated app)
 * Bottom tab navigation
 */
export type MainTabParamList = {
  WalletTab: NavigatorScreenParams<WalletStackParamList>;
};

/**
 * Screen Props Types
 * Type helpers for screen component props
 */

// Root Navigator screen props
export type RootNavigatorScreenProps<T extends keyof RootNavigatorParamList> =
  StackScreenProps<RootNavigatorParamList, T>;

// Auth Stack screen props
export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  StackScreenProps<AuthStackParamList, T>;

// Main Tab screen props
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

// Wallet Stack screen props (composite with tab navigator)
export type WalletStackScreenProps<T extends keyof WalletStackParamList> =
  CompositeScreenProps<
    StackScreenProps<WalletStackParamList, T>,
    CompositeScreenProps<
      BottomTabScreenProps<MainTabParamList>,
      StackScreenProps<RootNavigatorParamList>
    >
  >;

// Send Stack screen props
export type SendStackScreenProps<T extends keyof SendStackParamList> =
  CompositeScreenProps<
    StackScreenProps<SendStackParamList, T>,
    StackScreenProps<RootNavigatorParamList>
  >;

/**
 * Extended navigation interface for hooks
 * Provides a simplified navigation interface for use in hooks
 */
export interface ExtendedNavigation {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  getParent?: () => ExtendedNavigation | undefined;
}

/**
 * Minimal navigation interface (navigate only)
 * For hooks that only need basic navigation
 */
export interface MinimalNavigation {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

/**
 * Navigation type declarations for useNavigation hook
 * This enables typed navigation throughout the app
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootNavigatorParamList {}
  }
}
