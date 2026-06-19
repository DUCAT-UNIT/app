import { Buff } from '@vbyte/buff';
import { encodeRunestone } from '@ducat-unit/runestone';
import { decode_block_id } from './pointer.js';
export function create_asset_transfer_script(config) {
    config = Array.isArray(config) ? config : [config];
    const edicts = [];
    for (const cfg of config) {
        const { block_height, txid_index } = decode_block_id(cfg.asset_id);
        edicts.push({
            id: { block: BigInt(block_height), tx: Number(txid_index) },
            amount: BigInt(cfg.amount),
            output: cfg.output
        });
    }
    const runestone = encodeRunestone({ edicts });
    return new Buff(runestone.encodedRunestone);
}
