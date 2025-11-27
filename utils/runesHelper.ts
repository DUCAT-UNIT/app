/**
 * Helper to safely extract runes amount from balance data
 * Handles both array format [rune, amount, symbol] and object format {rune, amount, symbol}
 */
export const getRunesAmount = (runesBalance: unknown[] | null | undefined): number => {
  if (!runesBalance || runesBalance.length === 0) return 0;
  const first = runesBalance[0];
  // Array format: [rune, amount, symbol]
  if (Array.isArray(first)) {
    return parseFloat(first[1] as string) || 0;
  }
  // Object format: { rune, amount, symbol }
  if (typeof first === 'object' && first !== null && 'amount' in first) {
    return parseFloat((first as { amount: string }).amount) || 0;
  }
  return 0;
};
