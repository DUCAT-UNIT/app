/**
 * @fileoverview Vault price-commit encode/decode and embedded price-contract extraction.
 */

import { Buff, Bytes, Stream } from '@vbyte/buff'
import { Assert }              from '@vbyte/util/assert'
import { PRICE_COMMIT_SIZE }   from '@/const.js'
import { sort }                from '@vbyte/util/obj'

import {
  get_oracle_records,
  get_price_contract_commit_hash,
  get_price_contract_id,
  find_oracle_record_by_idx,
  find_oracle_record_by_pubkey
} from '@/lib/index.js'

import type {
  PriceCommitData,
  PriceContract,
  ProtoProfile,
  VaultReturnData
} from '@/types/index.js'

/**
 * Creates price commit payload rows from in-memory price contracts.
 *
 * Maps each price contract to its corresponding oracle signer and extracts
 * the commit data needed for on-chain inclusion.
 *
 * @param price_contracts - The price contracts to convert to commit data.
 * @returns An array of price commit data ready for encoding.
 */
export function create_price_commits (
  price_contracts : PriceContract[]
) : PriceCommitData[] {

  // For each contract, verify and extract the commit data.
  return price_contracts.map((contract) => {
    // Unpack the price contract data.
    const { base_price, thold_hash, thold_price, oracle_sig, oracle_pubkey } = contract
    // Return the price commit data.
    return { base_price, oracle_pubkey, oracle_sig, thold_hash, thold_price }
  })
}

/**
 * Encodes an array of price commits into a binary buffer.
 *
 * Layout:
 * - 1 byte commit count
 * - N commit rows of fixed `PRICE_COMMIT_SIZE`
 *
 * The oracle pubkey in each commit is mapped to its oracle index in the
 * current protocol profile before encoding.
 *
 * @param proto_profile - Active protocol profile used for oracle lookup.
 * @param commits - The price commit data to encode.
 * @returns A buffer containing the encoded price commits.
 */
export function encode_price_commits (
  proto_profile : ProtoProfile,
  price_commits : PriceCommitData[]
) : Buff {
  // Get the oracle pubkeys.
  const oracle_records = get_oracle_records(proto_profile)
  // Initialize the payload array.
  const payload = [ Buff.num(price_commits.length, 1) ]
  // For each price commit, encode the commit data into the payload.
  for (const commit of price_commits) {
    // Find the oracle index for the public key.
    const record = find_oracle_record_by_pubkey(oracle_records, commit.oracle_pubkey)
    // Encode the commit data into the payload.
    payload.push(Buff.num(record.idx,         1))
    payload.push(Buff.num(commit.base_price,  4))
    payload.push(Buff.num(commit.thold_price, 4))
    payload.push(Buff.hex(commit.thold_hash, 20))
    payload.push(Buff.hex(commit.oracle_sig, 64))
  }
  // Return the encoded price commits as a buffer.
  return Buff.join(payload)
}

/**
 * Decodes a binary payload into an array of price commit data.
 *
 * Reverses the encoding performed by encode_price_commits. Expects the payload
 * to have a 1-byte count prefix followed by PRICE_COMMIT_SIZE bytes per commit.
 *
 * @param proto_profile - Active protocol profile used for oracle lookup.
 * @param commit_payload - The binary data to decode.
 * @returns An array of decoded price commit data.
 * @throws If the payload is smaller than the minimum required size.
 * @throws If the payload size does not match the expected size for the commit count.
 */
export function decode_price_commits (
  proto_profile  : ProtoProfile,
  commit_payload : Bytes,
) : PriceCommitData[] {
  // Get the oracle records.
  const oracle_records = get_oracle_records(proto_profile)
  // Ensure the payload is a stream.
  const stream = (commit_payload instanceof Stream)
    ? commit_payload
    : new Stream(commit_payload)
  // Assert that the commit payload is not empty
  Assert.ok(stream.size > 0, `invalid price commits payload: size is zero`)
  // Read the number of price commits from the commit payload.
  const count = stream.read(1).num
  // Assert that there are price commits to decode.
  Assert.ok(count > 0, `no price commits found`)
  // Assert that the payload contains the correct number of price commits.
  Assert.ok(stream.size === (PRICE_COMMIT_SIZE * count), `invalid byte count for price commits: ${stream.size} !== ${PRICE_COMMIT_SIZE * count}`)
  // Initialize the commits array.
  const commits : PriceCommitData[] = []
  // For each price commit, decode the commit data from the payload.
  for (let i = 0; i < count; i++) {
    const oracle_idx  = stream.read(1).num
    const base_price  = stream.read(4).num
    const thold_price = stream.read(4).num
    const thold_hash  = stream.read(20).hex
    const oracle_sig  = stream.read(64).hex
    // Resolve the oracle record.
    const record = find_oracle_record_by_idx(oracle_records, oracle_idx)
    // Add the decoded price commit to the array.
    commits.push({ base_price, oracle_pubkey: record.pubkey, oracle_sig, thold_hash, thold_price })
  }
  // Return the decoded price commits.
  return commits
}

/**
 * Rebuild full price-contract views from vault return payload data.
 *
 * This maps encoded commit entries back into derived contract fields such as
 * `commit_hash` and `contract_id`, anchored to the vault `price_stamp`.
 *
 * Postcondition: `output.length === vault_return.price_commits.length`.
 * When `price_commits` is empty, the output is empty. When commits are
 * present, `price_stamp` must also be present — a missing stamp with
 * non-empty commits indicates the vault data is internally inconsistent
 * and the function throws rather than silently dropping the commits.
 *
 * Every reconstructed contract is hardcoded `thold_key: null` (active /
 * untriggered). Vault return data only carries the threshold *hash*, not
 * the revealed key, so a triggered contract can never propagate through
 * this path even though the PriceContract schema permits a non-null
 * thold_key (Codex #19 — functionally a non-issue; documented here so
 * the schema-vs-runtime gap is explicit).
 */
export function extract_vault_price_contracts (
  proto_profile : ProtoProfile,
  vault_return  : VaultReturnData
) : PriceContract[] {
  // Unpack the vault return data.
  const { price_commits, price_stamp } = vault_return
  // Cleared vault (no commits): return empty. The output-length-matches
  // postcondition trivially holds.
  if (price_commits.length === 0) return []
  // Commits present but no price_stamp to anchor them: vault data is
  // internally inconsistent. Don't silently drop commits — throw so
  // downstream verifiers don't operate on an empty contract list.
  Assert.exists(
    price_stamp,
    'extract_vault_price_contracts: price_stamp must exist when price_commits is non-empty'
  )
  // Define the chain network and proto signers.
  const chain_network = proto_profile.chain_network
  // For each price commit,
  return price_commits.map((commit) => {
    // Unpack the price commit.
    const { base_price, oracle_pubkey, oracle_sig, thold_hash, thold_price } = commit
    // Define the price configuration.
    const price_config  = { base_price, base_stamp: price_stamp, chain_network, oracle_pubkey }
    // Define the commit hash.
    const commit_hash   = get_price_contract_commit_hash(price_config, thold_price)
    // Define the contract id.
    const contract_id   = get_price_contract_id(commit_hash, thold_hash)
    // Return the price contract.
    return sort({ ...price_config, commit_hash, contract_id, oracle_sig, thold_hash, thold_key: null, thold_price })
  })
}
