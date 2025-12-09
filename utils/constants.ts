/**
 * Application constants
 */

// Secure storage keys
export const SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  CACHED_ADDRESSES: 'wallet_cached_addresses_v1', // Cached derived addresses for fast startup
  MULTI_ACCOUNT_CACHE: 'wallet_multi_account_cache_v1', // Multi-account address cache for fast switching
  PIN: 'wallet_pin_v1',
  PIN_SALT: 'wallet_pin_salt_v1',
  PIN_VERSION: 'wallet_pin_version_v1', // Track PIN hashing algorithm version
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
  // Passkey authentication keys
  PASSKEY_ENABLED: 'passkey_enabled_v1',
  PASSKEY_CREDENTIAL_ID: 'passkey_credential_id_v1',
  PASSKEY_USER_HANDLE: 'passkey_user_handle_v1',
  WALLET_CREATION_METHOD: 'wallet_creation_method_v1', // 'passkey', 'pin', or 'biometric'
} as const;

// PIN hashing version
export const PIN_HASH_VERSION = {
  PBKDF2_10K: '1', // Legacy: PBKDF2 with 10K iterations
  PBKDF2_310K: '2', // Current: PBKDF2 with 310K iterations (OWASP compliant)
} as const;

// API endpoints
export const API = {
  MUTINYNET_BASE: 'https://mutinynet.com/api',
  ORD_MUTINYNET_BASE: 'https://ord-mutinynet.ducatprotocol.com',
  FAUCET: 'https://faucet.ducatprotocol.com/btc/faucet',
  VAULT: 'https://validator.ducatprotocol.com/api',
  PHONE: 'https://phone.ducatprotocol.com',
  COINGECKO: 'https://api.coingecko.com/api/v3',
  // Vault creation endpoints
  GUARDIAN_WS: 'wss://guardian-mutinynet-1.ducatprotocol.com',
  QUOTE_SERVER: 'https://quote.ducatprotocol.com',
  PRICE_SERVER: 'https://price.ducatprotocol.com',
  // Aliases for SDK compatibility
  ESPLORA_URL: 'https://mutinynet.com/api',
  ORD_URL: 'https://ord-mutinynet.ducatprotocol.com',
} as const;

// Vault creation constants
export const VAULT_CONFIG = {
  MIN_COL_RATE: 1.6, // 160% minimum collateralization ratio
  LIQUIDATION_RATE: 1.35, // 135% liquidation threshold
  VIN_ALLOWANCE: 350, // Virtual bytes allowance per input
  TX_TIMEOUT: 60_000, // 60s guardian timeout
  UNIT_POSTAGE: 10_000, // Satoshis for UNIT output
  TOKEN_POSTAGE: 10_000, // Satoshis for token output
  RUNE_LABEL: 'DUCAT•UNIT•RUNE', // Rune label for UNIT token
} as const;

// Runes configuration
export const RUNES_CONFIG = {
  // DUCAT•UNIT•RUNE ID (block 1527352, tx 1)
  // CRITICAL: This ID must match the actual rune on the network
  // Incorrect ID will cause loss of funds
  DUCAT_UNIT_RUNE_ID: {
    block: 1527352n,
    tx: 1n,
  },
  DUCAT_UNIT_RUNE_LABEL: 'DUCAT•UNIT•RUNE',
} as const;

// API Keys (for services that require authentication)
// Note: CoinGecko API key is optional - increases rate limits but not required
export const API_KEYS = {
  COINGECKO: process.env.EXPO_PUBLIC_COINGECKO_API_KEY,
} as const;

// Helper functions to build API URLs
export const getAddressUrl = (address: string): string => `${API.MUTINYNET_BASE}/address/${address}`;

export const getAddressUtxoUrl = (address: string): string => `${API.MUTINYNET_BASE}/address/${address}/utxo`;

export const getAddressTxsUrl = (address: string, lastSeenTxid: string | null = null): string => {
  return lastSeenTxid
    ? `${API.MUTINYNET_BASE}/address/${address}/txs/chain/${lastSeenTxid}`
    : `${API.MUTINYNET_BASE}/address/${address}/txs`;
};

export const getTxUrl = (txid: string): string => `https://mutinynet.com/tx/${txid}`;

export const getTxApiUrl = (txid: string): string => `${API.MUTINYNET_BASE}/tx/${txid}`;

export const getTxHexUrl = (txid: string): string => `${API.MUTINYNET_BASE}/tx/${txid}/hex`;

export const getTxOutspendUrl = (txid: string, vout: number): string =>
  `${API.MUTINYNET_BASE}/tx/${txid}/outspend/${vout}`;

export const getBroadcastUrl = (): string => `${API.MUTINYNET_BASE}/tx`;

export const getOrdAddressUrl = (address: string): string => `${API.ORD_MUTINYNET_BASE}/address/${address}`;

export const getOrdOutputUrl = (output: string): string => `${API.ORD_MUTINYNET_BASE}/output/${output}`;

export const getOrdTxUrl = (txid: string): string => `${API.ORD_MUTINYNET_BASE}/tx/${txid}`;
