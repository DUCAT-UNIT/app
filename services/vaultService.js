import { retrySilently } from '../utils/retry';

const VAULT_API_BASE = 'https://validator.ducatprotocol.com/api';

export const fetchVaultHistory = async (vaultPubkey) => {
  try {
    if (!vaultPubkey) {
      console.log('No vault pubkey provided');
      return [];
    }

    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await retrySilently(
      () => fetch(`${VAULT_API_BASE}/vault_list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_pubkey: vaultPubkey,
        }),
      }),
      'Fetch vault list'
    );

    const vaultListData = await vaultListResponse.json();

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      console.log('No vaults found');
      return [];
    }

    const vaultId = vaultListData.vaults[0].vault_id;

    // Step 2: Get vault history
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    const vaultHistoryResponse = await retrySilently(
      () => fetch(`${VAULT_API_BASE}/vault_history_tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_id: vaultId,
          timestamp_start: thirtyDaysAgo,
          timestamp_end: now,
          pagination: {
            limit: 250,
            offset: 0,
          },
        }),
      }),
      'Fetch vault history'
    );

    const vaultHistoryData = await vaultHistoryResponse.json();

    if (!vaultHistoryData.history || vaultHistoryData.history.length === 0) {
      console.log('No vault history found');
      return [];
    }

    // Return the full history array
    return vaultHistoryData.history;
  } catch (error) {
    console.error('Error fetching vault history:', error);
    return [];
  }
};

export const fetchVaultData = async (vaultPubkey) => {
  try {
    if (!vaultPubkey) {
      console.log('No vault pubkey provided');
      return null;
    }

    // Step 1: Get vault list to retrieve vault_id
    const vaultListResponse = await retrySilently(
      () => fetch(`${VAULT_API_BASE}/vault_list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_pubkey: vaultPubkey,
        }),
      }),
      'Fetch vault data list'
    );

    const vaultListData = await vaultListResponse.json();

    if (!vaultListData.vaults || vaultListData.vaults.length === 0) {
      console.log('No vaults found');
      return null;
    }

    const vaultId = vaultListData.vaults[0].vault_id;
    const vaultTag = vaultListData.vaults[0].vault_tag;

    // Step 2: Get vault history to retrieve transaction details
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    const vaultHistoryResponse = await retrySilently(
      () => fetch(`${VAULT_API_BASE}/vault_history_tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_id: vaultId,
          timestamp_start: thirtyDaysAgo,
          timestamp_end: now,
          pagination: {
            limit: 250,
            offset: 0,
          },
        }),
      }),
      'Fetch vault data history'
    );

    const vaultHistoryData = await vaultHistoryResponse.json();

    if (!vaultHistoryData.history || vaultHistoryData.history.length === 0) {
      console.log('No vault history found');
      return {
        vaultTag,
        totalDebt: vaultListData.total_debt,
        totalCollateral: vaultListData.total_collateral,
        currentPrice: vaultListData.current_price,
      };
    }

    const latestTransaction = vaultHistoryData.history[0];

    return {
      vaultId,
      vaultTag,
      totalDebt: vaultListData.total_debt,
      totalCollateral: vaultListData.total_collateral,
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
  } catch (error) {
    console.error('Error fetching vault data:', error);
    return null;
  }
};

