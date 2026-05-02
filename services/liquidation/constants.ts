/**
 * Liquidation Constants
 */

/** Minimum collateral ratio to maintain vault health */
export const MIN_COL_RATE = 1.6;

/** Swap rate: 1 UNIT costs 1.02x in BTC */
export const UNIT_TO_BTC_RATE = 1.02;

/** Max claim per transaction in BTC */
export const LIQ_MAX_CLAIM_AMOUNT_BTC = 0.025;

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

/** Swap PSBT fee buffer: 2% of swap amount, with a 10k sat minimum for Mutinynet variance. */
export const SWAP_PSBT_FEE_BUFFER_BPS = 200;
export const SWAP_PSBT_MIN_FEE_BUFFER_SATS = 10_000;

/** Faucet swap API URL (BTC→UNIT swap after liquidation) */
// This app is Mutinynet-only; never switch to the non-test faucet endpoint.
export const FAUCET_SWAP_URL = 'https://faucet.ducatprotocol.com/unit/faucet/test';

/** Liquidation validator base URL */
export const LIQ_VALIDATOR_URL = 'https://validator.staging.ducatprotocol.com/liq';
