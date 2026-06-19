/**
 * @fileoverview Signature verification for a UTXO spend given a prevout script,
 * pre-computed sighash, and witness stack.
 *
 * The function dispatches on the prevout script's lock type and runs
 * the matching signature check (BIP-340 for P2TR, ECDSA for P2WPKH).
 * Sighash is pre-computed by the caller — typically via
 * `extract_spend_sighash` in `@/psbt/extract.ts` — keeping this
 * function focused on the cryptographic gate alone.
 *
 * Supported lock types: P2TR keypath, P2WPKH.
 *
 * Not supported (throws with a clear message): P2TR script-path
 * (witness shapes are caller-defined), P2SH-wrapped segwit,
 * legacy P2PKH/P2SH/multisig. Callers needing those types should
 * verify them through their own script-aware path.
 *
 * Closes Codex audit finding F19 (client-sdk) at the primitive layer.
 */

import { Buff }                       from '@vbyte/buff'
import { Assert }                     from '@vbyte/util'
import { hash160 }                    from '@vbyte/crypto/hash'
import { verify_bip340, verify_ecdsa } from '@vbyte/crypto/ecc'
import { get_lock_script_type }       from '@vbyte/btc-dev/script'

/**
 * Verify the witness on a signed UTXO against a pre-computed sighash.
 *
 * Throws on:
 *   - unsupported lock script type
 *   - malformed witness (wrong element count for the script type)
 *   - signature failure
 *   - pubkey-to-script mismatch (P2WPKH)
 *
 * @param prevout_script - Hex-encoded scriptPubKey of the UTXO being
 *                         spent.
 * @param sighash        - Hex-encoded sighash message that was signed.
 * @param witness        - Hex-encoded witness stack elements.
 * @throws Error on any verification failure.
 */
export function verify_signed_utxo (
  prevout_script : string,
  sighash        : string,
  witness        : string[]
) : void {
  const script_type = get_lock_script_type(prevout_script)

  if (script_type === 'p2tr') {
    // P2TR keypath spend: witness is [<signature>] (64 or 65 bytes).
    // Script-path spends carry a control block + script + leaf
    // arguments and aren't handled here.
    Assert.ok(
      witness.length === 1,
      `verify_signed_utxo: p2tr keypath witness must be [signature]; ` +
      `got ${witness.length} elements (script-path is not supported)`
    )
    const signature  = strip_sighash_byte(witness[0])
    const output_key = extract_p2tr_output_key(prevout_script)
    Assert.ok(
      verify_bip340(signature, sighash, output_key),
      'verify_signed_utxo: BIP-340 signature verification failed'
    )
    return
  }

  if (script_type === 'p2wpkh') {
    // P2WPKH spend: witness is [<signature_DER+sighash_byte>, <pubkey>].
    Assert.ok(
      witness.length === 2,
      `verify_signed_utxo: p2wpkh witness must be [signature, pubkey]; ` +
      `got ${witness.length} elements`
    )
    const signature        = strip_sighash_byte(witness[0])
    const pubkey           = witness[1]
    const pk_hash_in_script = extract_p2wpkh_pkh(prevout_script)
    const pk_hash_computed  = hash160(pubkey).hex
    Assert.ok(
      pk_hash_computed === pk_hash_in_script,
      `verify_signed_utxo: witness pubkey hash (${pk_hash_computed}) ` +
      `does not match script (${pk_hash_in_script})`
    )
    Assert.ok(
      verify_ecdsa(signature, sighash, pubkey),
      'verify_signed_utxo: ECDSA signature verification failed'
    )
    return
  }

  throw new Error(`verify_signed_utxo: unsupported lock script type: ${script_type}`)
}

/**
 * Strip a trailing sighash-type byte if present. P2TR Schnorr
 * signatures are 64 bytes (no sighash byte) or 65 bytes (with
 * sighash byte). P2WPKH ECDSA-DER signatures end in a sighash byte
 * appended by the signer. Schnorr/secp libraries verify against the
 * raw signature, so the byte must come off before verification.
 */
function strip_sighash_byte (signature_hex : string) : string {
  const sig_bytes = Buff.hex(signature_hex)
  // For schnorr (64-byte canonical or 65 with sighash):
  if (sig_bytes.length === 65) return sig_bytes.slice(0, 64).hex
  // For ECDSA DER, the sighash byte is the trailing byte. DER
  // length is variable; strip the last byte unconditionally — the
  // DER decoder in verify_ecdsa would otherwise reject the trailing
  // sighash byte.
  if (sig_bytes.length >= 9 && sig_bytes[0] === 0x30) {
    return sig_bytes.slice(0, sig_bytes.length - 1).hex
  }
  return signature_hex
}

/** Extract the 32-byte x-only output key from a P2TR scriptPubKey. */
function extract_p2tr_output_key (script_hex : string) : string {
  // P2TR scriptPubKey: OP_1 (0x51) PUSH_32 (0x20) <32-byte key>.
  const script = Buff.hex(script_hex)
  Assert.ok(
    script.length === 34 && script[0] === 0x51 && script[1] === 0x20,
    `verify_signed_utxo: malformed P2TR scriptPubKey: ${script_hex}`
  )
  return script.slice(2).hex
}

/** Extract the 20-byte pubkey hash from a P2WPKH scriptPubKey. */
function extract_p2wpkh_pkh (script_hex : string) : string {
  // P2WPKH scriptPubKey: OP_0 (0x00) PUSH_20 (0x14) <20-byte hash>.
  const script = Buff.hex(script_hex)
  Assert.ok(
    script.length === 22 && script[0] === 0x00 && script[1] === 0x14,
    `verify_signed_utxo: malformed P2WPKH scriptPubKey: ${script_hex}`
  )
  return script.slice(2).hex
}
