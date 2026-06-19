import { z } from 'zod';
import { base } from '@ducat-unit/core/schema';
export const address_utxo = z.object({
    txid: base.hex32,
    vout: base.uint,
    value: base.uint
});
export const tx_output = z.object({
    scriptpubkey: base.hex,
    value: base.uint
});
export const tx_coinbase = z.object({
    is_coinbase: z.literal(true),
    prevout: z.null(),
    txid: base.hex32,
    vout: base.uint,
    scriptsig: base.hex,
    sequence: base.uint,
    witness: base.hex.array()
});
export const tx_input = z.object({
    is_coinbase: z.literal(false),
    txid: base.hex32,
    vout: base.uint,
    prevout: tx_output,
    scriptsig: base.hex,
    sequence: base.uint,
    witness: base.hex.array()
});
export const tx_data = z.object({
    locktime: base.uint,
    txid: base.hex32,
    version: base.uint,
    vin: z.array(tx_input),
    vout: z.array(tx_output)
});
export const block_data = z.object({
    hash: base.hex32,
    height: base.uint,
    prev: base.hex32,
    stamp: base.uint,
    tx: z.array(tx_data)
});
