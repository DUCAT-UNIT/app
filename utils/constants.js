/**
 * Application constants
 */

// Secure storage keys
export const SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  PIN: 'wallet_pin_v1',
  PIN_SALT: 'wallet_pin_salt_v1',
  PIN_VERSION: 'wallet_pin_version_v1', // Track PIN hashing algorithm version
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
};

// PIN hashing versions
export const PIN_HASH_VERSION = {
  SHA256_LEGACY: '1', // Old SHA256 hashing
  PBKDF2_10K: '2', // New PBKDF2-like with 10K iterations
};

// API endpoints
export const API = {
  MUTINYNET_BASE: 'https://mutinynet.com/api',
  ORD_MUTINYNET_BASE: 'https://ord-mutinynet.ducatprotocol.com',
  FAUCET: 'https://faucet.ducatprotocol.com/btc/faucet',
  VAULT: 'https://validator.ducatprotocol.com/api',
  PHONE: 'https://phone.ducatprotocol.com',
};

// Helper functions to build API URLs
export const getAddressUrl = (address) => `${API.MUTINYNET_BASE}/address/${address}`;
export const getAddressUtxoUrl = (address) => `${API.MUTINYNET_BASE}/address/${address}/utxo`;
export const getAddressTxsUrl = (address, lastSeenTxid = null) => {
  return lastSeenTxid
    ? `${API.MUTINYNET_BASE}/address/${address}/txs/chain/${lastSeenTxid}`
    : `${API.MUTINYNET_BASE}/address/${address}/txs`;
};
export const getTxUrl = (txid) => `https://mutinynet.com/tx/${txid}`;
export const getTxApiUrl = (txid) => `${API.MUTINYNET_BASE}/tx/${txid}`;
export const getTxHexUrl = (txid) => `${API.MUTINYNET_BASE}/tx/${txid}/hex`;
export const getTxOutspendUrl = (txid, vout) => `${API.MUTINYNET_BASE}/tx/${txid}/outspend/${vout}`;
export const getBroadcastUrl = () => `${API.MUTINYNET_BASE}/tx`;

export const getOrdAddressUrl = (address) => `${API.ORD_MUTINYNET_BASE}/address/${address}`;
export const getOrdOutputUrl = (output) => `${API.ORD_MUTINYNET_BASE}/output/${output}`;
export const getOrdTxUrl = (txid) => `${API.ORD_MUTINYNET_BASE}/tx/${txid}`;
