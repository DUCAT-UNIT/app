/**
 * Application constants
 */

import { APP_NETWORK_CONFIG } from './networkConfig';

// Secure storage keys
export const SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  CACHED_ADDRESSES: 'wallet_cached_addresses_v1', // Cached derived addresses for fast startup
  MULTI_ACCOUNT_CACHE: 'wallet_multi_account_cache_v1', // Multi-account address cache for fast switching
  PIN: 'wallet_pin_v1',
  PIN_SALT: 'wallet_pin_salt_v1',
  PIN_SALT_HMAC: 'wallet_pin_salt_hmac_v1', // HMAC for salt integrity verification
  PIN_HMAC_KEY: 'wallet_pin_hmac_key_v1', // Separate key for salt HMAC (not derived from PIN)
  PIN_VERSION: 'wallet_pin_version_v1', // Track PIN hashing algorithm version
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
  // Passkey authentication keys
  PASSKEY_ENABLED: 'passkey_enabled_v1',
  PASSKEY_CREDENTIAL_ID: 'passkey_credential_id_v1',
  PASSKEY_USER_HANDLE: 'passkey_user_handle_v1',
  PASSKEY_PEPPER: 'passkey_pepper_v1',
  WALLET_CREATION_METHOD: 'wallet_creation_method_v1', // 'passkey', 'pin', or 'biometric'
} as const;

// PIN hashing version
export const PIN_HASH_VERSION = {
  PBKDF2_10K: '1', // Legacy: PBKDF2 with 10K iterations
  PBKDF2_310K: '2', // Current: PBKDF2 with 310K iterations (OWASP compliant)
} as const;

// API endpoints
export const API = {
  BASE: APP_NETWORK_CONFIG.api.esploraApiUrl,
  ORD_BASE: APP_NETWORK_CONFIG.api.ordUrl,
  EXPLORER: APP_NETWORK_CONFIG.api.explorerBaseUrl,
  FAUCET: APP_NETWORK_CONFIG.api.faucetUrl ?? '',
  VAULT: APP_NETWORK_CONFIG.api.vaultUrl,
  PHONE: APP_NETWORK_CONFIG.api.phoneUrl,
  COINGECKO: APP_NETWORK_CONFIG.api.coingeckoUrl,
  GUARDIAN_WS: APP_NETWORK_CONFIG.api.guardianWs,
  QUOTE_SERVER: APP_NETWORK_CONFIG.api.quoteServer,
  PRICE_SERVER: APP_NETWORK_CONFIG.api.priceServer,
  FEE_RECOMMENDATIONS: APP_NETWORK_CONFIG.api.feeRecommendationsUrl,
  ESPLORA_URL: APP_NETWORK_CONFIG.api.esploraApiUrl,
  ORD_URL: APP_NETWORK_CONFIG.api.ordUrl,
  // Backward-compatible aliases while downstream consumers migrate.
  MUTINYNET_BASE: APP_NETWORK_CONFIG.api.esploraApiUrl,
  ORD_MUTINYNET_BASE: APP_NETWORK_CONFIG.api.ordUrl,
} as const;

// Bitcoin transaction constants
export const BITCOIN_TX = {
  DUST_LIMIT: 546, // Minimum output amount in satoshis to avoid dust
  SATOSHIS_PER_BTC: 100_000_000, // Number of satoshis in 1 BTC
  ESTIMATED_TX_FEE: 1_000, // Default transaction fee in satoshis
  RUNE_OUTPUT_AMOUNT: 10_000, // Standard amount for rune-bearing outputs
  TX_TIMEOUT_BUFFER: 5_000, // Extra milliseconds to wait beyond configured timeout
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
  DUCAT_UNIT_RUNE_ID: APP_NETWORK_CONFIG.runes.unitId,
  DUCAT_UNIT_RUNE_LABEL: APP_NETWORK_CONFIG.runes.unitLabel,
} as const;

export const NETWORK_CONFIG = APP_NETWORK_CONFIG;
export const NETWORK_DISPLAY_NAME = APP_NETWORK_CONFIG.displayName;
export const NETWORK_EDITION_LABEL = APP_NETWORK_CONFIG.editionLabel;
export const TURBO_MINT_ADDRESS = APP_NETWORK_CONFIG.protocol.turboMintAddress;

// API Keys (for services that require authentication)
// Note: CoinGecko API key is optional - increases rate limits but not required
export const API_KEYS = {
  COINGECKO: process.env.EXPO_PUBLIC_COINGECKO_API_KEY,
} as const;

// Helper functions to build API URLs
export const getAddressUrl = (address: string): string => `${API.BASE}/address/${address}`;

export const getAddressUtxoUrl = (address: string): string => `${API.BASE}/address/${address}/utxo`;

export const getAddressTxsUrl = (address: string, lastSeenTxid: string | null = null): string => {
  return lastSeenTxid
    ? `${API.BASE}/address/${address}/txs/chain/${lastSeenTxid}`
    : `${API.BASE}/address/${address}/txs`;
};

export const getTxUrl = (txid: string): string => `${API.EXPLORER}/tx/${txid}`;

export const getTxApiUrl = (txid: string): string => `${API.BASE}/tx/${txid}`;

export const getTxHexUrl = (txid: string): string => `${API.BASE}/tx/${txid}/hex`;

export const getTxOutspendUrl = (txid: string, vout: number): string =>
  `${API.BASE}/tx/${txid}/outspend/${vout}`;

export const getBroadcastUrl = (): string => `${API.BASE}/tx`;

export const getOrdAddressUrl = (address: string): string => `${API.ORD_BASE}/address/${address}`;

export const getOrdOutputUrl = (output: string): string => `${API.ORD_BASE}/output/${output}`;

export const getOrdTxUrl = (txid: string): string => `${API.ORD_BASE}/tx/${txid}`;
