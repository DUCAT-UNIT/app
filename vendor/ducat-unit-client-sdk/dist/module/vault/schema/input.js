import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
import tx from '../../../schema/tx.js';
const acct_input = z.object({
    acct_id: ord.inscribe_id,
    acct_utxo: tx.utxo
});
const liquid_input = tx.signed_utxo.extend({
    repo_portion: base.num,
    vault_pubkey: base.hash32
});
const proto_input = z.object({
    contract_id: ord.inscribe_id,
    guard_pubkey: base.hash32,
    unit_rune_id: ord.rune_id,
    unit_rune_lbl: base.str
});
const vault_input = z.object({
    vault_balance: base.num,
    vault_pubkey: base.hash32,
    vault_utxo: tx.utxo
});
export default {
    acct_input,
    liquid_input,
    proto_input,
    vault_input
};
