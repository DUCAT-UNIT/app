import { z } from 'zod';
import base from '../schema/base.js';
const { hash32, hex, num, base58, bech32 } = base;
const btc_address = z.union([base58, bech32]);
const network = z.enum(['main', 'testnet3', 'testnet4', 'mutiny', 'regtest', 'signet']);
const txout = z.object({
    value: num,
    scriptPubKey: hex
});
const txin = z.object({
    txid: hash32,
    vout: num,
    prevout: txout,
    script_sig: hex.array().optional(),
    sequence: num.optional(),
    witness: hex.array().optional()
});
const utxo = z.object({
    txid: hash32,
    vout: num,
    value: num,
    script: hex
});
const signed_utxo = utxo.extend({
    sighash: hash32.optional(),
    witness: hex.array()
});
const tx = {
    version: num,
    vin: txin.array(),
    vout: txout.array(),
    locktime: num
};
export default { btc_address, network, tx, txin, txout, utxo, signed_utxo };
