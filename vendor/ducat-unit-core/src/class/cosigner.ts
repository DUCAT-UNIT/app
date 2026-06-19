/**
 * @fileoverview Guardian signer wrapper exposing signing APIs over a single key.
 */

import { Buff, Bytes }         from '@vbyte/buff'
import { P2TR }                from '@vbyte/btc-dev/address'
import { get_pubkey }          from '@vbyte/crypto/ecc'

import { derive_taproot_output_key } from '../lib/p2tr.js'
import { to_address_network }        from '../lib/chain.js'

import { sign_inputs_api }        from '../lib/cosigner.js'
import { sign_vault_request_api } from '../lib/handler.js'

import type { ChainNetwork, ProtoProfile } from '../types/index.js'

// Module-private store for signer secret keys (Codex F06). The raw key
// is kept OFF the GuardianSigner instance entirely — there is no
// `seckey` getter and no `_seckey` field — so holding a signer object
// no longer yields a key-extraction primitive. The signing helpers read
// the key via `read_signer_seckey` below, which is intentionally not
// re-exported from any package entry point — neither the root barrel nor
// `@/lib` (the signing helper functions are public, but this accessor is not).
const SIGNER_SECKEYS = new WeakMap<GuardianSigner, Buff>()

/** Guardian signing facade used for input-level signatures and request handlers. */
export class GuardianSigner {

  private readonly _address : string
  private readonly _proto   : ProtoProfile
  private readonly _pubkey  : Buff

  constructor (
    proto  : ProtoProfile,
    seckey : Bytes
  ) {
    this._proto   = proto
    const sk      = new Buff(seckey)
    SIGNER_SECKEYS.set(this, sk)
    this._pubkey  = get_pubkey(sk, 'bip340')
    const tapkey  = Buff.hex(derive_taproot_output_key(this._pubkey.hex))
    this._address = P2TR.create_address(tapkey, to_address_network(this.network))
  }

  /** Taproot address for this guardian signer on configured network. */
  get address () : string {
    return this._address
  }

  /** Configured chain network from proto profile. */
  get network () : ChainNetwork {
    return this._proto.chain_network
  }

  /** Backing proto profile. */
  get proto () : ProtoProfile {
    return this._proto
  }

  /** X-only BIP340 pubkey as hex. */
  get pubkey () : string {
    return this._pubkey.hex
  }

  /** Signing APIs for input-level signatures and request-level signing flows. */
  get sign () {
    return {
      input   : sign_inputs_api(this),
      request : sign_vault_request_api(this)
    }
  }
}

/**
 * Read the secret key backing a GuardianSigner. Internal to the signing
 * module — NOT re-exported from `src/index.ts` or any public package entry
 * point (Codex F06). Signing helpers use this instead of a public `seckey`
 * getter on the class.
 */
export function read_signer_seckey (signer : GuardianSigner) : string {
  const sk = SIGNER_SECKEYS.get(signer)
  if (sk === undefined) {
    throw new Error('guardian signer secret key is not registered')
  }
  return sk.hex
}
