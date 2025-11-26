/**
 * Price Data Generator Utilities
 * Generate fake price data for assets
 */

export type PriceTimeframe = '1D' | '1W' | '1M' | '1Y';
export type PriceDataPoint = [number, number]; // [timestamp, price]

/**
 * Generate fake UNIT price data that fluctuates between .995 and 1.025
 * @param timeframe - '1D', '1W', '1M', '1Y'
 * @returns Array of [timestamp, price] tuples
 */
export function generateUnitPriceData(timeframe: PriceTimeframe): PriceDataPoint[] {
  const dataPoints = 60; // 60 points for smooth chart
  const data: PriceDataPoint[] = [];
  const now = Date.now();

  // Time intervals based on timeframe
  const intervals: Record<PriceTimeframe, number> = {
    '1D': 24 * 60 * 60 * 1000 / dataPoints, // 1 day in ms divided by points
    '1W': 7 * 24 * 60 * 60 * 1000 / dataPoints, // 1 week
    '1M': 30 * 24 * 60 * 60 * 1000 / dataPoints, // 1 month
    '1Y': 365 * 24 * 60 * 60 * 1000 / dataPoints, // 1 year
  };

  const interval = intervals[timeframe] || intervals['1M'];

  // Generate data points with fluctuations between .995 and 1.025
  let currentPrice = 1.0; // Start at 1.0
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = now - (dataPoints - i - 1) * interval;

    // Random walk with tendency to stay near 1.0
    const change = (Math.random() - 0.5) * 0.01; // Random change between -0.005 and +0.005
    currentPrice = currentPrice + change;

    // Keep within bounds .995 to 1.025
    currentPrice = Math.max(0.995, Math.min(1.025, currentPrice));

    data.push([timestamp, currentPrice]);
  }

  return data;
}
