import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { DUST_LIMIT } from '@ducat-unit/core/const';
import { derive_p2tr_script } from '@ducat-unit/core/lib';
import { create_taproot_script_key } from '../util.js';
import { create_cleared_vault_script_tree, create_pledged_vault_script_tree } from '../vault/script.js';
export function create_liquid_vault_locked_output(vault_profile, vault_amount) {
    const { client_pubkey, price_commits, guard_members } = vault_profile;
    Assert.exists(price_commits, 'price commits are missing from vault profile');
    const scripts = create_pledged_vault_script_tree(client_pubkey, guard_members, price_commits);
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: script_pk };
}
export function create_liquid_vault_cleared_output(vault_profile, vault_amount) {
    const { client_pubkey, guard_members } = vault_profile;
    const scripts = create_cleared_vault_script_tree(client_pubkey, guard_members);
    const script_pk = create_taproot_script_key(scripts);
    return { amount: BigInt(vault_amount), script: script_pk };
}
export function create_reserve_spend_output(vault_ctx, reserve_amount) {
    const reserve_pubkey = vault_ctx.vault_terms.reserve_pubkey;
    Assert.ok(reserve_amount >= DUST_LIMIT, `reserve amount is below dust limit (${DUST_LIMIT})`);
    Assert.is_hash(reserve_pubkey, 'reserve pubkey is invalid');
    const script = Buff.hex(derive_p2tr_script(reserve_pubkey));
    return { amount: BigInt(reserve_amount), script };
}
