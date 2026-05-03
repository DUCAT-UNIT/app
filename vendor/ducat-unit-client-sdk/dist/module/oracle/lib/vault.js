import { Assert, OrdUtil } from '../../../util/index.js';
import { parse_vault_return } from '../../../module/vault/lib/rdata.js';
import CONST from '../../../const.js';
const { TXMAP } = CONST;
export function parse_vault_prevout(res) {
    const { input, output } = res.transaction;
    const vault_return = output.find(e => e.script_pubkey.startsWith('6a58'));
    Assert.exists(vault_return, 'vault return data not found');
    const rdata = parse_vault_return(vault_return.script_pubkey);
    const vin_idx = get_vault_input_idx(rdata.vault_action);
    const out_idx = get_vault_output_idx(rdata.vault_action);
    const vault_vin = input.at(vin_idx);
    const vault_out = output.at(out_idx);
    Assert.exists(vault_vin, 'vault input not found in tx');
    Assert.exists(vault_out, 'vault output not found in tx');
    const utxo = {
        txid: res.txid,
        vout: out_idx,
        value: vault_out.value,
        script: vault_out.script_pubkey
    };
    return { rdata, utxo };
}
export function get_vault_output_idx(action) {
    const label = get_vault_action_label(action);
    return TXMAP[label].vault_tx.vout.vault;
}
export function get_vault_input_idx(action) {
    const label = get_vault_action_label(action);
    return (label === 'open')
        ? TXMAP['open'].vault_tx.vin.conn
        : TXMAP[label].vault_tx.vin.vault;
}
export function get_vault_return_idx(action) {
    const label = get_vault_action_label(action);
    return TXMAP[label].vault_tx.vout.vdata;
}
export function parse_vault_id(identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const parts = identifier.split('i');
    const index = Number(parts[1]) + 1;
    const vault_id = parts[0] + 'i' + String(index);
    OrdUtil.assert_inscribe_id(vault_id);
    return vault_id;
}
export function get_vault_action_label(action) {
    switch (action) {
        case 'o':
            return 'open';
        case 'b':
            return 'borrow';
        case 'r':
            return 'repay';
        case 'l':
            return 'liquidate';
        case 'x':
            return 'repo';
        case 'd':
            return 'deposit';
        case 'w':
            return 'withdraw';
        default:
            throw new Error('unrecognozed vault action: ' + action);
    }
}
