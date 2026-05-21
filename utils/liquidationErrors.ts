const STALE_OPPORTUNITY_PATTERNS = [
  /utxo spent/i,
  /spent or not exist/i,
  /validation of repovault failed/i,
];

export function isStaleLiquidationOpportunityError(error: string | null | undefined): boolean {
  if (!error) {
    return false;
  }

  return STALE_OPPORTUNITY_PATTERNS.some((pattern) => pattern.test(error));
}

export function getStaleLiquidationOpportunityMessage(remainingVaultCount: number): string {
  const count = Math.max(0, remainingVaultCount);

  if (count === 0) {
    return 'Seems like someone got to this yield opportunity before you did. There are no other vaults left to liquidate right now.';
  }

  if (count === 1) {
    return 'Seems like someone got to this yield opportunity before you did. There is 1 other vault still left to liquidate. Want to try again?';
  }

  return `Seems like someone got to this yield opportunity before you did. There are ${count} other vaults still left to liquidate. Want to try again?`;
}
