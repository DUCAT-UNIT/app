/**
 * @fileoverview Proto contract helpers — derive anchor_id/contract_id and build proto profiles/templates.
 */

import { Buff }    from '@vbyte/buff'
import { hash340 } from '@vbyte/crypto/hash'

import type {
  AnchorSignerEntry,
  AnchorData,
  ProtoMemberRecord,
  ProtoContractTemplate,
  AssetProfile,
  AnchorContract,
  ProtoProfile,
  ProtoTermRecord,
  AnchorTermEntry
} from '@/types/index.js'

const ANCHOR_ID_PREFIX = 'ducat/anchor_id'
const BIP340_PREFIX = 'ducat/proto_contract_id'

/**
 * Exact set of fields committed to the proto contract_id preimage.
 *
 * Pick'd from ProtoProfile so adding a new profile field never silently
 * gets included in the contract_id without an explicit decision here. The
 * field `chain_height` is intentionally excluded — it changes over time
 * with the chain tip and would make contract_id non-stable.
 */
export type ProtoContractIdInput = Pick<ProtoProfile,
  | 'anchor_id'
  | 'contract_height'
  | 'contract_index'
  | 'contract_txid'
>

/** Compute deterministic anchor id from confirmed anchor placement. */
export function get_anchor_id (
  anchor_height : number,
  anchor_index  : number,
  anchor_txid   : string
) : string {
  const preimage = Buff.json([
    anchor_height,
    anchor_index,
    anchor_txid
  ])
  return hash340(ANCHOR_ID_PREFIX, preimage).hex
}

/**
 * Compute the deterministic protocol contract id: a publication-instance
 * identifier for the active contract snapshot.
 *
 * The preimage commits to:
 *   - Anchor identity: `anchor_id` (which itself commits to anchor_height,
 *     anchor_index, anchor_txid — and so, via `anchor_txid`, to the on-chain
 *     anchor contract that carries chain_network/domain_hash/boot_height and
 *     the protocol terms/members/assets at activation).
 *   - Contract placement: `contract_height`, `contract_index`,
 *     `contract_txid` (the on-chain publication of the active snapshot).
 *
 * `chain_height` is intentionally excluded (it tracks the observed tip and
 * would make the id non-stable).
 *
 * This does NOT directly hash the resolved `proto_terms`/`proto_members`/
 * `proto_assets`. Today that content is fully determined by the anchor
 * contract at `anchor_txid` (governance/contract-updates are not yet
 * implemented), so it is already committed transitively via `anchor_id`.
 * When governance lands, the resulting contract content can no longer be
 * derived from a single placement, and contract identity should be re-bound
 * as a chain commitment (each version committing to its predecessor and its
 * patch) — designed against the on-chain update format at that time.
 */
export function get_proto_contract_id (
  input : ProtoContractIdInput
) : string {
  const preimage = Buff.json([
    input.anchor_id,
    input.contract_height,
    input.contract_index,
    input.contract_txid
  ])
  return hash340(BIP340_PREFIX, preimage).hex
}

/** Convert compact signer tuples into structured protocol member records. */
export function create_proto_member_records (
  data : AnchorSignerEntry[]
) : ProtoMemberRecord[] {
  const profiles : ProtoMemberRecord[] = []
  for (const mbr of data) {
    const [ group, idx, pubkey ] = mbr
    profiles.push({ idx, group, pubkey })
  }
  return profiles
}

/** Convert compact term tuples into structured protocol term records. */
export function create_proto_term_records (
  data : AnchorTermEntry[]
) : ProtoTermRecord[] {
  return data.map(term => ({
    group : term[0],
    key   : term[1],
    value : term.slice(2)
  }))
}

/** Build protocol contract template from anchor contract inputs. */
export function create_proto_template (
  assets          : AssetProfile[],
  contract        : AnchorContract,
  contract_height : number,
  contract_index  : number,
  contract_txid   : string,
  chain_height    : number = contract_height
) : ProtoContractTemplate {
  // Create the contract data object.
  return {
    contract_height,
    contract_index,
    contract_txid,
    chain_height,
    proto_assets  : assets,
    proto_members : create_proto_member_records(contract.signers),
    proto_terms   : create_proto_term_records(contract.terms)
  }
}

/** Merge anchor state and contract template into full protocol profile. */
export function create_proto_profile (
  anchor_data    : AnchorData,
  proto_template : ProtoContractTemplate
) : ProtoProfile {
  // Compute the contract id from the merged inputs.
  const merged      = { ...anchor_data, ...proto_template }
  const contract_id = get_proto_contract_id(merged)
  // Return the proto profile.
  return { ...merged, contract_id }
}
