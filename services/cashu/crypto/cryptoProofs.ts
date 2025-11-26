/**
 * Crypto Proofs - Proof creation and selection operations
 */

export interface CashuProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
  witness?: string;
}

/**
 * Create proof from blinded signature
 * @param amount - Amount of this proof
 * @param secret - Secret used for blinding
 * @param C - Unblinded signature
 * @param id - Keyset ID
 * @returns Cashu proof
 */
export const createProof = (amount: number, secret: string, C: string, id: string): CashuProof => {
  return {
    amount,
    secret,
    C,
    id,
  };
};

/**
 * Split amount into powers of 2 (for efficient change)
 * Example: 100 -> [64, 32, 4]
 * @param amount - Amount to split
 * @returns Array of amounts (powers of 2)
 */
export const splitAmount = (amount: number): number[] => {
  const amounts: number[] = [];
  let remaining = amount;

  // Standard denominations from high to low
  const denominations = [16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];

  for (const denom of denominations) {
    while (remaining >= denom) {
      amounts.push(denom);
      remaining -= denom;
    }
  }

  return amounts;
};

/**
 * Sum proof amounts
 * @param proofs - Array of proofs
 * @returns Total amount in display units (divided by 100)
 */
export const sumProofs = (proofs: CashuProof[]): number => {
  const totalSmallestUnits = proofs.reduce((sum, proof) => sum + proof.amount, 0);
  // Convert from smallest units to display units (divide by 100)
  return totalSmallestUnits / 100;
};

/**
 * Select proofs for amount
 * @param proofs - Available proofs
 * @param amount - Target amount
 * @returns Selected proofs
 */
export const selectProofsForAmount = (proofs: CashuProof[], amount: number): CashuProof[] => {
  // Strategy: Try to find an exact match first, then minimize change

  // Only try exact match if we have a reasonable number of proofs
  // Subset sum is exponential O(2^n), so limit to prevent hanging
  if (proofs.length <= 15) {
    const exactMatch = findExactMatch(proofs, amount);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Otherwise, use greedy algorithm (smallest to largest to minimize change)
  const sorted = [...proofs].sort((a, b) => a.amount - b.amount);

  const selected: CashuProof[] = [];
  let total = 0;

  for (const proof of sorted) {
    if (total >= amount) break;
    selected.push(proof);
    total += proof.amount;
  }

  if (total < amount) {
    throw new Error(`Insufficient funds: have ${total}, need ${amount}`);
  }

  return selected;
};

// Helper: Find exact match for amount using subset sum
const findExactMatch = (proofs: CashuProof[], target: number): CashuProof[] | null => {
  // Simple recursive subset sum - finds ANY combination that equals target
  const find = (index: number, remaining: number, selected: CashuProof[]): CashuProof[] | null => {
    if (remaining === 0) return selected;
    if (index >= proofs.length || remaining < 0) return null;

    // Try including current proof
    const withCurrent = find(index + 1, remaining - proofs[index].amount, [...selected, proofs[index]]);
    if (withCurrent) return withCurrent;

    // Try excluding current proof
    return find(index + 1, remaining, selected);
  };

  return find(0, target, []);
};
