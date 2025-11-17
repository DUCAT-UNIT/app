/**
 * Balance Service - Wallet balance and UTXO fetching
 */

import { getWithRetry, getJSON, fetchParallel } from '../utils/apiClient';
import { getAddressUrl, getAddressUtxoUrl, getOrdAddressUrl, API_KEYS } from '../utils/constants';
import { satsToBTC } from '../utils/bitcoin/conversions';

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

  // Use unified parallel fetch utility
  const [segwitBalance, taprootBalance, runesBalance] = await fetchParallel([
    {
      name: 'SegWit balance',
      fn: async () => {
        const data = await getJSON(getAddressUrl(segwitAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          description: 'Fetch SegWit balance',
        });
        const totalReceived = data.chain_stats?.funded_txo_sum || 0;
        const totalSpent = data.chain_stats?.spent_txo_sum || 0;
        return satsToBTC(totalReceived - totalSpent);
      },
      defaultValue: 0,
    },
    {
      name: 'Taproot balance',
      fn: async () => {
        const data = await getJSON(getAddressUrl(taprootAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          description: 'Fetch Taproot balance',
        });
        const totalReceived = data.chain_stats?.funded_txo_sum || 0;
        const totalSpent = data.chain_stats?.spent_txo_sum || 0;
        return satsToBTC(totalReceived - totalSpent);
      },
      defaultValue: 0,
    },
    {
      name: 'Runes balance',
      fn: async () => {
        const data = await getJSON(getOrdAddressUrl(taprootAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          headers: { Accept: 'application/json' },
          description: 'Fetch Runes balance',
        });
        return data.runes_balances || [];
      },
      defaultValue: [],
    },
  ]);

  return { segwitBalance, taprootBalance, runesBalance };
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

  const utxoData = await getJSON(getAddressUtxoUrl(address), {
    description: 'Fetch UTXOs',
  });

  // Transform UTXO data into format needed for PSBT
  return utxoData.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    status: utxo.status,
  }));
};

/**
 * Fetch current BTC price in USD
 * @returns {Promise<number|null>} BTC price in USD, or null if unavailable
 */
export const fetchBtcPrice = async () => {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

    // Optionally include API key if configured (increases rate limits)
    const headers = {};
    if (API_KEYS.COINGECKO) {
      headers['x-cg-demo-api-key'] = API_KEYS.COINGECKO;
    }

    const data = await getJSON(url, {
      headers,
      description: 'Fetch BTC price',
    });

    return data.bitcoin.usd;
  } catch (error) {
    return null;
  }
};
