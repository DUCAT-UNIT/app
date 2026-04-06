/**
 * Liquidation Constants
 */

/** Minimum collateral ratio to maintain vault health */
export const MIN_COL_RATE = 1.6;

/** Threshold at which vaults become liquidatable */
export const LIQUIDATION_RATE = 1.35;

/** Swap rate: 1 UNIT costs 1.02x in BTC */
export const UNIT_TO_BTC_RATE = 1.02;

/** Max claim per transaction in BTC */
export const LIQ_MAX_CLAIM_AMOUNT_BTC = 0.025;

/** Max allowed BTC price fluctuation (0.5%) */
export const BTC_PRICE_FLUCTUATION_MAX = 0.005;

/** Satoshis per BTC */
export const COIN_SIZE = 100_000_000;

/** Minimum UTXO value in sats */
export const DUST_LIMIT = 546;

/** Dust limit in BTC */
export const DUST_BTC = DUST_LIMIT / COIN_SIZE;

/** VIN allowance for fee estimation */
export const VIN_ALLOWANCE = 350;

/** Default fee rate in sat/vB (Mutinynet) */
export const LIQ_DEFAULT_FEE_RATE = 1;

/** Liquidation validator base URL */
export const LIQ_VALIDATOR_URL = 'https://validator.staging.ducatprotocol.com/liq';
