/**
 * @fileoverview Rule-export barrel for vault action verification.
 *
 * Each `verify_vault_<action>` function in this directory is a
 * dedicated entry point for verifying one specific vault action's
 * state transition. Callers dispatch on `vault_action` themselves
 * (or call the matching rule directly) — the rule signatures encode
 * exactly the arguments each action needs at the type level.
 *
 * ## Boundary contract (applies to every rule)
 *
 * - **proto_profile** must have been verified by the caller via
 *   `verify_proto_profile` before invocation. The rules trust the
 *   proto's `contract_id`, member registry, and terms by convention
 *   (verify at trust boundaries; internal code trusts verified
 *   inputs).
 * - **vault_profile** / **prev_profile** are verified by the rule
 *   itself where required — most rules call `verify_vault_profile`
 *   at entry to absorb Findings #1, #8, #9 boundary protection. The
 *   liquidate/trim/repo rules additionally validate the breach-
 *   evidence chain on any `LiquidVaultProfile` they consume.
 * - All rules throw on invalid input. On success the inputs are safe
 *   to consume downstream.
 *
 * Keep one export per vault action.
 */
export * from './open.js'
export * from './deposit.js'
export * from './borrow.js'
export * from './repay.js'
export * from './withdraw.js'
export * from './repo.js'
export * from './trim.js'
export * from './close.js'
export * from './liquidate.js'
