/**
 * Balance Service - Wallet balance and UTXO fetching
 */

import { getJSON, fetchParallel } from '../utils/apiClient';
import { getAddressUrl, getAddressUtxoUrl, getOrdAddressUrl, API_KEYS } from '../utils/constants';
import { satsToBTC } from '../utils/bitcoin/conversions';

const BALANCE_FETCH_TIMEOUT = 10000; // 10 seconds

export interface RuneBalance {
  rune: string;
  amount: string;
  divisibility: number;
  symbol?: string;
  [key: string]: unknown;
}

export interface WalletBalances {
  segwitBalance: number;
  taprootBalance: number;
  runesBalance: RuneBalance[];
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

interface AddressData {
  chain_stats?: {
    funded_txo_sum?: number;
    spent_txo_sum?: number;
  };
}

interface OrdAddressData {
  runes_balances?: RuneBalance[];
}

interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
  };
}

/**
 * Fetch wallet balances for SegWit, Taproot, and Runes
 * @param segwitAddress - SegWit address
 * @param taprootAddress - Taproot address
 * @returns Promise with balances
 */
export const fetchWalletBalances = async (
  segwitAddress: string,
  taprootAddress: string
): Promise<WalletBalances> => {
  if (!segwitAddress || !taprootAddress) {
    throw new Error('Both segwit and taproot addresses are required');
  }

  // Use unified parallel fetch utility
  const results = await fetchParallel<number | RuneBalance[]>([
    {
      name: 'SegWit balance',
      fn: async () => {
        const data = await getJSON<AddressData>(getAddressUrl(segwitAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          description: 'Fetch SegWit balance',
        });
        const totalReceived = data.chain_stats?.funded_txo_sum || 0;
        const totalSpent = data.chain_stats?.spent_txo_sum || 0;
        return satsToBTC(totalReceived - totalSpent);
      },
      defaultValue: 0 as number | RuneBalance[],
    },
    {
      name: 'Taproot balance',
      fn: async () => {
        const data = await getJSON<AddressData>(getAddressUrl(taprootAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          description: 'Fetch Taproot balance',
        });
        const totalReceived = data.chain_stats?.funded_txo_sum || 0;
        const totalSpent = data.chain_stats?.spent_txo_sum || 0;
        return satsToBTC(totalReceived - totalSpent);
      },
      defaultValue: 0 as number | RuneBalance[],
    },
    {
      name: 'Runes balance',
      fn: async () => {
        const data = await getJSON<OrdAddressData>(getOrdAddressUrl(taprootAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          headers: { Accept: 'application/json' },
          description: 'Fetch Runes balance',
        });
        return data.runes_balances || [];
      },
      defaultValue: [] as number | RuneBalance[],
    },
  ]);

  const segwitBalance = results[0] as number;
  const taprootBalance = results[1] as number;
  const runesBalance = results[2] as RuneBalance[];

  return { segwitBalance, taprootBalance, runesBalance };
};

/**
 * Fetch UTXOs for a given address
 * @param address - Bitcoin address
 * @returns Array of formatted UTXOs
 */
export const fetchUtxos = async (address: string): Promise<UTXO[]> => {
  if (!address) {
    throw new Error('Address is required');
  }

  const utxoData = await getJSON<UTXO[]>(getAddressUtxoUrl(address), {
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
 * @returns BTC price in USD, or null if unavailable
 */
export const fetchBtcPrice = async (): Promise<number | null> => {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

    // Optionally include API key if configured (increases rate limits)
    const headers: Record<string, string> = {};
    if (API_KEYS.COINGECKO) {
      headers['x-cg-demo-api-key'] = API_KEYS.COINGECKO;
    }

    const data = await getJSON<CoinGeckoResponse>(url, {
      headers,
      description: 'Fetch BTC price',
    });

    return data.bitcoin.usd;
  } catch (error: unknown) {
    return null;
  }
};
