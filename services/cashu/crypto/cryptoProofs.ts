/**
 * Crypto Proofs - Proof creation and selection operations
 */

import type { ProofLike } from '@cashu/cashu-ts';
import {
  normalizeCashuAmount,
  normalizeCashuProof,
  normalizeCashuProofs,
  type CashuAmountLike,
} from '../cashuTsCompat';

export interface CashuProof extends Omit<ProofLike, 'amount' | 'witness'> {
  amount: number;
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
export const createProof = (amount: CashuAmountLike, secret: string, C: string, id: string): CashuProof => {
  return {
    amount: normalizeCashuAmount(amount, 'proof.amount'),
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
export const splitAmount = (amount: CashuAmountLike): number[] => {
  const amounts: number[] = [];
  let remaining = normalizeCashuAmount(amount, 'split amount');

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
 * @returns Total amount in smallest units (integer)
 */
export const sumProofs = (proofs: Array<CashuProof | ProofLike>): number => {
  // Return sum in smallest units (integer) - conversion to display happens in UI
  return proofs.reduce((sum, proof, index) => (
    sum + normalizeCashuAmount(proof.amount, `proofs[${index}].amount`)
  ), 0);
};

/**
 * Select proofs for amount
 * @param proofs - Available proofs
 * @param amount - Target amount
 * @returns Selected proofs
 */
export const selectProofsForAmount = (
  proofs: Array<CashuProof | ProofLike>,
  amount: CashuAmountLike
): CashuProof[] => {
  const normalizedProofs = normalizeCashuProofs(proofs);
  const normalizedAmount = normalizeCashuAmount(amount, 'selection amount');

  // Strategy: Try to find an exact match first, then minimize change

  // Only try exact match if we have a reasonable number of proofs
  // Subset sum is exponential O(2^n), so limit to prevent hanging
  if (normalizedProofs.length <= 15) {
    const exactMatch = findExactMatch(normalizedProofs, normalizedAmount);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Otherwise, use greedy algorithm (smallest to largest to minimize change)
  const sorted = [...normalizedProofs].sort((a, b) => a.amount - b.amount);

  const selected: CashuProof[] = [];
  let total = 0;

  for (const proof of sorted) {
    if (total >= normalizedAmount) break;
    selected.push(proof);
    total += proof.amount;
  }

  if (total < normalizedAmount) {
    throw new Error(`Insufficient funds: have ${total}, need ${normalizedAmount}`);
  }

  return selected;
};

export const normalizeProof = normalizeCashuProof;
export const normalizeProofs = normalizeCashuProofs;

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
