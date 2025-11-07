/**
 * Balance Service - Wallet balance and UTXO fetching
 */

import { fetchWithTimeout } from '../utils/api';
import { fetchWithRetry, retrySilently } from '../utils/retry';

const BALANCE_FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch wallet balances for SegWit, Taproot, and Runes
 * @param {string} segwitAddress - SegWit address
 * @param {string} taprootAddress - Taproot address
 * @returns {Promise<{segwitBalance: number, taprootBalance: number, runesBalance: array}>}
 */
export const fetchWalletBalances = async (segwitAddress, taprootAddress) => {
  if (!segwitAddress || !taprootAddress) {
    throw new Error('Both segwit and taproot addresses are required');
  }

  const results = await Promise.allSettled([
    // Fetch SegWit balance with retry
    retrySilently(async () => {
      const res = await fetchWithTimeout(`https://mutinynet.com/api/address/${segwitAddress}`, {}, BALANCE_FETCH_TIMEOUT);
      const data = await res.json();
      const totalReceived = data.chain_stats?.funded_txo_sum || 0;
      const totalSpent = data.chain_stats?.spent_txo_sum || 0;
      return (totalReceived - totalSpent) / 100000000;
    }, 'Fetch SegWit balance'),

    // Fetch Taproot balance with retry
    retrySilently(async () => {
      const res = await fetchWithTimeout(`https://mutinynet.com/api/address/${taprootAddress}`, {}, BALANCE_FETCH_TIMEOUT);
      const data = await res.json();
      const totalReceived = data.chain_stats?.funded_txo_sum || 0;
      const totalSpent = data.chain_stats?.spent_txo_sum || 0;
      return (totalReceived - totalSpent) / 100000000;
    }, 'Fetch Taproot balance'),

    // Fetch RUNES balance with retry
    retrySilently(async () => {
      const res = await fetchWithTimeout(
        `https://ord-mutinynet.ducatprotocol.com/address/${taprootAddress}`,
        { headers: { 'Accept': 'application/json' } },
        BALANCE_FETCH_TIMEOUT
      );
      const data = await res.json();
      return data.runes_balances || [];
    }, 'Fetch Runes balance')
  ]);

  // Extract results or use defaults on failure
  const segwitBalance = results[0].status === 'fulfilled' ? results[0].value : 0;
  const taprootBalance = results[1].status === 'fulfilled' ? results[1].value : 0;
  const runesBalance = results[2].status === 'fulfilled' ? results[2].value : [];

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const balanceType = ['SegWit', 'Taproot', 'Runes'][index];
    }
  });

  return {
    segwitBalance,
    taprootBalance,
    runesBalance,
  };
};

/**
 * Fetch UTXOs for a given address
 * @param {string} address - Bitcoin address
 * @returns {Promise<Array>} Array of formatted UTXOs
 */
export const fetchUtxos = async (address) => {
  if (!address) {
    throw new Error('Address is required');
  }

  return retrySilently(async () => {
    const response = await fetch(`https://mutinynet.com/api/address/${address}/utxo`);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }

    const utxoData = await response.json();

    // Transform UTXO data into format needed for PSBT
    return utxoData.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      status: utxo.status,
    }));
  }, 'Fetch UTXOs');
};

/**
 * Fetch current BTC price in USD
 * @returns {Promise<number|null>} BTC price in USD, or null if unavailable
 */
export const fetchBtcPrice = async () => {
  try {
    return await retrySilently(async () => {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) {
        throw new Error(`Failed to fetch BTC price: ${response.statusText}`);
      }
      const data = await response.json();
      return data.bitcoin.usd;
    }, 'Fetch BTC price');
  } catch (error) {
    console.error('Failed to fetch BTC price:', error);
    return null;
  }
};
