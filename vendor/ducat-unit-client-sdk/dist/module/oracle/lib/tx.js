import { create_tx, create_vin, create_vout } from '@scrow/tapscript/tx';
export function parse_esplora_tx(tx) {
    const { version, vin, vout, locktime } = tx;
    const txins = vin.map(e => {
        return create_vin({
            txid: e.txid,
            vout: e.vout,
            prevout: {
                value: e.prevout.value,
                scriptPubKey: e.prevout.scriptpubkey
            },
            scriptSig: e.scriptsig,
            sequence: e.sequence,
            witness: e.witness
        });
    });
    const txouts = vout.map(e => {
        return create_vout({ value: e.value, scriptPubKey: e.scriptpubkey });
    });
    return create_tx({ version, vin: txins, vout: txouts, locktime });
}
