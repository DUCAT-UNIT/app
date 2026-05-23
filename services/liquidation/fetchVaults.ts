/**
 * Liquidation Vault Fetcher
 *
 * Fetches liquidatable vaults from the validator indexer
 * and maps them to the app's internal format.
 */

import { logger } from '../../utils/logger';
import { fetchWithTimeout } from '../../utils/api';
import { LIQ_VALIDATOR_URL, COIN_SIZE } from './constants';
import type { ValidatorLiquidatedVault, ExtendedVaultProfile } from './types';

const LIQUIDATION_FETCH_TIMEOUT_MS = 12_000;

/**
 * Fetch all liquidatable vaults from the validator indexer.
 */
export async function fetchLiquidatableVaults(): Promise<ValidatorLiquidatedVault[]> {
  try {
    const response = await fetchWithTimeout(`${LIQ_VALIDATOR_URL}/api/liquidated`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, LIQUIDATION_FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Liquidation API error: ${response.status}`);
    }

    const data = await response.json() as ValidatorLiquidatedVault[] | null;
    const vaults = data ?? [];
    const activeVaults = vaults.filter((vault) => vault.quote?.is_expired !== true);
    const expiredQuoteCount = vaults.length - activeVaults.length;

    logger.debug('[Liquidation] Fetched vaults', {
      count: activeVaults.length,
      rawCount: vaults.length,
      expiredQuoteCount,
    });

    return activeVaults;
  } catch (error: unknown) {
    logger.warn('[Liquidation] Failed to fetch liquidatable vaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetch specific vault data by IDs.
 */
export async function fetchVaultsByIds(ids: string[]): Promise<ValidatorLiquidatedVault[]> {
  try {
    const params = ids.map(id => `id=${encodeURIComponent(id)}`).join('&');
    const response = await fetchWithTimeout(`${LIQ_VALIDATOR_URL}/api/vault?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, LIQUIDATION_FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Vault API error: ${response.status}`);
    }

    const data = await response.json() as ValidatorLiquidatedVault[] | null;
    return data ?? [];
  } catch (error: unknown) {
    logger.warn('[Liquidation] Failed to fetch vault data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Map validator response to the internal ExtendedVaultProfile format.
 *
 * Conversions:
 * - stone.balance: cents → UNIT (÷ 100)
 * - output.amount: sats → BTC (÷ 100_000_000)
 */
export function formatValidatorResponse(
  vaults: ValidatorLiquidatedVault[]
): ExtendedVaultProfile[] {
  return vaults.map(item => ({
    vaultId: item.vault_id,
    unit: item.stone.balance / 100,
    btcInVault: item.output.amount / COIN_SIZE,
    thold_key: item.thold_key,
    acct_id: item.open_account_id,
    guard_pk: item.guardian_pubkey,
    vault_pk: item.vault_pubkey,
    master_id: item.master_id,
    utxo: {
      value: item.output.amount,
      txid: item.output.txid,
      vout: item.output.vout,
      script: item.output_script,
    },
    rdata: {
      is_locked: true,
      thold_hash: item.quote.thold_hash,
      thold_price: item.quote.thold_price,
      unit_balance: item.stone.balance,
      unit_price: item.stone.oracle_price,
      unit_stamp: item.stone.oracle_timestamp,
      vault_action: item.stone.action,
    },
  }));
}
