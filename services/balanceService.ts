/**
 * Balance Service - Wallet balance and UTXO fetching
 */

import { getJSON, fetchParallel } from '../utils/apiClient';
import { getAddressUrl, getAddressUtxoUrl, getOrdAddressUrl, API_KEYS, API } from '../utils/constants';
import { satsToBTC } from '../utils/bitcoin/conversions';
import { e2eVaultState } from '../utils/e2eVaultState';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';

const BALANCE_FETCH_TIMEOUT = 10000; // 10 seconds
const OVERALL_FETCH_TIMEOUT = 30000; // 30 seconds - ceiling for entire fetchWalletBalances

export interface RuneBalance {
  rune: string;
  runeid?: string;
  amount: string;
  divisibility: number;
  symbol?: string;
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
  bitcoin?: {
    usd?: number;
  };
  ethereum?: {
    usd?: number;
  };
}

interface DucatPriceServerResponse {
  price?: number;
  curr_price?: number;
  current_price?: number;
}

const isValidUsdPrice = (price: unknown): price is number => (
  typeof price === 'number'
  && Number.isFinite(price)
  && price > 0
  && price < 10_000_000
);

const getCoinGeckoHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (API_KEYS.COINGECKO) {
    headers['x-cg-demo-api-key'] = API_KEYS.COINGECKO;
  }
  return headers;
};

const extractBtcUsdPrice = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as DucatPriceServerResponse & Partial<CoinGeckoResponse>;
  const candidates = [
    response.price,
    response.curr_price,
    response.current_price,
    response.bitcoin?.usd,
  ];

  const price = candidates.find(isValidUsdPrice);
  return price ?? null;
};

const extractEthUsdPrice = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as Partial<CoinGeckoResponse>;
  const price = response.ethereum?.usd;
  return isValidUsdPrice(price) ? price : null;
};

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

  // Use unified parallel fetch utility with an overall timeout ceiling.
  // Individual fetches have BALANCE_FETCH_TIMEOUT, but Promise.allSettled (inside fetchParallel)
  // could hang if something goes wrong. This outer timeout guarantees the caller is never stuck.
  const fetchOperation = fetchParallel<number | RuneBalance[]>([
    {
      name: 'SegWit balance',
      fn: async () => {
        const data = await getJSON<AddressData>(getAddressUrl(segwitAddress), {
          timeout: BALANCE_FETCH_TIMEOUT,
          description: 'Fetch SegWit balance',
        });
        const totalReceived = data.chain_stats?.funded_txo_sum || 0;
        const totalSpent = data.chain_stats?.spent_txo_sum || 0;
        const balance = totalReceived - totalSpent;
        logger.info('[balanceService] SegWit raw:', { totalReceived, totalSpent, balance, btc: satsToBTC(balance) });
        if (balance < 0) {
          logger.warn('Negative balance detected, returning 0', {
            addressType: 'segwit',
            totalReceived,
            totalSpent,
            calculated: balance,
          });
          return 0;
        }
        return satsToBTC(balance);
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
        const balance = totalReceived - totalSpent;
        logger.info('[balanceService] Taproot raw:', { totalReceived, totalSpent, balance, btc: satsToBTC(balance) });
        if (balance < 0) {
          logger.warn('Negative balance detected, returning 0', {
            addressType: 'taproot',
            totalReceived,
            totalSpent,
            calculated: balance,
          });
          return 0;
        }
        return satsToBTC(balance);
      },
      defaultValue: 0 as number | RuneBalance[],
    },
    {
      name: 'Runes balance',
      fn: async () => {
        // Legacy fixture path: return fake Runes balance when requested.
        // Note: ord indexer returns amounts in display format (divisibility already applied)
        // so getRunesAmount uses parseFloat(amount) directly
        if (isE2E() && e2eVaultState.vaultCreated && e2eVaultState.unitBorrowed > 0) {
          return [{
            rune: 'DUCAT•UNIT•RUNE',
            runeid: '1527352:1',
            amount: String(e2eVaultState.unitBorrowed),
            divisibility: 2,
            symbol: '¤',
          }] as RuneBalance[];
        }
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

  let overallTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const overallTimeout = new Promise<(number | RuneBalance[])[]>((_, reject) => {
    overallTimeoutId = setTimeout(() => reject(new Error('Overall balance fetch timed out')), OVERALL_FETCH_TIMEOUT);
    (overallTimeoutId as { unref?: () => void }).unref?.();
  });

  let results: (number | RuneBalance[])[];
  try {
    results = await Promise.race([fetchOperation, overallTimeout]);
  } catch (error) {
    logger.error('[balanceService] Overall balance fetch timed out after ' + OVERALL_FETCH_TIMEOUT + 'ms, returning default zeros', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { segwitBalance: 0, taprootBalance: 0, runesBalance: [] };
  } finally {
    if (overallTimeoutId) {
      clearTimeout(overallTimeoutId);
    }
  }

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
  const ducatPriceUrl = `${API.PRICE_SERVER}/api/price/latest`;

  try {
    const data = await getJSON<DucatPriceServerResponse>(ducatPriceUrl, {
      timeout: BALANCE_FETCH_TIMEOUT,
      description: 'Fetch BTC price from DUCAT price server',
    });
    const price = extractBtcUsdPrice(data);
    if (price) {
      return price;
    }

    logger.warn('[balanceService] DUCAT price server returned invalid BTC price', { data });
  } catch (error: unknown) {
    logger.debug('[balanceService] DUCAT price server unavailable, falling back to CoinGecko', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const url = `${API.COINGECKO}/simple/price?ids=bitcoin&vs_currencies=usd`;

    const data = await getJSON<CoinGeckoResponse>(url, {
      headers: getCoinGeckoHeaders(),
      description: 'Fetch BTC price',
    });

    return extractBtcUsdPrice(data);
  } catch (error: unknown) {
    logger.debug('[balanceService] Failed to fetch BTC price from all sources', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Fetch current ETH price in USD.
 * Sepolia ETH itself is testnet-only, but the wallet uses mainnet ETH/USD as
 * the reference price for portfolio math and gas balance visibility.
 * @returns ETH price in USD, or null if unavailable
 */
export const fetchEthPrice = async (): Promise<number | null> => {
  try {
    const url = `${API.COINGECKO}/simple/price?ids=ethereum&vs_currencies=usd`;
    const data = await getJSON<CoinGeckoResponse>(url, {
      headers: getCoinGeckoHeaders(),
      timeout: BALANCE_FETCH_TIMEOUT,
      description: 'Fetch ETH price',
    });

    return extractEthUsdPrice(data);
  } catch (error: unknown) {
    logger.debug('[balanceService] Failed to fetch ETH price', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
