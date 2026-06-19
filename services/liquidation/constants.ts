/**
 * Liquidation Constants
 */

import { APP_NETWORK_CONFIG } from '../../utils/networkConfig';

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

/** Repo portions are serialized and recomputed by the SDK at 4 decimal places. */
export const REPO_PORTION_PRECISION = 4;
export const MIN_REPO_PORTION = 1 / 10 ** REPO_PORTION_PRECISION;

/** VIN allowance for fee estimation */
export const VIN_ALLOWANCE = 350;

/** Default fee rate in sat/vB (Mutinynet) */
export const LIQ_DEFAULT_FEE_RATE = 1;

/** Validator /api/liquid/vaults currently returns up to 250 entries per page. */
export const LIQ_PAGE_SIZE = 250;

/** Guardrail against a malformed pagination loop. */
export const LIQ_MAX_PAGES = 10;

/** Swap PSBT fee buffer: 2% of swap amount, with a 10k sat minimum for Mutinynet variance. */
export const SWAP_PSBT_FEE_BUFFER_BPS = 200;
export const SWAP_PSBT_MIN_FEE_BUFFER_SATS = 10_000;

/** Faucet swap API URL (BTC→UNIT swap after liquidation) */
// This app is Mutinynet-only; never switch to the non-test faucet endpoint.
export const FAUCET_SWAP_URL = 'https://faucet.ducatprotocol.com/unit/faucet/test';

function requireHttpsBaseUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL value for ${name}: ${value}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }

  return parsed.toString().replace(/\/$/, '');
}

function requireWssBaseUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid WebSocket URL value for ${name}: ${value}`);
  }

  if (parsed.protocol !== 'wss:') {
    throw new Error(`${name} must use WSS`);
  }

  return parsed.toString().replace(/\/$/, '');
}

function normalizeValidatorBaseUrl(name: string, value: string): string {
  return requireHttpsBaseUrl(name, value)
    .replace(/\/api\/?$/, '')
    .replace(/\/liq\/?$/, '')
    .replace(/\/+$/, '');
}

function resolveLiquidationValidatorUrl(): string {
  const configured = process.env.EXPO_PUBLIC_LIQ_VALIDATOR_URL?.trim();
  if (configured) {
    return normalizeValidatorBaseUrl('EXPO_PUBLIC_LIQ_VALIDATOR_URL', configured);
  }

  return normalizeValidatorBaseUrl('EXPO_PUBLIC_LIQ_VALIDATOR_URL', APP_NETWORK_CONFIG.api.validatorUrl);
}

/** Liquidation validator base URL */
export const LIQ_VALIDATOR_URL = resolveLiquidationValidatorUrl();

function resolveLiquidationValidatorWs(): string {
  const configured = process.env.EXPO_PUBLIC_LIQ_VALIDATOR_WS?.trim();
  if (configured) {
    return requireWssBaseUrl('EXPO_PUBLIC_LIQ_VALIDATOR_WS', configured);
  }

  return requireWssBaseUrl(
    'EXPO_PUBLIC_LIQ_VALIDATOR_WS',
    LIQ_VALIDATOR_URL.replace(/^https:\/\//, 'wss://') + '/ws'
  );
}

/** Liquidation validator WebSocket URL */
export const LIQ_VALIDATOR_WS = resolveLiquidationValidatorWs();
