/**
 * @fileoverview OP_RETURN parsing helpers for protocol transaction outputs.
 */

import { Buff }           from '@vbyte/buff'
import { OP_RETURN_CODE } from '../const.js'

import type { OpReturnData, ProtoTxOutput } from '../types/index.js'

/** Decode OP_RETURN marker/code from script, if script is OP_RETURN formatted. */
export function get_op_return_data (
  script_pk : string
) : OpReturnData | null {
  // Convert the script to bytes.
  const bytes = Buff.hex(script_pk)
  // Get the magic code from the script.
  const magic = bytes.at(0)
  // If the magic code is undefined, return null.
  if (magic === undefined)      return null
  // If the magic code is not OP_RETURN, return null.
  if (magic !== OP_RETURN_CODE) return null
  // Get the code from the script.
  const code = bytes.at(1)
  // If the code is undefined, return null.
  if (code === undefined)       return null
  // Return the code and script.
  return { code, script : script_pk }
}

/** Find first OP_RETURN output in a transaction output set. */
export function find_opreturn_output (
  vout : ProtoTxOutput[]
) : ProtoTxOutput | null {
  return vout.find(vout => vout.type === 'opreturn') ?? null
}
