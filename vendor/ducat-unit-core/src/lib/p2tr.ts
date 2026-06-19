/**
 * @fileoverview Single-key P2TR derivation helpers.
 */

import { Buff, Bytes }       from '@vbyte/buff'
import { encode_taptweak }   from '@vbyte/btc-dev/taproot'
import {
  get_pubkey,
  tweak_pubkey,
  tweak_seckey
} from '@vbyte/crypto/ecc'
import { Assert }            from '@vbyte/util/assert'

import { assert_bip340_pubkey } from '@/validate/assert.js'

export interface KeypathSpendSigner {
  internal_pubkey : string
  output_pubkey   : string
  seckey          : string
}

/** Derive the BIP341 tweaked output key from an internal BIP340 pubkey. */
export function derive_taproot_output_key (
  pubkey : string
) : string {
  assert_bip340_pubkey(pubkey)
  const tweak = encode_taptweak(pubkey)
  return tweak_pubkey(pubkey, tweak, 'bip340', true).hex
}

/** Derive the final single-key P2TR locking script from an internal pubkey. */
export function derive_p2tr_script (
  pubkey : string
) : string {
  return `5120${derive_taproot_output_key(pubkey)}`
}

/** Derive the tweaked signing key for a single-key P2TR key-path spend. */
export function derive_keypath_spend_signer (
  seckey : Bytes
) : KeypathSpendSigner {
  const secret = new Buff(seckey).hex
  const internal_pubkey = get_pubkey(secret, 'bip340').hex
  const tweak = encode_taptweak(internal_pubkey)
  const tweaked_seckey = tweak_seckey(secret, tweak, true).hex
  return {
    internal_pubkey,
    output_pubkey : get_pubkey(tweaked_seckey, 'bip340').hex,
    seckey        : tweaked_seckey
  }
}

/** Assert a prevout script matches the tweaked script for an internal key. */
export function assert_keypath_script (
  script : Uint8Array | string,
  pubkey : string
) : void {
  const actual = script instanceof Uint8Array ? new Buff(script).hex : script
  const expected = derive_p2tr_script(pubkey)
  Assert.ok(actual === expected, `invalid single-key p2tr script: expected ${expected}, got ${actual}`)
}
