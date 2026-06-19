import { z } from 'zod';
import * as base from './base.js';
import * as chain from './chain.js';
import { WITNESS_STACK_MAX } from '../const.js';
export const coin_id = chain.outpoint;
export const utxo = z.object({
    txid: base.hex32,
    vout: base.uint,
    value: base.ulong.positive(),
    script_pk: base.hex
});
export const input = utxo.extend({
    sequence: base.uint,
    witness: base.hex.array().max(WITNESS_STACK_MAX)
});
