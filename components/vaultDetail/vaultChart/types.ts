/**
 * Shared fullscreen vault chart types.
 */

export type PriceTimeframe = '1D' | '1W' | '1M' | '1Y';

export const TIMEFRAMES: PriceTimeframe[] = ['1D', '1W', '1M', '1Y'];

export interface BitcoinData {
  price: string;
  timestamp: number;
}

export interface VaultEvent {
  amount: number;       // UNIT borrowed (converted)
  type: string;
  date: string;         // ISO string
  btcWallet: number;    // BTC in vault (converted)
  oraclePrice: number;
}

export interface SeriesItem {
  date: number;
  healthValue: number | null;
  eventType?: string;
  isEventPoint?: boolean;
  prevValue?: number | null;
}

export interface ReferenceLine {
  date: number;
  txTimestamp: number; // Actual transaction timestamp for filtering
  prevValue: number;
  newValue: number;
  eventType: string;
  btcWallet?: number;
  amount?: number;
}

export interface ScrubData {
  health: number | null;
  x: number | null;
  timestamp: number | null;
}

// Interval configuration matching frontend
export const INTERVAL_CONFIG: Record<PriceTimeframe, { unitLength: number; numberOfUnits: number }> = {
  '1D': { unitLength: 5 * 60, numberOfUnits: 288 },        // 5 min buckets, 288 total
  '1W': { unitLength: 1 * 60 * 60, numberOfUnits: 168 },   // 1 hour buckets, 168 total
  '1M': { unitLength: 6 * 60 * 60, numberOfUnits: 120 },   // 6 hour buckets, 120 total
  '1Y': { unitLength: 24 * 60 * 60, numberOfUnits: 365 },  // 1 day buckets, 365 total
};
