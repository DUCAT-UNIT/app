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

/**
 * Generic API response wrapper with type-safe data field
 * @template T - The type of the data payload (defaults to unknown)
 * @example
 * // Basic usage with typed data
 * const response: ApiResponse<User> = await fetchUser(id);
 * if (response.success && response.data) {
 *   console.log(response.data.name); // TypeScript knows data is User
 * }
 *
 * @example
 * // Handling errors
 * const response: ApiResponse<void> = await deleteItem(id);
 * if (!response.success) {
 *   console.error(response.error); // TypeScript knows error exists
 * }
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Flexible context object for logging metadata
 * @example
 * const context: LogContext = {
 *   userId: '123',
 *   action: 'login',
 *   timestamp: Date.now()
 * };
 * logger.info('User logged in', context);
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Log severity levels for structured logging
 * @example
 * function log(level: LogLevel, message: string) {
 *   // 'debug' | 'info' | 'warn' | 'error'
 * }
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Utility Types
 */

/**
 * Makes a type nullable (can be T or null)
 * @template T - The base type to make nullable
 * @example
 * // Instead of `string | null`, use:
 * type MaybeString = Nullable<string>; // string | null
 *
 * @example
 * // Useful for database fields that can be NULL
 * interface User {
 *   id: string;
 *   middleName: Nullable<string>; // Can be null
 * }
 */
export type Nullable<T> = T | null;

/**
 * Makes a type optional (can be T or undefined)
 * @template T - The base type to make optional
 * @example
 * // Instead of `string | undefined`, use:
 * type MaybeString = Optional<string>; // string | undefined
 *
 * @example
 * // Useful for optional function parameters
 * function greet(name: string, title: Optional<string>) {
 *   if (title) {
 *     return `Hello, ${title} ${name}`;
 *   }
 *   return `Hello, ${name}`;
 * }
 */
export type Optional<T> = T | undefined;

/**
 * Type for async functions that return a Promise
 * @template T - The resolved type of the Promise (defaults to void)
 * @example
 * // Basic async function type
 * const fetchData: AsyncFunction<User[]> = async () => {
 *   return await api.getUsers();
 * };
 *
 * @example
 * // Void async function (side effects only)
 * const logAction: AsyncFunction = async () => {
 *   await analytics.track('action');
 * };
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Type for async functions with arguments
 * @template T - The resolved type of the Promise (defaults to void)
 * @template A - Tuple type of the arguments (defaults to unknown[])
 * @example
 * // Async function with typed arguments
 * const saveUser: AsyncFunctionWithArgs<boolean, [string, User]> =
 *   async (id, user) => {
 *     await db.save(id, user);
 *     return true;
 *   };
 *
 * @example
 * // Using with spread arguments
 * type FetchHandler = AsyncFunctionWithArgs<Response, [url: string, options?: RequestInit]>;
 */
export type AsyncFunctionWithArgs<T = void, A extends unknown[] = unknown[]> = (...args: A) => Promise<T>;

/**
 * Generic record type with explicit key and value types
 * Provides better type inference than built-in Record in some cases
 * @template K - The key type (string, number, or symbol)
 * @template V - The value type
 * @example
 * // String keys with specific value type
 * type UserScores = TypedRecord<string, number>;
 * const scores: UserScores = { alice: 100, bob: 85 };
 *
 * @example
 * // Enum keys
 * enum Status { Active, Inactive }
 * type StatusLabels = TypedRecord<Status, string>;
 */
export type TypedRecord<K extends string | number | symbol, V> = Record<K, V>;

/**
 * Transforms all properties of T to be non-nullable
 * Useful when you know all fields are populated
 * @template T - The object type to transform
 * @example
 * interface PartialUser {
 *   id: string;
 *   name: string | null;
 *   email: string | undefined;
 * }
 *
 * // After validation, all fields are guaranteed to exist
 * type CompleteUser = NonNullableFields<PartialUser>;
 * // { id: string; name: string; email: string; }
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};
