/**
 * Application constants
 */

// Secure storage keys
export const SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  PIN: 'wallet_pin_v1',
  BIOMETRIC_ENABLED: 'wallet_biometric_enabled_v1',
};

// API endpoints
export const API = {
  MUTINYNET_BASE: 'https://mutinynet.com/api',
  ORD_MUTINYNET_BASE: 'https://ord-mutinynet.ducatprotocol.com',
};

// Helper functions to build API URLs
export const getAddressUrl = (address) => `${API.MUTINYNET_BASE}/address/${address}`;
export const getAddressUtxoUrl = (address) => `${API.MUTINYNET_BASE}/address/${address}/utxo`;
export const getTxHexUrl = (txid) => `${API.MUTINYNET_BASE}/tx/${txid}/hex`;
export const getTxOutspendUrl = (txid, vout) => `${API.MUTINYNET_BASE}/tx/${txid}/outspend/${vout}`;
export const getBroadcastUrl = () => `${API.MUTINYNET_BASE}/tx`;
export const getTxUrl = (txid) => `https://mutinynet.com/tx/${txid}`;

export const getOrdAddressUrl = (address) => `${API.ORD_MUTINYNET_BASE}/address/${address}`;
export const getOrdOutputUrl = (output) => `${API.ORD_MUTINYNET_BASE}/output/${output}`;
