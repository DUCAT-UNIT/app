/**
 * @fileoverview Guardian input-signing utilities for spend, cosign, and liquidation paths.
 */

import { Buff }                        from '@vbyte/buff'
import { Assert }                      from '@vbyte/util/assert'
import {
  sign_bip340,
  verify_bip340
} from '@vbyte/crypto/ecc'
import { TaprootControlBlock }         from '@scure/btc-signer'

import * as PSBT from '../psbt/index.js'
import {
  assert_keypath_script,
  derive_keypath_spend_signer
} from './p2tr.js'
import { parse_cosigner_script }       from './script.js'

import { read_signer_seckey } from '../class/cosigner.js'

import type { GuardianSigner } from '../class/cosigner.js'

/** BIP-340 Schnorr signature length: 64 bytes (R: 32 bytes, s: 32 bytes) */
const SCHNORR_SIG_LENGTH = 64

/**
 * Validates a BIP-340 Schnorr signature format and optionally verifies it
 * cryptographically against a message and pubkey.
 * @param sig - The signature bytes to validate
 * @param context - Optional context string for error messages
 * @param sighash - Optional sighash to verify the signature against
 * @param pubkey - Optional pubkey to verify the signature against
 * @throws {Error} If the signature format is invalid or verification fails
 */
function validate_schnorr_signature (
  sig      : Uint8Array,
  context  : string = 'signature',
  sighash? : Uint8Array,
  pubkey?  : string
): void {
  Assert.exists(sig, `${context} is missing`)
  Assert.ok(
    sig.length === SCHNORR_SIG_LENGTH,
    `${context} has invalid length: expected ${SCHNORR_SIG_LENGTH} bytes, got ${sig.length} bytes`
  )
  // If sighash and pubkey are provided, verify the signature cryptographically.
  if (sighash !== undefined && pubkey !== undefined) {
    const is_valid = verify_bip340(sig, sighash, pubkey)
    Assert.ok(is_valid, `${context} failed cryptographic verification against expected pubkey`)
  }
}

/** Build guardian input-signing API collection. */
export function sign_inputs_api (guardian : GuardianSigner) {
  return {
    cosign    : cosign_vault_input_api(guardian),
    liquidate : sign_liquid_input_api(guardian),
    spend     : sign_spend_input_api(guardian)
  }
}

/** Sign key-path spend input and finalize witness for a specific input index. */
function sign_spend_input_api (guard : GuardianSigner) {
  return (psbt : string, index : number) => {
    // Parse the PSBT data into an object.
    const pdata    = PSBT.parse_psbt(psbt)
    // Fetch the input of the PSBT.
    const vinput   = pdata.getInput(index)
    const prevout  = vinput.witnessUtxo
    Assert.exists(prevout, 'witnessUtxo is missing')
    // Parse the prevouts from the PSBT.
    const prevouts = PSBT.get_psbt_prevouts(pdata)
    // Compute the sighash for the transaction.
    const sighash  = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts)
    // Fresh single-key P2TR outputs always use the tweaked key-path script.
    assert_keypath_script(prevout.script, guard.pubkey)
    const signer   = derive_keypath_spend_signer(read_signer_seckey(guard))

    // Sign the transaction sighash with the mock MPC group seckey.
    const mpc_sig = sign_bip340(signer.seckey, sighash)
    // Update the vault prevout input with a finalized script witness.
    pdata.updateInput(index, { finalScriptWitness: [ mpc_sig ] })
    // Return the updated PSBT data.
    return PSBT.encode_psbt(pdata)
  }
}

/**
 * Sign liquidation script-path input and finalize witness with preimage.
 */
