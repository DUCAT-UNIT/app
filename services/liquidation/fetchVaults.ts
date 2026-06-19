/**
 * Liquidation Vault Fetcher
 *
 * Fetches liquidatable vaults from the validator indexer
 * and maps them to the app's internal format.
 */

import { logger } from '../../utils/logger';
import { fetchWithTimeout } from '../../utils/api';
import { normalizeVaultAction } from '../vault/utils';
import { LIQ_MAX_PAGES, LIQ_PAGE_SIZE, LIQ_VALIDATOR_URL, COIN_SIZE } from './constants';
import type { ValidatorLiquidatedVault, ExtendedVaultProfile } from './types';
import type { VaultProfile } from '@ducat-unit/client-sdk';

const LIQUIDATION_FETCH_TIMEOUT_MS = 12_000;

type PaginatedLiquidationResponse = {
  data?: unknown[];
  items?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

function isTerminalLiquidationAction(action: string | undefined): boolean {
  const normalized = action?.trim().toLowerCase();
  return normalized === 'liquidation'
    || normalized === 'liquidate'
    || normalized === 'repo'
    || normalized === 'l';
}

function isClaimableLiquidationVault(vault: ValidatorLiquidatedVault): boolean {
  return vault.quote?.is_expired !== true && !isTerminalLiquidationAction(vault.stone?.action);
}

function isLatestVaultProfile(value: unknown): value is VaultProfile {
  return Boolean(
    value
      && typeof value === 'object'
      && 'root_txid' in value
      && 'vault_balance' in value
      && 'unit_balance' in value
  );
}

function latestVaultProfileToValidatorVault(profile: VaultProfile): ValidatorLiquidatedVault {
  const rootTxid = profile.root_txid ?? '';
  const coinId = profile.coin_id ?? `${rootTxid}:0`;
  const [txid = rootTxid, voutRaw = '0'] = coinId.split(':');
  const vout = Number(voutRaw);
  const firstCommit = profile.price_commits?.[0];
  const basePrice = profile.unit_price ?? firstCommit?.base_price ?? 0;
  const tholdPrice = profile.thold_price ?? firstCommit?.thold_price ?? 0;
  const vaultVersion = profile.vault_version ?? 3;
  const vaultAction = profile.vault_action ?? 'open';
  const vaultBalance = profile.vault_balance ?? profile.vault_value ?? 0;

  return {
    latest_profile: profile,
    vault_id: rootTxid,
    master_id: profile.contract_id ?? '',
    guardian_pubkey: profile.guard_pubkey ?? '',
    vault_pubkey: profile.client_pubkey ?? '',
    open_account_id: coinId,
    collateral_rate: profile.vault_ratio ?? 0,
    thold_key: '',
    output_script: profile.vault_script ?? '',
    stone: {
      txid,
      vout: Number.isFinite(vout) ? vout : 0,
      version: String(vaultVersion),
      action: vaultAction,
      balance: profile.unit_balance ?? 0,
      oracle_price: basePrice,
      oracle_timestamp: profile.price_stamp ?? 0,
      liquidation_price: tholdPrice,
      liquidation_hash: [],
    },
    output: {
      txid,
      vout: Number.isFinite(vout) ? vout : 0,
      amount: vaultBalance,
      address: '',
    },
    quote: {
      event_origin: null,
      event_price: null,
      event_stamp: null,
      event_type: 'liquidation',
      is_expired: false,
      latest_origin: 'validator',
      latest_price: basePrice,
      latest_stamp: profile.price_stamp ?? 0,
      quote_origin: 'validator',
      quote_price: basePrice,
      quote_stamp: profile.price_stamp ?? 0,
      req_id: rootTxid,
      req_sig: firstCommit?.oracle_sig ?? '',
      srv_network: 'mutiny',
      srv_pubkey: firstCommit?.oracle_pubkey ?? '',
      thold_hash: firstCommit?.thold_hash ?? '',
      thold_key: '',
      thold_price: tholdPrice,
    },
  };
}

function normalizeLiquidationVaults(data: unknown): ValidatorLiquidatedVault[] {
  const raw = Array.isArray(data) ? data : [];
  return raw.map((item) => {
    if (isLatestVaultProfile(item)) {
      return latestVaultProfileToValidatorVault(item);
    }
    return item as ValidatorLiquidatedVault;
  });
}

function getLiquidationPageRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  const page = data as PaginatedLiquidationResponse;
  if (Array.isArray(page.data)) {
    return page.data;
  }
  if (Array.isArray(page.items)) {
    return page.items;
  }
  return [];
}

