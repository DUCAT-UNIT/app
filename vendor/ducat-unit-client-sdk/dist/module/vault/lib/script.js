import { Buff } from '@cmdcode/buff';
import { Assert, OrdUtil, normalize_obj } from '../../../util/index.js';
import CONST from '../../../const.js';
import TX from '../../../util/tx.js';
export function create_vault_open_conn_script(vault_ctx) {
    const { acct_id, acct_utxo, guard_pubkey, contract_id, token_data, vault_pubkey } = vault_ctx;
    Assert.size(guard_pubkey, 32);
    Assert.size(vault_pubkey, 32);
    const VTKN_PTR = acct_utxo.value;
    const VTXO_PTR = VTKN_PTR + CONST.DEFAULT_POSTAGE;
    const record_flag = Buff.str('ord');
    const record_type = Buff.str('application/json');
    const parent_id = OrdUtil.encode_inscribe_id(acct_id);
    const token_ptr = Buff.num(VTKN_PTR).reverse();
    const token_str = Buff.json(normalize_obj(token_data));
    const vault_ptr = Buff.num(VTXO_PTR).reverse();
    const vault_str = Buff.json({ gpk: guard_pubkey, mid: contract_id, vpk: vault_pubkey, ver: CONST.VAULT_VERSION });
    const lock_script = [vault_pubkey, 'OP_CHECKSIGVERIFY', guard_pubkey, 'OP_CHECKSIG'];
    const vault_token = ['OP_0', 'OP_IF', record_flag, 'OP_1', record_type, 'OP_2', token_ptr, 'OP_0', token_str, 'OP_ENDIF'];
    const vault_utxo = ['OP_0', 'OP_IF', record_flag, 'OP_1', record_type, 'OP_2', vault_ptr, 'OP_3', parent_id, 'OP_0', vault_str, 'OP_ENDIF'];
    return [TX.encode_script([...lock_script, ...vault_token, ...vault_utxo])];
}
export function create_vault_fund_conn_script(guard_pk, vault_pk) {
    Assert.size(vault_pk, 32);
    Assert.size(guard_pk, 32);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script)];
}
export function create_vault_locked_spend_script(guard_pk, thold_hash, vault_pk) {
    Assert.size(guard_pk, 32);
    Assert.size(vault_pk, 32);
    Assert.size(thold_hash, 20);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    const thold_script = ['OP_HASH160', thold_hash, 'OP_EQUALVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script), TX.encode_script(thold_script)];
}
export function create_vault_cleared_spend_script(guard_pk, vault_pk) {
    Assert.size(guard_pk, 32);
    Assert.size(vault_pk, 32);
    const lock_script = [vault_pk, 'OP_CHECKSIGVERIFY', guard_pk, 'OP_CHECKSIG'];
    return [TX.encode_script(lock_script)];
}