export function sign_liquid_input_api (
  guard : GuardianSigner
) {
  return (psbt : string, index : number) => {
    // Parse the PSBT data into an object.
    const pdata  = PSBT.parse_psbt(psbt)
    // Fetch the input of the PSBT (vault prevout).
    const vinput = pdata.getInput(index)
    // Fetch the prevout data for the input.
    const odata  = vinput.witnessUtxo
    // Assert that witnessUtxo exists.
    Assert.exists(odata, 'witnessUtxo is missing')
    // Validate array lengths before accessing elements.
    Assert.ok(vinput.tapLeafScript !== undefined && vinput.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing')
    Assert.ok(vinput.hash160 !== undefined && vinput.hash160.length > 0, 'hash160 array is empty or missing')
    // Fetch the first tapleaf script for the input.
    const tdata = vinput.tapLeafScript[0]
    // Fetch the first hash pre-image for the input.
    const hdata = vinput.hash160[0]
    // Validate tdata structure before accessing nested properties.
    Assert.ok(tdata[1] !== undefined && tdata[1].length > 0, 'tapLeaf script data is empty')
    // Parse the script bytes from the PSBT tapleaf input.
    const script  = tdata[1].slice(0, -1)
    // Define arrays for the prevout scripts and values.
    const prevouts = PSBT.get_psbt_prevouts(pdata)
    // Compute the sighash for the transaction.
    const sighash = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts, undefined, script)

    // Sign the transaction sighash with the mock MPC group seckey.
    const mpc_sig = sign_bip340(read_signer_seckey(guard), sighash)
    // Create the control block from the PSBT input data.
    const cblock  = TaprootControlBlock.encode(tdata[0])
    // Liquidation path includes the preimage from hash160 witness metadata.
    // Create the witness array for spending the vault prevout.
    const witness = [ mpc_sig, hdata[1], script, cblock ]
    // Update the vault prevout input with a finalized script witness.
    pdata.updateInput(index, { finalScriptWitness: witness })
    // Return the updated PSBT data.
    return PSBT.encode_psbt(pdata)
  }
}

/**
 * Co-sign vault script-path input after validating client Schnorr signature.
 */
export function cosign_vault_input_api (guard : GuardianSigner) {
  return (psbt : string, index : number) => {
    // Parse the PSBT data into an object.
    const pdata  = PSBT.parse_psbt(psbt)
    // Fetch the input of the PSBT (vault prevout).
    const vinput = pdata.getInput(index)
    // Fetch the prevout data for the input.
    const odata  = vinput.witnessUtxo
    // Assert that witnessUtxo exists.
    Assert.exists(odata, 'witnessUtxo is missing')
    // Validate array lengths before accessing elements.
    Assert.ok(vinput.tapLeafScript !== undefined && vinput.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing')
    Assert.ok(vinput.tapScriptSig !== undefined && vinput.tapScriptSig.length > 0, 'tapScriptSig array is empty or missing')
    // Fetch the first tapleaf script for the input.
    const tdata = vinput.tapLeafScript[0]
    // Fetch the first tapscript signature for the input.
    const sdata = vinput.tapScriptSig[0]
    // Validate tdata structure before accessing nested properties.
    Assert.ok(tdata[1] !== undefined && tdata[1].length > 0, 'tapLeaf script data is empty')
    // Parse the script bytes from the PSBT tapleaf input.
    const script  = tdata[1].slice(0, -1)
    // Define arrays for the prevout scripts and values.
    const prevouts = PSBT.get_psbt_prevouts(pdata)
    // Compute the sighash for the transaction.
    const sighash = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts, undefined, script)

    // Sign the transaction sighash with the mock MPC group seckey.
    const mpc_sig   = sign_bip340(read_signer_seckey(guard), sighash)
    // Get the vault signature from tapScriptSig data.
    const vault_sig = sdata[1]
    // Extract the client pubkey from the cosigner script for cryptographic verification.
    const script_hex    = new Buff(script).hex
    const script_parsed = parse_cosigner_script(script_hex)
    // Guard against malformed vault/client signatures before witness assembly.
    // Validate the signature format AND verify it cryptographically against the client pubkey.
    validate_schnorr_signature(vault_sig, 'vault signature', sighash, script_parsed.client_pubkey)
    // Create the control block from the PSBT input data.
    const cblock  = TaprootControlBlock.encode(tdata[0])
    // Create the witness array for spending the vault prevout.
    const witness = [ mpc_sig, vault_sig, script, cblock ]
    // Update the vault prevout input with a finalized script witness.
    pdata.updateInput(index, { finalScriptWitness: witness })
    // Return the updated PSBT data.
    return PSBT.encode_psbt(pdata)
  }
}
