/**
 * @fileoverview Oracle-event staleness predicates.
 *
 * The `max_age_seconds` window is application configuration — each
 * caller (client-sdk, guardian-ts, validator-ts) decides how stale
 * an oracle event they accept based on their own deployment policy.
 * The window is NOT a protocol-contract term.
 */

import { Assert } from '@vbyte/util'

/**
 * Whether an oracle event is fresh relative to a caller-supplied
 * `now_seconds` timestamp and a `max_age_seconds` window.
 *
 * Returns false for future-dated events (clock skew, attacker-supplied
 * timestamps) since those cannot be meaningfully evaluated against an
 * age window.
 *
 * Closes Codex audit finding F07 (client-sdk) at the primitive layer.
 *
 * @param event           - Object carrying the oracle's `base_stamp`
 *                          (Unix epoch seconds). Accepts any record
 *                          with that field — PriceObservation,
 *                          PriceContract, PriceQuote, etc.
 * @param max_age_seconds - Maximum acceptable age in seconds. Must
 *                          be non-negative.
 * @param now_seconds     - Reference "now" timestamp (Unix epoch
 *                          seconds). Caller supplies — no implicit
 *                          `Date.now()` so tests are deterministic.
 * @returns `true` iff `event.base_stamp <= now_seconds` AND
 *          `(now_seconds - event.base_stamp) <= max_age_seconds`.
 */
export function is_oracle_event_fresh (
  event           : { base_stamp : number },
  max_age_seconds : number,
  now_seconds     : number
) : boolean {
  Assert.ok(
    max_age_seconds >= 0,
    `is_oracle_event_fresh: max_age_seconds must be non-negative (got ${max_age_seconds})`
  )
  // Future-dated events are not "fresh" — they're suspect.
  if (event.base_stamp > now_seconds) return false
  return (now_seconds - event.base_stamp) <= max_age_seconds
}
