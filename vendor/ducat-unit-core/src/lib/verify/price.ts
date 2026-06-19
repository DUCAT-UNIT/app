/**
 * @fileoverview Trust-boundary verification for price contracts.
 *
 * Two named entry points so the caller's intent is explicit:
 *
 *   - `verify_price_contract`         — base verification.
 *                                       Accepts any contract state
 *                                       (active or breached).
 *   - `verify_active_price_contract`  — base + asserts the contract
 *                                       is in its untriggered "active"
 *                                       form (`thold_key === null`).
 *                                       Use at vault open/borrow time
 *                                       where binding a breached
 *                                       contract would create an
 *                                       immediately-liquidatable vault.
 *
 * The naming mirrors the existing `validate_price_contract` /
 * `validate_breached_price_contract` pair in `@/lib/price/validate.js`.
 *
 * Both functions throw on invalid input; on success, the contract is
 * safe to consume by downstream code.
 *
 * Closes Codex findings:
 *   - #8  — oracle pubkey must appear in proto.proto_members.
 *   - #18 — `thold_price` must lie in `(0, base_price)`.
 *   - #19 cleanup — active-contract path asserts `thold_key === null`.
 *
 * ## Cross-proto contract reuse — by design
 *
 * Price contracts are signed by oracles over `(oracle_pubkey,
 * chain_network, base_price, base_stamp, thold_price, thold_hash)`
 * — see `get_price_contract_commit_hash` in `@/lib/price/contract.js`.
 * They are deliberately NOT bound to a specific DUCAT protocol
 * (`anchor_id` / `contract_id` of any proto): oracles produce price
 * data without knowing or caring about the protocol(s) consuming it.
 *
 * Practical consequence: if two DUCAT protocols on the same
 * `chain_network` register the same oracle pubkey, a price contract
 * the oracle signs is structurally valid in both. Protocol-level
 * binding is enforced via the `verify_oracle_authorized` membership
 * check below — an oracle's contract is rejected in any proto that
 * does not include the oracle in its registry.
 *
 * Operators who want exclusive oracles run their own oracle instances
 * and register only those keys. Public oracle networks are a legitimate
 * use case and the cross-proto reuse is the deliberate enabler.
 */

import { Assert } from '@vbyte/util'

import { verify_price_contract_signature } from '@/lib/price/contract.js'
import { verify_oracle_authorized }        from '@/lib/price/validate.js'

import type { PriceContract, ProtoProfile } from '@/types/index.js'

/**
 * Verify a price contract end-to-end. Throws on invalid input.
 *
 * Checks performed:
 *   1. Schema + contract_id recomputation + BIP-340 oracle signature.
 *   2. Oracle pubkey is a registered protocol oracle (ORACLE group).
 *   3. `thold_price` is in the open interval `(0, base_price)`.
 *
 * This function accepts contracts in any state — active (untriggered,
 * `thold_key === null`) or breached (revealed, `thold_key !== null`).
 * Callers binding a contract to a vault input must use
 * `verify_active_price_contract` instead.
 *
 * @param contract - The contract to verify.
 * @param proto    - The protocol profile (must already be verified).
 * @throws Error if any check fails.
 */
export function verify_price_contract (
  contract : PriceContract,
  proto    : ProtoProfile
) : void {
  // Structural + signature.
  verify_price_contract_signature(contract)

  // Oracle membership (Codex #8).
  verify_oracle_authorized(contract.oracle_pubkey, proto)

  // Threshold-price range (Codex #18). Open interval (0, base_price).
  Assert.ok(
    contract.thold_price > 0,
    `verify_price_contract: thold_price must be > 0 (got ${contract.thold_price})`
  )
  Assert.ok(
    contract.thold_price < contract.base_price,
    `verify_price_contract: thold_price (${contract.thold_price}) must be < base_price (${contract.base_price})`
  )
}

/**
 * Verify a price contract AND assert it is in the untriggered "active"
 * state (`thold_key === null`).
 *
 * Use this at vault open/borrow time. Binding a breached contract
 * (revealed threshold key) to a vault would make the resulting vault
 * immediately liquidatable, since any party with the revealed key can
 * spend the liquidation leaf.
 *
 * @param contract - The contract to verify.
 * @param proto    - The protocol profile (must already be verified).
 * @throws Error if base verification fails OR if `thold_key !== null`.
 */
export function verify_active_price_contract (
  contract : PriceContract,
  proto    : ProtoProfile
) : void {
  verify_price_contract(contract, proto)
  Assert.ok(
    contract.thold_key === null,
    'verify_active_price_contract: thold_key must be null (contract must not be triggered)'
  )
}
