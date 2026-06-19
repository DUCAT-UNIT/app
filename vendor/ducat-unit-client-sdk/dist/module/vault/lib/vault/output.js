import { Assert } from '@vbyte/util/assert';
import { encode_vault_return_script } from '@ducat-unit/core/lib';
import { DUST_LIMIT } from '@ducat-unit/core/const';
import { BIGINT } from '../../../../const.js';
import { create_taproot_script_key, get_address_script, create_connector_script, create_cleared_vault_script_tree, create_pledged_vault_script_tree, create_commit_script, create_vault_return_data } from '../../../../module/vault/lib/index.js';
export function create_vault_commit_vout(vault_ctx, fund_value) {
    Assert.exists(vault_ctx.vault_config, 'vault config is missing from vault context');
    const scripts = [create_commit_script(vault_ctx)];
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: script_pk };
}
export function create_vault_connector_vout(vault_ctx, fund_value) {
    const { client_pubkey, guard_pubkey } = vault_ctx;
    const scripts = [create_connector_script(client_pubkey, guard_pubkey)];
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(fund_value), script: script_pk };
}
export function create_pledged_vault_output(client_pubkey, guard_pubkeys, price_commits, vault_amount) {
    Assert.exists(price_commits, 'price commits are missing from vault context');
    const scripts = create_pledged_vault_script_tree(client_pubkey, guard_pubkeys, price_commits);
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: script_pk };
}
export function create_cleared_vault_output(client_pubkey, guard_pubkeys, vault_amount) {
    const scripts = create_cleared_vault_script_tree(client_pubkey, guard_pubkeys);
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: script_pk };
}
export function create_vault_output(vault_ctx, unit_balance, vault_balance) {
    const { client_pubkey, guard_members, price_commits, vault_terms } = vault_ctx;
    Assert.ok(guard_members.includes(vault_ctx.guard_pubkey), 'active guardian pubkey is not in guard_members list');
    const vault_amount = vault_balance + vault_terms.vault_value_min;
    if (unit_balance > 0) {
        return create_pledged_vault_output(client_pubkey, guard_members, price_commits, vault_amount);
    }
    else {
        return create_cleared_vault_output(client_pubkey, guard_members, vault_amount);
    }
}
export function create_sats_change_output(vault_ctx, change_amt) {
    const { change_address } = vault_ctx;
    Assert.exists(change_address, 'change address is missing from vault context');
    Assert.ok(change_amt >= DUST_LIMIT, `change amount is below dust limit (${DUST_LIMIT})`);
    const script = get_address_script(change_address);
    return { amount: BigInt(change_amt), script };
}
export function create_vault_return_output(vault_ctx) {
    const { proto_profile } = vault_ctx;
    const return_data = create_vault_return_data(vault_ctx);
    const script_pk = encode_vault_return_script(proto_profile, return_data);
    return { amount: BIGINT._0, script: script_pk };
}
