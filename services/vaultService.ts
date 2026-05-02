import { postWithRetry, fetchPaginated } from '../utils/apiClient';
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
  transaction_id?: string;
  utxo?: string;
  utxo_script?: string;
  liquidation_hash?: string;
  liquidation_threshold?: number;
  compositeSettlement?: boolean;
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
}

interface VaultListResponse {
  vaults: VaultListVault[];
  current_price: number;
  vaults_total?: number;
}

interface VaultHistoryResponse {
  history: VaultHistoryTransaction[];
}

const vaultHistoryInFlight = new Map<string, Promise<VaultHistoryTransaction[]>>();
const vaultDataInFlight = new Map<string, Promise<VaultData | null>>();
const vaultLatestHistoryInFlight = new Map<string, Promise<VaultHistoryTransaction | undefined>>();

export interface FetchVaultDataOptions {
  /**
   * Latest transaction is useful for debug/detail callers, but it requires a
   * second validator request. Keep the default fast for first-paint vault UI.
   */
  includeLatestTransaction?: boolean;
}

const isValidPrice = (price: unknown): price is number => (
  typeof price === 'number'
  && Number.isFinite(price)
  && price > 0
  && price < 10_000_000
);

const firstValidPrice = (...prices: unknown[]): number | undefined => prices.find(isValidPrice);

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

export async function fetchLatestVaultHistoryTransaction(
  vaultId: string,
  lookbackDays = 30
): Promise<VaultHistoryTransaction | undefined> {
  return dedupeInFlight(
    vaultLatestHistoryInFlight,
    `${vaultId}:${lookbackDays}`,
    async () => {
      const now = Math.floor(Date.now() / 1000);
      const lookbackStart = now - lookbackDays * 24 * 60 * 60;

      const vaultHistoryResponse = await postWithRetry(
        `${API.VAULT}/vault_history_tx`,
        {
          vault_id: vaultId,
          timestamp_start: lookbackStart,
          timestamp_end: now,
          pagination: { limit: 1, offset: 0 },
        },
        { description: 'Fetch latest vault transaction' }
      );

      const vaultHistoryData = await vaultHistoryResponse.json() as VaultHistoryResponse;
      return vaultHistoryData.history?.[0];
    }
  );
}

const fetchVaultHistoryUncached = async (vaultPubkey: string): Promise<VaultHistoryTransaction[]> => {
  try {
    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await postWithRetry(
      `${API.VAULT}/vault_list`,
      { vault_pubkey: vaultPubkey },
      { description: 'Fetch vault list' }
    );

    const vaultListData = await vaultListResponse.json() as VaultListResponse;

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      return [];
    }

    const vaultId = vaultListData.vaults[0].vault_id;

    // Step 2: Get all vault history with pagination
    const now = Math.floor(Date.now() / 1000);
    const eighteenMonthsAgo = now - 540 * 24 * 60 * 60; // 18 months of history

    // Use unified pagination utility
    const allHistory = await fetchPaginated<VaultHistoryTransaction>(
      async (offset, limit) => {
        const response = await postWithRetry(
          `${API.VAULT}/vault_history_tx`,
          {
            vault_id: vaultId,
            timestamp_start: eighteenMonthsAgo,
            timestamp_end: now,
            pagination: { limit, offset },
          },
          { description: `Fetch vault history (offset ${offset})` }
        );
        const data = await response.json() as VaultHistoryResponse;
        return data.history || [];
      },
      { limit: 250, maxPages: 20 }
    );

    return allHistory;
  } catch (error: unknown) {
    logger.warn('Failed to fetch vault history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

export const fetchVaultHistory = async (vaultPubkey: string): Promise<VaultHistoryTransaction[]> => {
  if (!vaultPubkey) {
    return [];
  }

  return dedupeInFlight(
    vaultHistoryInFlight,
    vaultPubkey,
    () => fetchVaultHistoryUncached(vaultPubkey)
  );
};

const fetchVaultDataUncached = async (
  vaultPubkey: string,
  options: FetchVaultDataOptions = {}
): Promise<VaultData | null> => {
  try {
    logger.debug('[VaultService] Fetching vault data for pubkey:', { vaultPubkey });

    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await postWithRetry(
      `${API.VAULT}/vault_list`,
      { vault_pubkey: vaultPubkey },
      { description: 'Fetch vault data list' }
    );

    const vaultListData = await vaultListResponse.json() as VaultListResponse;
    logger.debug('[VaultService] Vault list response:', { vaultListData });
    logger.debug('[VaultService] Number of vaults found:', { count: vaultListData.vaults?.length || 0 });

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      logger.debug('[VaultService] No vaults found for this pubkey - vault not created yet');
      return null;
    }

    // If multiple vaults exist for this pubkey, always use the FIRST one
    if (vaultListData.vaults.length > 1) {
      logger.debug('[VaultService] MULTIPLE VAULTS FOUND for this pubkey - using FIRST vault:');
      vaultListData.vaults.forEach((vault, index) => {
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
    const firstVault = vaultListData.vaults[0];
    if (!firstVault) {
      return null;
    }

    const vaultId = firstVault.vault_id;
    const vaultTag = firstVault.vault_tag;
    logger.debug('[VaultService] Using vault:', { vault_id: vaultId, vault_tag: vaultTag });

    const listOraclePrice = firstValidPrice(vaultListData.current_price, firstVault.oracle_price);
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
        current_price: vaultListData.current_price,
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
