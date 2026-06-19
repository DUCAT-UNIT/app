/**
 * @fileoverview Randomization helpers.
 */

/**
 * Non-deterministic comparator for shuffling array contents via `Array.sort`.
 *
 * Uses `Math.random`, so it is NOT cryptographically secure and must not be
 * used where unpredictable or unbiased randomness is required.
 * @returns `1` or `-1` chosen at random
 */
export const RANDOM_SORT = () : number => Math.random() > 0.5 ? 1 : -1
