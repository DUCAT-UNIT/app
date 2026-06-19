import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util/assert';
import { PSBT } from '@ducat-unit/core';
import { create_vault_action_input, create_vault_connector_input, get_vault_profile_utxo, parse_cosigner_script } from '@ducat-unit/core/lib';
import { create_connector_script, create_cleared_vault_script_tree, create_pledged_vault_script_tree, create_commit_script } from '../../../../module/vault/lib/index.js';
export function create_vault_commit_input(vault_ctx, vault_utxo) {
    const scripts = [create_commit_script(vault_ctx)];
    const txinput = create_vault_action_input(vault_utxo, vault_ctx.vault_action);
    return PSBT.create_psbt_tapscript_input(scripts, txinput, { index: 0 });
}
export function create_vault_conn_input(vault_ctx, conn_utxo) {
    const { client_pubkey, guard_pubkey } = vault_ctx;
    const scripts = [create_connector_script(client_pubkey, guard_pubkey)];
    const txinput = create_vault_connector_input(conn_utxo);
    return PSBT.create_psbt_tapscript_input(scripts, txinput, { index: 0 });
}
export function create_vault_cleared_input(vault_action, vault_profile, guard_pubkey) {
    const { client_pubkey, guard_members, unit_balance } = vault_profile;
    Assert.ok(unit_balance === 0, 'unit balance is not zero');
    const guard_idx = guard_members.indexOf(guard_pubkey);
    Assert.ok(guard_idx !== -1, 'active guardian is missing from allowed guardians list');
    const scripts = create_cleared_vault_script_tree(client_pubkey, guard_members);
    const selected_script = scripts[guard_idx];
    Assert.exists(selected_script, `script at guard index ${guard_idx} does not exist`);
    const parsed_script = parse_cosigner_script(new Buff(selected_script).hex);
    Assert.ok(parsed_script.guard_pubkey === guard_pubkey, `script at guard index ${guard_idx} contains unexpected pubkey: expected ${guard_pubkey}, got ${parsed_script.guard_pubkey}`);
    const utxo = get_vault_profile_utxo(vault_profile);
    const txinput = create_vault_action_input(utxo, vault_action);
    return PSBT.create_psbt_tapscript_input(scripts, txinput, { index: guard_idx });
}
export function create_vault_pledged_input(vault_action, vault_profile, guard_pubkey) {
    const { client_pubkey, guard_members, price_commits, unit_balance } = vault_profile;
    Assert.ok(unit_balance > 0, 'unit balance is not greater than zero');
    const guard_idx = guard_members.indexOf(guard_pubkey);
    Assert.ok(guard_idx !== -1, 'active guardian is missing from allowed guardians list');
    Assert.exists(price_commits, 'price commits are missing from vault context');
    const script_idx = guard_idx * (1 + price_commits.length);
    const scripts = create_pledged_vault_script_tree(client_pubkey, guard_members, price_commits);
    const selected_script = scripts[script_idx];
    Assert.exists(selected_script, `script at index ${script_idx} does not exist`);
    const parsed_script = parse_cosigner_script(new Buff(selected_script).hex);
    Assert.ok(parsed_script.guard_pubkey === guard_pubkey, `script at index ${script_idx} contains unexpected pubkey: expected ${guard_pubkey}, got ${parsed_script.guard_pubkey}`);
    const utxo = get_vault_profile_utxo(vault_profile);
    const txinput = create_vault_action_input(utxo, vault_action);
    return PSBT.create_psbt_tapscript_input(scripts, txinput, { index: script_idx });
}
export function create_vault_spend_input(vault_ctx) {
    const { guard_pubkey, vault_action, vault_profile } = vault_ctx;
    return (vault_profile.unit_balance > 0)
        ? create_vault_pledged_input(vault_action, vault_profile, guard_pubkey)
        : create_vault_cleared_input(vault_action, vault_profile, guard_pubkey);
}
