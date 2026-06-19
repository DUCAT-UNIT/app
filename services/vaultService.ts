import { getJSON } from '../utils/apiClient';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';

export interface VaultHistoryTransaction {
  amount_borrowed: number;
  vault_amount: number;
  btc_amt: number;
  unit_amt: number;
  oracle_price: number;
  timestamp: number;
  action: string;
  // Additional fields for VaultProfile construction
  root_txid?: string;
  transaction_id?: string;
  utxo?: string;
  utxo_script?: string;
  liquidation_hash?: string;
  liquidation_threshold?: number;
  compositeSettlement?: boolean;
  latest_profile?: LatestVaultProfile;
}

export interface VaultData {
  vaultId?: string;
  vaultTag?: string;
  totalDebt?: number;
  totalCollateral?: number;
  currentPrice?: number;
  latestTransaction?: {
    amountBorrowed: number;
    vaultAmount: number;
    btcAmount: number;
    unitAmt: number;
    oraclePrice: number;
    timestamp: number;
    action: string;
  };
  // Extended vault info for borrow operations
  vaultInfo?: VaultInfo;
}

/**
 * Full vault info from validator API
 * Used for constructing VaultProfile for borrow/repay operations
 */
export interface VaultInfo {
  vault_id: string;
  vault_tag: string;
  vault_pubkey: string;
  btc_locked: number;
  unit_borrowed: number;
  collateral_ratio: number;
  creation_account: string;
  guard_pubkey: string;
  master_id: string;
  liquidation_hash: string;
  liquidation_price: number;
  oracle_price: number;
  oracle_timestamp: number;
  utxo: string;
  vault_last_action: string;
  vault_version: number;
  latest_profile?: LatestVaultProfile;
}

interface VaultListVault {
  vault_id: string;
  vault_tag: string;
  btc_locked: number;
  unit_borrowed: number;
  // Extended fields
  vault_pubkey?: string;
  collateral_ratio?: number;
  creation_account?: string;
  guard_pubkey?: string;
  master_id?: string;
  liquidation_hash?: string;
  liquidation_price?: number;
  oracle_price?: number;
  oracle_timestamp?: number;
  utxo?: string;
  vault_last_action?: string;
  vault_version?: number;
  latest_profile?: LatestVaultProfile;
}

interface LatestPriceCommit {
  base_price?: number | null;
  oracle_pubkey?: string | null;
  oracle_sig?: string | null;
  thold_hash?: string | null;
  thold_price?: number | null;
}

export interface LatestVaultProfile {
  block_timestamp?: number | null;
  client_pubkey?: string | null;
  coin_id?: string | null;
  contract_id?: string | null;
  guard_members?: string[] | null;
  guard_pubkey?: string | null;
  price_commits?: LatestPriceCommit[] | null;
  price_stamp?: number | null;
  root_txid?: string | null;
  thold_price?: number | null;
  unit_balance?: number | null;
  unit_price?: number | null;
  vault_action?: string | null;
  vault_balance?: number | null;
  vault_config?: { label?: string | null } | null;
  vault_ratio?: number | null;
  vault_script?: string | null;
  vault_value?: number | null;
  vault_version?: number | null;
}

type LatestVaultProfilesResponse =
  | LatestVaultProfile
  | LatestVaultProfile[]
  | { data?: LatestVaultProfile[] };

const vaultHistoryInFlight = new Map<string, Promise<VaultHistoryTransaction[]>>();
const vaultDataInFlight = new Map<string, Promise<VaultData | null>>();
const vaultLatestHistoryInFlight = new Map<string, Promise<VaultHistoryTransaction | undefined>>();
const VAULT_HISTORY_PAGE_LIMIT = 250;
const VAULT_HISTORY_MAX_PAGES = 20;

export interface FetchVaultDataOptions {
  /**
   * Latest transaction is useful for debug/detail callers, but it requires a
   * second validator request. Keep the default fast for first-paint vault UI.
   */
  includeLatestTransaction?: boolean;
}

export interface FetchVaultHistoryOptions {
  /** Reuse an already-known root txid to avoid an extra /vault/pubkey round trip. */
  vaultId?: string;
  /** Maximum number of history rows to keep from the validator response. */
  limit?: number;
  /** Maximum number of pages to request. Defaults to full historical scan. */
  maxPages?: number;
  /** History lookback window. Defaults to 18 months. */
  lookbackDays?: number;
}

