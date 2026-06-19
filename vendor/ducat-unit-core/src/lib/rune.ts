/**
 * @fileoverview Runestone script helpers for asset transfer edicts.
 */

import { Buff }            from '@vbyte/buff'
import { encodeRunestone } from '@ducat-unit/runestone'
import { decode_block_id } from './pointer.js'

import type { AssetTransferConfig } from '@/types/asset.js'

/**
 * Build a runestone transfer script from one or more asset transfer configs.
 * @param config - Single transfer config or list of transfer configs.
 * @returns Encoded runestone script bytes.
 */
export function create_asset_transfer_script (
  config : AssetTransferConfig | AssetTransferConfig[]
) : Buff {
  // Convert the config to an array.
  config = Array.isArray(config) ? config : [ config ]
  // Define the edicts array.
  const edicts = []
  for (const cfg of config) {
    // Split the rune identifier into its parts.
    const { block_height, txid_index } = decode_block_id(cfg.asset_id)
    // Construct the runestone.
    edicts.push({
      id     : { block: BigInt(block_height), tx: Number(txid_index) },
      amount : BigInt(cfg.amount),
      output : cfg.output
    })
  }
  // Encode the runestone.
  const runestone = encodeRunestone({ edicts })
  // Return the runestone as a hex string.
  return new Buff(runestone.encodedRunestone)
}
