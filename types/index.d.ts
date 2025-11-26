/**
 * Main Type Exports
 */

export * from './wallet';
export * from './transaction';
export * from './cashu';
export * from './components';
export * from './notification';
export * from './assets';

/**
 * Re-export asset types for backwards compatibility
 * Prefer importing from './assets' directly
 */
export type { AssetTypeParam, AddressTypeParam } from './assets';

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
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Utility Types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;
export type AsyncFunctionWithArgs<T = void, A extends unknown[] = unknown[]> = (...args: A) => Promise<T>;

/**
 * Generic record type with proper typing
 */
export type TypedRecord<K extends string | number | symbol, V> = Record<K, V>;

/**
 * Type guard helper
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};