export interface FetchLatestVaultHistoryOptions {
  /** Require transaction_id + utxo for signing a follow-up vault operation. */
  requireUsablePrevout?: boolean;
  /** Maximum number of history rows to keep from the validator response. */
  limit?: number;
  /** Maximum number of pages to request. */
  maxPages?: number;
}

const isValidPrice = (price: unknown): price is number => (
  typeof price === 'number'
  && Number.isFinite(price)
  && price > 0
  && price < 10_000_000
);

const firstValidPrice = (...prices: unknown[]): number | undefined => prices.find(isValidPrice);
const SATS_PER_BTC = 100_000_000;
const CENTS_PER_UNIT = 100;

function vaultApiPath(path: string): string {
  return `${API.VAULT.replace(/\/$/, '')}${path}`;
}

function unwrapVaultProfiles(response: LatestVaultProfilesResponse): LatestVaultProfile[] {
  if (Array.isArray(response)) {
    return response;
  }

  if ('data' in response && Array.isArray(response.data)) {
    return response.data;
  }

  return [response as LatestVaultProfile];
}

function getCoinId(profile: LatestVaultProfile): string | undefined {
  const coinId = profile.coin_id?.trim();
  if (coinId) {
    return coinId;
  }

  const rootTxid = profile.root_txid?.trim();
  return rootTxid ? `${rootTxid}:0` : undefined;
}

function getCoinTxid(profile: LatestVaultProfile): string | undefined {
  return getCoinId(profile)?.split(':')[0];
}

function getRootTxid(profile: LatestVaultProfile): string | undefined {
  return profile.root_txid?.trim() || getCoinTxid(profile);
}

function getProfileTimestamp(profile: LatestVaultProfile): number {
  return profile.block_timestamp ?? profile.price_stamp ?? 0;
}

function getProfileOraclePrice(profile: LatestVaultProfile): number | undefined {
  return firstValidPrice(profile.unit_price, profile.price_commits?.[0]?.base_price);
}

function getProfileVaultBalanceSats(profile: LatestVaultProfile): number {
  return profile.vault_balance ?? profile.vault_value ?? 0;
}

function getProfileUnitBalanceCents(profile: LatestVaultProfile): number {
  return profile.unit_balance ?? 0;
}

function getProfileAction(profile: LatestVaultProfile): string {
  return profile.vault_action?.trim() || 'open';
}

function latestProfileToVaultListVault(profile: LatestVaultProfile): VaultListVault | null {
  const rootTxid = getRootTxid(profile);
  const coinId = getCoinId(profile);
  const oraclePrice = getProfileOraclePrice(profile);

  if (!rootTxid || !coinId || !profile.client_pubkey || !profile.guard_pubkey || !oraclePrice) {
    return null;
  }

  const priceCommit = profile.price_commits?.[0];
  const label = profile.vault_config?.label?.trim();
  const vaultBalanceSats = getProfileVaultBalanceSats(profile);
  const unitBalanceCents = getProfileUnitBalanceCents(profile);

  return {
    vault_id: rootTxid,
    vault_tag: label || rootTxid.slice(0, 12),
    btc_locked: vaultBalanceSats / SATS_PER_BTC,
    unit_borrowed: unitBalanceCents / CENTS_PER_UNIT,
    vault_pubkey: profile.client_pubkey,
    collateral_ratio: profile.vault_ratio ? profile.vault_ratio * 100 : undefined,
    creation_account: profile.client_pubkey,
    guard_pubkey: profile.guard_pubkey,
    master_id: profile.contract_id ?? '',
    liquidation_hash: priceCommit?.thold_hash ?? '',
    liquidation_price: profile.thold_price ?? priceCommit?.thold_price ?? 0,
    oracle_price: oraclePrice,
    oracle_timestamp: profile.price_stamp ?? getProfileTimestamp(profile),
    utxo: coinId,
    vault_last_action: getProfileAction(profile),
    vault_version: profile.vault_version ?? 3,
    latest_profile: profile,
  };
}

