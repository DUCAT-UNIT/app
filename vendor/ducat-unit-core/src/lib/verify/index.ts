/**
 * @fileoverview Trust-boundary verification helpers for proto profiles, price contracts,
 * and vault profiles. Each function throws on invalid input; on success,
 * the verified object is safe to consume by downstream code.
 *
 * Action-level verification (liquidate / repo / trim transition checks,
 * including the breach-chain enforcement for Finding #4) lives in the
 * rule modules under `@/lib/vault/verify/rules/` — specifically the
 * `verify_vault_liquidate` and `verify_vault_repo_liquidated`
 * functions which compose the helpers in this module.
 *
 * Verification happens at trust boundaries — see
 * `dev/docs/CONVENTIONS.md` for the contract.
 */

export { verify_proto_profile }                                from './proto.js'
export { verify_price_contract, verify_active_price_contract } from './price.js'
export { verify_vault_profile }                                from './vault.js'
export { verify_signed_utxo }                                  from './utxo.js'
