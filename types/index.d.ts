/**
 * Main Type Exports
 */

export * from './wallet';
export * from './transaction';
export * from './cashu';

/**
 * Navigation Types
 */
export type RootStackParamList = {
  Home: undefined;
  Send: undefined;
  Receive: undefined;
  Settings: undefined;
  TransactionDetails: { txid: string };
  VaultScreen: undefined;
  TurboScreen: undefined;
  TurboHistoryScreen: undefined;
  AccountsScreen: undefined;
  CreateAccountScreen: undefined;
  // Add more as needed during migration
};

/**
 * Context Types
 */
export interface WalletContextType {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  createWallet: (mnemonic: string) => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  deleteWallet: () => Promise<void>;
  switchAccount: (index: number) => Promise<void>;
  createAccount: (name: string) => Promise<void>;
}

export interface CashuContextType extends CashuWalletState {
  startMint: (amount: number) => Promise<MintQuoteResponse>;
  checkAndCompleteMint: (quote: string) => Promise<void>;
  send: (amount: number) => Promise<string>;
  receive: (token: string) => Promise<number>;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

/**
 * Service Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LogContext {
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Utility Types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;