function latestProfilesToHistory(profiles: LatestVaultProfile[]): VaultHistoryTransaction[] {
  const chronological = [...profiles]
    .filter((profile) => getCoinId(profile) && getCoinTxid(profile))
    .sort((left, right) => getProfileTimestamp(left) - getProfileTimestamp(right));

  const history = chronological.map((profile, index): VaultHistoryTransaction => {
    const previous = index > 0 ? chronological[index - 1] : undefined;
    const vaultAmount = getProfileVaultBalanceSats(profile);
    const unitAmount = getProfileUnitBalanceCents(profile);
    const previousVaultAmount = previous ? getProfileVaultBalanceSats(previous) : 0;
    const previousUnitAmount = previous ? getProfileUnitBalanceCents(previous) : 0;
    const priceCommit = profile.price_commits?.[0];

    return {
      amount_borrowed: unitAmount,
      vault_amount: vaultAmount,
      btc_amt: vaultAmount - previousVaultAmount,
      unit_amt: unitAmount - previousUnitAmount,
      oracle_price: getProfileOraclePrice(profile) ?? 0,
      timestamp: getProfileTimestamp(profile),
      action: getProfileAction(profile),
      transaction_id: getCoinTxid(profile),
      root_txid: getRootTxid(profile),
      utxo: getCoinId(profile),
      utxo_script: profile.vault_script ?? '',
      liquidation_hash: priceCommit?.thold_hash ?? '',
      liquidation_threshold: profile.thold_price ?? priceCommit?.thold_price ?? 0,
      latest_profile: profile,
    };
  });

  return history.sort((left, right) => right.timestamp - left.timestamp);
}

async function fetchVaultProfilesByPubkey(vaultPubkey: string): Promise<LatestVaultProfile[]> {
  const response = await getJSON<LatestVaultProfilesResponse>(
    vaultApiPath(`/vault/pubkey/${encodeURIComponent(vaultPubkey)}`),
    {
      description: 'Fetch vaults by pubkey',
      circuitKey: 'validator-vault-pubkey',
    }
  );
  return unwrapVaultProfiles(response);
}

async function fetchVaultHistoryProfilesByRootTxid(rootTxid: string): Promise<LatestVaultProfile[]> {
  const response = await getJSON<LatestVaultProfilesResponse>(
    vaultApiPath(`/vault/${encodeURIComponent(rootTxid)}/history`),
    {
      description: 'Fetch vault history',
      circuitKey: 'validator-vault-history',
    }
  );
  return unwrapVaultProfiles(response);
}

async function dedupeInFlight<T>(
  requests: Map<string, Promise<T>>,
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }

  const request = loader();
  requests.set(key, request);

  try {
    return await request;
  } finally {
    if (requests.get(key) === request) {
      requests.delete(key);
    }
  }
}

function hasUsableVaultPrevout(
  transaction: VaultHistoryTransaction | null | undefined
): transaction is VaultHistoryTransaction & { transaction_id: string; utxo: string } {
  return Boolean(transaction?.transaction_id && transaction.utxo);
}

export function selectLatestUsableVaultHistoryTransaction(
  transactions: VaultHistoryTransaction[]
): VaultHistoryTransaction | undefined {
  return selectLatestVaultHistoryTransaction(transactions.filter(hasUsableVaultPrevout));
}

export function selectLatestVaultHistoryTransaction(
  transactions: VaultHistoryTransaction[]
): VaultHistoryTransaction | undefined {
  let latest: VaultHistoryTransaction | undefined;

  for (const transaction of transactions) {
    if (!latest || transaction.timestamp > latest.timestamp) {
      latest = transaction;
    }
  }

  return latest;
}

async function fetchVaultHistoryByVaultId(
  vaultId: string,
  lookbackDays: number,
  options: { limit?: number; maxPages?: number } = {}
): Promise<VaultHistoryTransaction[]> {
  const now = Math.floor(Date.now() / 1000);
  const lookbackStart = now - lookbackDays * 24 * 60 * 60;
  const limit = options.limit ?? VAULT_HISTORY_PAGE_LIMIT;
  const maxPages = options.maxPages ?? VAULT_HISTORY_MAX_PAGES;
  const profiles = await fetchVaultHistoryProfilesByRootTxid(vaultId);
  const allHistory = latestProfilesToHistory(profiles)
    .filter((transaction) => transaction.timestamp >= lookbackStart && transaction.timestamp <= now)
    .slice(0, limit * maxPages);

  if (allHistory.length >= limit * maxPages) {
    logger.warn('Vault history reached pagination limit before latest selection', {
      vaultId,
      fetched: allHistory.length,
      limit,
      maxPages,
    });
  }

  return allHistory;
}