function getLiquidationNextCursor(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const page = data as PaginatedLiquidationResponse;
  return page.has_more === true && typeof page.next_cursor === 'string' && page.next_cursor.length > 0
    ? page.next_cursor
    : null;
}

function isExpiredSnapshotPaginationError(response: Response, body: string): boolean {
  return response.status === 400 && body.toLowerCase().includes('expired snapshot');
}

/**
 * Fetch all liquidatable vaults from the validator indexer.
 */
export async function fetchLiquidatableVaults(): Promise<ValidatorLiquidatedVault[]> {
  try {
    const rawRows: unknown[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    let stoppedAtPageGuard = false;
    let stoppedAtExpiredSnapshot = false;

    do {
      const url = new URL(`${LIQ_VALIDATOR_URL}/api/liquid/vaults`);
      url.searchParams.set('page_size', String(LIQ_PAGE_SIZE));
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }, LIQUIDATION_FETCH_TIMEOUT_MS);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (rawRows.length > 0 && isExpiredSnapshotPaginationError(response, body)) {
          stoppedAtExpiredSnapshot = true;
          logger.warn('[Liquidation] Cursor snapshot expired; using partial liquidation page set', {
            pageCount,
            rawCount: rawRows.length,
            status: response.status,
            url: url.toString(),
          });
          break;
        }

        throw new Error(
          `Liquidation API error: ${response.status} ${url.toString()} ${body.slice(0, 160)}`
        );
      }

      const pageData = await response.json();
      rawRows.push(...getLiquidationPageRows(pageData));
      pageCount += 1;
      const nextCursor = getLiquidationNextCursor(pageData);
      stoppedAtPageGuard = pageCount >= LIQ_MAX_PAGES && nextCursor !== null;
      cursor = stoppedAtPageGuard ? null : nextCursor;
    } while (cursor);

    if (stoppedAtPageGuard) {
      logger.warn('[Liquidation] Stopped liquidation pagination at page guardrail', {
        maxPages: LIQ_MAX_PAGES,
        rawCount: rawRows.length,
      });
    }

    const vaults = normalizeLiquidationVaults(rawRows);
    const expiredQuoteCount = vaults.filter((vault) => vault.quote?.is_expired === true).length;
    const terminalActionCount = vaults.filter((vault) =>
      isTerminalLiquidationAction(vault.stone?.action)
    ).length;
    const claimableVaults = vaults.filter(isClaimableLiquidationVault);

    logger.debug('[Liquidation] Fetched vaults', {
      count: claimableVaults.length,
      rawCount: vaults.length,
      expiredQuoteCount,
      terminalActionCount,
      pageCount,
      paginationIncomplete: stoppedAtExpiredSnapshot || stoppedAtPageGuard,
    });

    return claimableVaults;
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
    if (ids.length === 0) {
      return [];
    }

    const vaults = await Promise.all(ids.map(async (id) => {
      const response = await fetchWithTimeout(
        `${LIQ_VALIDATOR_URL}/api/vault/${encodeURIComponent(id)}/latest`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        LIQUIDATION_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Vault API error: ${response.status}`);
      }

      return response.json();
    }));

    return normalizeLiquidationVaults(vaults.flat());
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
      vault_action: normalizeVaultAction(item.stone.action),
    },
  }));
}
