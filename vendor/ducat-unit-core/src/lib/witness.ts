/**
 * @fileoverview Parse and validate witness data — extract commit info from
 * inscription envelopes embedded in tapscript witnesses, derive author pubkeys
 * and inscription content, and compute commit references for linking.
 */

import { Buff }                from '@vbyte/buff'
import { hash160 }             from '@vbyte/crypto/hash'
import { parse_witness }       from '@vbyte/btc-dev/witness'
import { decode_script }       from '@vbyte/btc-dev/script'
import { Assert, Test }        from '@vbyte/util'
import { CBLOCK_VERSION }      from '../const.js'

import {
  decode_inscriptions,
  has_inscription
} from './inscribe.js'

import {
  assert_commit_id,
  decode_commit_id,
  encode_coin_id
} from './pointer.js'

import type { WitnessData }                from '@vbyte/btc-dev'
import type { ProtoTxData, WitnessCommit } from '../types/index.js'

/** Compute stable commit reference hash from commit id fields. */
export function get_commit_ref (
  commit_id : string
) : string {
  // Assert that the commit id is valid.
  assert_commit_id(commit_id)
  // Decode the commit id.
  const { txid, index } = decode_commit_id(commit_id)
  // Convert the index to a 4-byte array.
  const uint = Buff.num(index, 4)
  // Return the hash of the txid and uint to get the commit ref.
  return hash160(txid, uint).hex
}

/** Locate a witness commit by sequence code. */
export function find_witness_commit (
  commits : WitnessCommit[],
  code    : number
) : WitnessCommit | null {
  return commits.find(c => c.seq_code === code) ?? null
}

/** Extract all inscription-backed witness commits from a transaction. */
export function parse_witness_commits (
  txdata : ProtoTxData
) : WitnessCommit[] {
  // Unpack the txdata.
  const txid = txdata.txid
  // Initialize the commits array.
  const commits : WitnessCommit[] = []
  // Initialize the commit counter.
  let commit_count = 0
  // Iterate over the vin data.
  for (const [ index, vin ] of txdata.vin.entries()) {
    // Unpack the vin data.
    const { sequence, witness } = vin
    // If the sequence type is not metadata, skip.
    if (sequence.type !== 'metadata') continue
    // Check that the witness data is valid.
    const err = verify_witness_payload(witness)
    // If the witness data is invalid, skip.
    if (err !== null) continue
    // Assert the witness data is a p2ts.
    Assert.exists(witness.script, 'witness script not found')
    // If the witness data does not have an inscription, skip.
    if (!has_inscription(witness.script)) continue
    // Get the author pubkey.
    const author    = parse_author_pubkey(witness.script)
    // Parse the inscription envelopes from the script.
    const envelopes = decode_inscriptions(witness.script)
    // Create the records with the id and content.
    for (const env of envelopes) {
      commits.push({
        author,
        coin_id     : encode_coin_id(vin.txid, vin.vout),
        coin_index  : index,
        content     : parse_commit_content(env.content),
        commit_id   : get_commit_id(txid, commit_count++),
        commit_ref  : env.protocol ?? null,
        mimetype    : env.mimetype ?? null,
        seq_code    : sequence.code,
        seq_version : sequence.version,
      })
    }
  }
  // Return the commits.
  return commits
}

/** Parse author pubkey from tapscript lock segment ahead of inscription envelope. */
export function parse_author_pubkey (
  script : string
) : string {
  // Set an array of keywords to search for.
  const keywords = [ 'OP_CHECKSIG', 'OP_CHECKSIGADD' ]
  // Decode the script into words.
  const script_words = decode_script(script)
  // Find the index of the first data word.
  const data_idx = script_words.indexOf('OP_0')
  // If the data index is not found, throw an error.
  Assert.ok(data_idx !== -1, 'inscription envelope not found')
  const lock_words = script_words.slice(0, data_idx)
  // Find the index of the first keyword in the array.
  const opcode_idx = lock_words.findIndex(e => keywords.includes(e))
  // If no signature opcode is found, fail validation.
  Assert.ok(opcode_idx !== -1, 'signature operation not found')
  // Get the public key from the opcode index.
  const pubkey = lock_words.at(opcode_idx - 1)
  Assert.exists(pubkey,  'author public key not found')
  // If the public key is not a valid hash, throw an error.
  Assert.is_hash(pubkey, 'author public key is not valid')
  // Return the public key.
  return pubkey
}

/** Validate witness payload has script, cblock, and expected tapscript version. */
export function verify_witness_payload (
  witness : string[] | WitnessData
) : string | null {
  // Parse the witness data.
  const wdata = (Array.isArray(witness))
    ? parse_witness(witness)
    : witness
  // Assert the script is present.
  if (!Test.exists(wdata.script)) return 'no script found'
  // Assert the cblock is present.
  if (!Test.exists(wdata.cblock)) return 'no cblock found'
  // Assert the witness type is valid.
  if (wdata.type !== 'p2ts')      return 'invalid witness type'
  // Assert the cblock version is valid.
  if (!wdata.cblock.startsWith(CBLOCK_VERSION)) return 'invalid cblock version'
  // Return null if the witness data is valid.
  return null
}

function get_commit_id (
  txid    : string,
  counter : number
) : string {
  // Create the commit id.
  const commit_id = `${txid}i${counter}`
  // Increment the counter.
  counter++
  // Return the commit id.
  return commit_id
}

function parse_commit_content (
  content? : string
) : string | null {
  return (content !== undefined)
    ? Buff.hex(content).str
    : null
}
