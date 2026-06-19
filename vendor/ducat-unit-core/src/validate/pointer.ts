/**
 * @fileoverview Format validators for protocol identifiers.
 *
 * Identifier formats:
 * - Commit ID: '{txid}i{index}' — a specific commit/inscription
 * - Block ID:  '{height}:{tx_index}' — a transaction by block position
 * - Coin ID:   '{txid}:{vout}' — a specific UTXO (outpoint format)
 */

/**
 * Check if a string is a valid commit ID format.
 *
 * @param commit_id - The string to check
 * @returns True if valid commit ID format
 */
export function is_commit_id (
  commit_id : string
) : boolean {
  return commit_id.match(/^[a-f0-9]{64}i\d+$/) !== null
}

/**
 * Assert that a string is a valid commit ID format.
 *
 * @param commit_id - The string to validate
 * @throws Error if not a valid commit ID
 */
export function assert_commit_id (
  commit_id : string
) : void {
  if (!is_commit_id(commit_id)) {
    throw new Error(`invalid commit ID format: '${commit_id}' (expected: {txid}i{index})`)
  }
}

/**
 * Check if a string is a valid block ID format.
 *
 * @param block_id - The string to check
 * @returns True if valid block ID format
 */
export function is_block_id (
  block_id : string
) : boolean {
  return block_id.match(/^\d+:\d+$/) !== null
}

/**
 * Assert that a string is a valid block ID format.
 *
 * @param block_id - The string to validate
 * @throws Error if not a valid block ID
 */
export function assert_block_id (
  block_id : string
) : void {
  if (!is_block_id(block_id)) {
    throw new Error(`invalid block ID format: '${block_id}' (expected: {height}:{tx_index})`)
  }
}

/**
 * Check if a string is a valid coin ID format (outpoint).
 *
 * @param coin_id - The string to check
 * @returns True if valid coin ID format
 */
export function is_coin_id (
  coin_id : string
) : boolean {
  return coin_id.match(/^[a-f0-9]{64}:[0-9]+$/) !== null
}

/**
 * Assert that a string is a valid coin ID format.
 *
 * @param coin_id - The string to validate
 * @throws Error if not a valid coin ID
 */
export function assert_coin_id (
  coin_id : string
) : void {
  if (!is_coin_id(coin_id)) {
    throw new Error(`invalid coin ID format: '${coin_id}' (expected: {txid}:{vout})`)
  }
}
