/**
 * Crypto Proofs - Proof creation and selection operations
 */

/**
 * Create proof from blinded signature
 * @param {number} amount - Amount of this proof
 * @param {string} secret - Secret used for blinding
 * @param {string} C - Unblinded signature
 * @param {string} id - Keyset ID
 * @returns {Object} Cashu proof
 */
export const createProof = (amount, secret, C, id) => {
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
 * @param {number} amount - Amount to split
 * @returns {Array<number>} Array of amounts (powers of 2)
 */
export const splitAmount = (amount) => {
  const amounts = [];
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
 * @param {Array} proofs - Array of proofs
 * @returns {number} Total amount in display units (divided by 100)
 */
export const sumProofs = (proofs) => {
  const totalSmallestUnits = proofs.reduce((sum, proof) => sum + proof.amount, 0);
  // Convert from smallest units to display units (divide by 100)
  return totalSmallestUnits / 100;
};

/**
 * Select proofs for amount
 * @param {Array} proofs - Available proofs
 * @param {number} amount - Target amount
 * @returns {Array} Selected proofs
 */
export const selectProofsForAmount = (proofs, amount) => {
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

  const selected = [];
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
const findExactMatch = (proofs, target) => {
  // Simple recursive subset sum - finds ANY combination that equals target
  const find = (index, remaining, selected) => {
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