export async function fetchLatestVaultHistoryTransaction(
  vaultId: string,
  lookbackDays = 30,
  options: FetchLatestVaultHistoryOptions = {}
): Promise<VaultHistoryTransaction | undefined> {
  return dedupeInFlight(
    vaultLatestHistoryInFlight,
    [
      vaultId,
      lookbackDays,
      options.requireUsablePrevout ? 'usable' : 'any',
      options.limit ?? VAULT_HISTORY_PAGE_LIMIT,
      options.maxPages ?? VAULT_HISTORY_MAX_PAGES,
    ].join(':'),
    async () => {
      const history = await fetchVaultHistoryByVaultId(vaultId, lookbackDays, options);
      return options.requireUsablePrevout
        ? selectLatestUsableVaultHistoryTransaction(history)
        : selectLatestVaultHistoryTransaction(history);
    }
  );
}

const fetchVaultHistoryUncached = async (
  vaultPubkey: string,
  options: FetchVaultHistoryOptions = {}
): Promise<VaultHistoryTransaction[]> => {
  try {
    let vaultId = options.vaultId?.trim();

    if (!vaultId) {
      const profiles = await fetchVaultProfilesByPubkey(vaultPubkey);
      const firstProfile = profiles[0];
      vaultId = firstProfile ? getRootTxid(firstProfile) : undefined;
    }

    if (!vaultId) {
      return [];
    }

    const lookbackDays = options.lookbackDays ?? 540;
    return fetchVaultHistoryByVaultId(vaultId, lookbackDays, {
      limit: options.limit,
      maxPages: options.maxPages,
    });
  } catch (error: unknown) {
    logger.warn('Failed to fetch vault history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

export const fetchVaultHistory = async (
  vaultPubkey: string,
  options: FetchVaultHistoryOptions = {}
): Promise<VaultHistoryTransaction[]> => {
  if (!vaultPubkey) {
    return [];
  }

  const cacheKey = [
    vaultPubkey,
    options.vaultId ?? 'lookup',
    options.limit ?? 250,
    options.maxPages ?? 20,
    options.lookbackDays ?? 540,
  ].join(':');

  return dedupeInFlight(
    vaultHistoryInFlight,
    cacheKey,
    () => fetchVaultHistoryUncached(vaultPubkey, options)
  );
};

const fetchVaultDataUncached = async (
  vaultPubkey: string,
  options: FetchVaultDataOptions = {}
): Promise<VaultData | null> => {
  try {
    logger.debug('[VaultService] Fetching vault data for pubkey:', { vaultPubkey });

    const profiles = await fetchVaultProfilesByPubkey(vaultPubkey);
    const vaults = profiles
      .map(latestProfileToVaultListVault)
      .filter((vault): vault is VaultListVault => vault !== null);

    logger.debug('[VaultService] Number of vaults found:', { count: vaults.length });

    if (vaults.length === 0) {
      logger.debug('[VaultService] No vaults found for this pubkey - vault not created yet');
      return null;
    }

    // If multiple vaults exist for this pubkey, always use the FIRST one
    if (vaults.length > 1) {
      logger.debug('[VaultService] MULTIPLE VAULTS FOUND for this pubkey - using FIRST vault:');
      vaults.forEach((vault, index) => {
        logger.debug(`  Vault ${index + 1}:`, {
          vault_id: vault.vault_id,
          vault_tag: vault.vault_tag,
          btc_locked: vault.btc_locked,
          unit_borrowed: vault.unit_borrowed,
        });
      });
      logger.debug('[VaultService] Selected: Using vault #1 (first in array)');
    }

    // Always use first vault in the array
    const firstVault = vaults[0];
    if (!firstVault) {
      return null;
    }

    const vaultId = firstVault.vault_id;
    const vaultTag = firstVault.vault_tag;
    logger.debug('[VaultService] Using vault:', { vault_id: vaultId, vault_tag: vaultTag });

    const listOraclePrice = firstValidPrice(firstVault.oracle_price);
    const latestHistoryTransaction = (options.includeLatestTransaction || !listOraclePrice)
      ? await fetchLatestVaultHistoryTransaction(vaultId)
      : undefined;
    const oraclePrice = firstValidPrice(
      listOraclePrice,
      latestHistoryTransaction?.oracle_price
    );

    if (!oraclePrice) {
      logger.error('[VaultService] Invalid oracle price in vault data', {
        vaultId,
        oracle_price: firstVault.oracle_price,
        latest_history_oracle_price: latestHistoryTransaction?.oracle_price,
      });
    }

    // Validate required fields for vault operations before constructing VaultInfo
    const requiredFields = {
      vault_pubkey: firstVault.vault_pubkey,
      creation_account: firstVault.creation_account,
      guard_pubkey: firstVault.guard_pubkey,
      master_id: firstVault.master_id,
      utxo: firstVault.utxo,
    } as const;

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      logger.warn('[VaultService] Vault missing required fields', {
        vaultId,
        missingFields,
      });
    }

    // Construct full VaultInfo for borrow/deposit/repay/withdraw operations
    const vaultInfo: VaultInfo | undefined = missingFields.length === 0 && oraclePrice ? {
      vault_id: firstVault.vault_id,
      vault_tag: firstVault.vault_tag,
      vault_pubkey: requiredFields.vault_pubkey!,
      btc_locked: firstVault.btc_locked,
      unit_borrowed: firstVault.unit_borrowed,
      collateral_ratio: firstVault.collateral_ratio || 0,
      creation_account: requiredFields.creation_account!,
      guard_pubkey: requiredFields.guard_pubkey!,
      master_id: requiredFields.master_id!,
      liquidation_hash: firstVault.liquidation_hash || '',
      liquidation_price: firstVault.liquidation_price || 0,
      oracle_price: oraclePrice,
      oracle_timestamp: firstVault.oracle_timestamp || latestHistoryTransaction?.timestamp || 0,
      utxo: requiredFields.utxo!,
      vault_last_action: firstVault.vault_last_action || latestHistoryTransaction?.action || '',
      vault_version: firstVault.vault_version || 1,
      latest_profile: firstVault.latest_profile,
    } : undefined;

    // Build the vault data object
    const vaultData: VaultData = {
      vaultId,
      vaultTag,
      totalDebt: firstVault.unit_borrowed,
      totalCollateral: firstVault.btc_locked,
      currentPrice: oraclePrice,
      ...(vaultInfo ? { vaultInfo } : {}),
    };

    // Add latest transaction if history exists
    if (latestHistoryTransaction) {
      vaultData.latestTransaction = {
        amountBorrowed: latestHistoryTransaction.amount_borrowed,
        vaultAmount: latestHistoryTransaction.vault_amount,
        btcAmount: latestHistoryTransaction.btc_amt,
        unitAmt: latestHistoryTransaction.unit_amt,
        oraclePrice: firstValidPrice(latestHistoryTransaction.oracle_price, oraclePrice) ?? 0,
        timestamp: latestHistoryTransaction.timestamp,
        action: latestHistoryTransaction.action,
      };
    }

    logger.debug('[VaultService] Vault data fetched successfully (first vault only):', {
      vaultTag,
      totalDebt: firstVault.unit_borrowed,
      totalCollateral: firstVault.btc_locked,
      currentPrice: oraclePrice,
      hasVaultInfo: !!vaultInfo?.creation_account,
    });

    return vaultData;
  } catch (error: unknown) {
    logger.warn('[VaultService] Error fetching vault data:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

export const fetchVaultData = async (
  vaultPubkey: string,
  options: FetchVaultDataOptions = {}
): Promise<VaultData | null> => {
  if (!vaultPubkey) {
    logger.debug('[VaultService] fetchVaultData: No vaultPubkey provided');
    return null;
  }

  const cacheKey = `${vaultPubkey}:${options.includeLatestTransaction ? 'latest' : 'fast'}`;
  return dedupeInFlight(
    vaultDataInFlight,
    cacheKey,
    () => fetchVaultDataUncached(vaultPubkey, options)
  );
};
