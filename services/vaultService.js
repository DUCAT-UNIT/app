import { postWithRetry, fetchPaginated } from '../utils/apiClient';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';

export const fetchVaultHistory = async (vaultPubkey) => {
  try {
    if (!vaultPubkey) {
      return [];
    }

    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await postWithRetry(
      `${API.VAULT}/vault_list`,
      { vault_pubkey: vaultPubkey },
      { description: 'Fetch vault list' }
    );

    const vaultListData = await vaultListResponse.json();

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      return [];
    }

    const vaultId = vaultListData.vaults[0].vault_id;

    // Step 2: Get all vault history with pagination
    const now = Math.floor(Date.now() / 1000);
    const eighteenMonthsAgo = now - 540 * 24 * 60 * 60; // 18 months of history

    // Use unified pagination utility
    const allHistory = await fetchPaginated(
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
        const data = await response.json();
        return data.history || [];
      },
      { limit: 250, maxPages: 20 }
    );

    return allHistory;
  } catch (error) {
    return [];
  }
};

export const fetchVaultData = async (vaultPubkey) => {
  try {
    if (!vaultPubkey) {
      logger.debug('⚠️ fetchVaultData: No vaultPubkey provided');
      return null;
    }

    logger.debug('🏦 Fetching vault data for pubkey:', vaultPubkey);

    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await postWithRetry(
      `${API.VAULT}/vault_list`,
      { vault_pubkey: vaultPubkey },
      { description: 'Fetch vault data list' }
    );

    const vaultListData = await vaultListResponse.json();
    logger.debug('🏦 Vault list response:', vaultListData);
    logger.debug('🏦 Number of vaults found:', vaultListData.vaults?.length || 0);

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      logger.debug('⚠️ No vaults found for this pubkey - vault not created yet');
      return null;
    }

    // If multiple vaults exist for this pubkey, always use the FIRST one
    if (vaultListData.vaults.length > 1) {
      logger.debug('⚠️ MULTIPLE VAULTS FOUND for this pubkey - using FIRST vault:');
      vaultListData.vaults.forEach((vault, index) => {
        logger.debug(`  Vault ${index + 1}:`, {
          vault_id: vault.vault_id,
          vault_tag: vault.vault_tag,
          btc_locked: vault.btc_locked,
          unit_borrowed: vault.unit_borrowed,
        });
      });
      logger.debug('📌 Selected: Using vault #1 (first in array)');
    }

    // Always use first vault in the array
    const vaultId = vaultListData.vaults[0].vault_id;
    const vaultTag = vaultListData.vaults[0].vault_tag;
    logger.debug('🏦 Using vault:', { vault_id: vaultId, vault_tag: vaultTag });

    // Step 2: Get vault history to retrieve transaction details
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const vaultHistoryResponse = await postWithRetry(
      `${API.VAULT}/vault_history_tx`,
      {
        vault_id: vaultId,
        timestamp_start: thirtyDaysAgo,
        timestamp_end: now,
        pagination: { limit: 250, offset: 0 },
      },
      { description: 'Fetch vault data history' }
    );

    const vaultHistoryData = await vaultHistoryResponse.json();

    if (!vaultHistoryData.history || vaultHistoryData.history.length === 0) {
      // Use data from first vault only (not totals across all vaults)
      const firstVault = vaultListData.vaults[0];
      return {
        vaultTag,
        totalDebt: firstVault.unit_borrowed,
        totalCollateral: firstVault.btc_locked,
        currentPrice: vaultListData.current_price,
      };
    }

    const latestTransaction = vaultHistoryData.history[0];

    // Use data from first vault only (not totals across all vaults)
    const firstVault = vaultListData.vaults[0];
    const vaultData = {
      vaultId,
      vaultTag,
      totalDebt: firstVault.unit_borrowed,
      totalCollateral: firstVault.btc_locked,
      currentPrice: vaultListData.current_price,
      latestTransaction: {
        amountBorrowed: latestTransaction.amount_borrowed,
        vaultAmount: latestTransaction.vault_amount,
        btcAmount: latestTransaction.btc_amt,
        unitAmt: latestTransaction.unit_amt,
        oraclePrice: latestTransaction.oracle_price,
        timestamp: latestTransaction.timestamp,
        action: latestTransaction.action,
      },
    };

    logger.debug('✅ Vault data fetched successfully (first vault only):', {
      vaultTag,
      totalDebt: firstVault.unit_borrowed,
      totalCollateral: firstVault.btc_locked,
    });

    return vaultData;
  } catch (error) {
    logger.error('❌ Error fetching vault data:', error);
    return null;
  }
};
