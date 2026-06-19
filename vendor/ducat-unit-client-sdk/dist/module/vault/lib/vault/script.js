import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { encode_script } from '@vbyte/btc-dev/script';
import { create_vault_commit } from '../../../../lib/index.js';
export function create_commit_script(vault_ctx) {
    const { client_pubkey, guard_pubkey, proto_profile, vault_config } = vault_ctx;
    Assert.exists(vault_config, 'vault config is missing from vault context');
    const payload = create_vault_commit(proto_profile, vault_config);
    const lock_script = encode_script([client_pubkey, 'OP_CHECKSIGVERIFY', guard_pubkey, 'OP_CHECKSIG']);
    return Buff.join([lock_script, payload]);
}
export function create_connector_script(client_pubkey, guard_pubkey) {
    return encode_script([client_pubkey, 'OP_CHECKSIGVERIFY', guard_pubkey, 'OP_CHECKSIG']);
}
export function create_cleared_vault_script_tree(client_pubkey, guard_pubkeys) {
    const scripts = [];
    for (const guard_pubkey of guard_pubkeys) {
        scripts.push(encode_script([client_pubkey, 'OP_CHECKSIGVERIFY', guard_pubkey, 'OP_CHECKSIG']));
    }
    return scripts;
}
export function create_pledged_vault_script_tree(client_pubkey, guard_pubkeys, price_commits) {
    const scripts = [];
    for (const guard_pubkey of guard_pubkeys) {
        scripts.push(create_connector_script(client_pubkey, guard_pubkey));
        for (const commit of price_commits) {
            scripts.push(encode_script(['OP_HASH160', commit.thold_hash, 'OP_EQUALVERIFY', guard_pubkey, 'OP_CHECKSIG']));
        }
    }
    return scripts;
}
