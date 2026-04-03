/**
 * Helper to safely extract runes amount from balance data
 * Handles both array format [rune, amount, symbol] and object format {rune, amount, symbol}
 */

/**
 * Parse a runes amount string using integer arithmetic to avoid
 * floating-point precision issues. Runes amounts from the ord indexer
 * are in display format with divisibility 2 (max 2 decimal places).
 *
 * @param raw - The raw amount string (e.g. "1000.5", "500", "2500.75")
 * @returns The parsed numeric amount, or 0 if invalid
 */
function parseRunesAmount(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;

  const str = raw.trim();
  if (str === '' || !/^-?\d+\.?\d*$/.test(str)) return 0;

  // Reject negatives
  if (str.startsWith('-')) return 0;

  const parts = str.split('.');
  const whole = parseInt(parts[0] || '0', 10);

  if (parts.length === 1) return whole;

  // Use up to 2 decimal places (runes divisibility = 2)
  const fracRaw = (parts[1] || '').slice(0, 2);
  const fracPadded = fracRaw.padEnd(2, '0');
  const fractional = parseInt(fracPadded, 10);

  // Reconstruct: whole + fractional / 100
  // Using integer math: (whole * 100 + fractional) / 100
  return (whole * 100 + fractional) / 100;
}

export const getRunesAmount = (runesBalance: unknown[] | null | undefined): number => {
  if (!runesBalance || runesBalance.length === 0) return 0;
  const first = runesBalance[0];
  // Array format: [rune, amount, symbol]
  if (Array.isArray(first)) {
    return parseRunesAmount(first[1] as string);
  }
  // Object format: { rune, amount, symbol }
  if (typeof first === 'object' && first !== null && 'amount' in first) {
    return parseRunesAmount((first as { amount: string }).amount);
  }
  return 0;
};
