const STALE_OPPORTUNITY_PATTERNS = [
  /utxo spent/i,
  /spent or not exist/i,
  /already claimed/i,
  /already liquidated/i,
  /already repossessed/i,
  /failed to find utxo/i,
  /input for outpoint/i,
  /vault coin .* already spent/i,
  /vault.*already.*(?:claimed|liquidated|repossessed)/i,
];

function extractLiquidationErrorText(error: string): string {
  const parts = [error];

  try {
    const parsed = JSON.parse(error) as Record<string, unknown>;
    if (typeof parsed.message === 'string') {
      parts.push(parsed.message);
    }
    if (typeof parsed.error === 'string') {
      parts.push(parsed.error);
    }
  } catch {
    // Guardian errors are not guaranteed to be JSON.
  }

  return parts
    .join(' ')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isStaleLiquidationOpportunityError(error: string | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const text = extractLiquidationErrorText(error);
  return STALE_OPPORTUNITY_PATTERNS.some((pattern) => pattern.test(text));
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
