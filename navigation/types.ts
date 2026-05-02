/**
 * Navigation Type Definitions
 * Defines the navigation structure and param lists for the entire app
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

// Re-export types from types/assets.d.ts
export type { AddressTypeParam,AssetTypeParam } from '../types/assets';

/**
 * Send Flow Navigator
 * Modal stack for send transaction flow
 */
export type SendStackParamList = {
  AssetSelector: undefined;
  SendInput: { assetType?: string; prefillAddress?: string; prefillAmount?: string };
  TurboLoading: undefined;
  Review: { assetType?: string; address?: string; amount?: number };
  Processing: undefined;
  TurboProcessing: undefined;
  TurboClaiming: { tokenString?: string; token?: string; tokenAmount?: number };
  Confirmation: { txid?: string; amount?: number };
};

/**
 * Vault Creation Navigator
 * Stack for vault creation flow
 */
export type VaultCreateStackParamList = {
  VaultAmounts: undefined;
  VaultPayout: undefined;
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
  BorrowPayout: undefined;
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
  LockScreen: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  SendFlow: NavigatorScreenParams<SendStackParamList> | undefined;
  VaultCreateFlow: NavigatorScreenParams<VaultCreateStackParamList> | undefined;
  BorrowFlow: NavigatorScreenParams<BorrowStackParamList> | undefined;
  DepositFlow: NavigatorScreenParams<DepositStackParamList> | undefined;
  RepayFlow: NavigatorScreenParams<RepayStackParamList> | undefined;
  WithdrawFlow: NavigatorScreenParams<WithdrawStackParamList> | undefined;
  VaultSuccessPreview: undefined;
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
  AssetDetail: {
    assetId?: string;
    assetType: string;
    advancedMode?: boolean;
    initialEvmUsdcBalance?: number;
    initialEvmEthBalance?: number;
    initialEvmAddress?: string;
  };
  VaultDetail: undefined;
  ReceiveQR: {
    address: string;
    addressType?: string;
    assetType?: 'BTC' | 'UNIT' | 'USDC' | 'ETH';
    networkLabel?: string;
  };
  UnitBridge: { amount?: string; autoSwap?: boolean } | undefined;
  SepoliaSwap: { sourceAsset?: 'UNIT' | 'USDC' } | undefined;
  SepoliaSwapSummary: { sourceAsset: 'UNIT' | 'USDC'; amountIn: string } | undefined;
  SepoliaRedeem: { amount?: string; sourceAsset?: 'USDC' | 'wUNIT'; maxInputAmount?: string } | undefined;
  SepoliaSend: { asset?: 'USDC' | 'wUNIT' | 'ETH' } | undefined;
  CashuReceive: { token?: string };
  RecoverMint: undefined;
  Preferences: undefined;
  Security: undefined;
  Advanced: undefined;
  CashuSettings: undefined;
  About: undefined;
  TermsOfService: { onClose: () => void };
  PrivacyPolicy: { onClose: () => void };
};

/**
 * Main Tab Navigator (authenticated app)
 * Bottom tab navigation
 */
export type MainTabParamList = {
  WalletTab: NavigatorScreenParams<WalletStackParamList>;
};

/**
 * Extended navigation interface for hooks
 * Provides a simplified navigation interface for use in hooks
 */
export interface ExtendedNavigation {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  getParent?: () => ExtendedNavigation | undefined;
  getState?: () => { routeNames?: string[]; routes?: Array<{ name: string }> };
  reset?: (state: { index: number; routes: Array<{ name: string }> }) => void;
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
  // React Navigation uses a namespace augmentation for global route typing.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootNavigatorParamList {}
  }
}
