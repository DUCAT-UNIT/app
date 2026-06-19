import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { PSBT } from '@ducat-unit/core';
import { UNSPENDABLE_KEY } from '@ducat-unit/core/const';
import { create_liquid_vault_input, get_vault_profile_utxo } from '@ducat-unit/core/lib';
import { create_pledged_vault_script_tree, find_price_commit_idx, get_price_commit_thold_hash, get_liquid_script_idx, verify_liquid_script } from '../../../../module/vault/lib/index.js';
export function create_liquid_spend_vin(vault_profile) {
    const { client_pubkey, guard_members, guard_pubkey, liquid_key, price_commits } = vault_profile;
    Assert.exists(liquid_key, 'liquid key is missing from vault profile');
    const guard_idx = guard_members.indexOf(guard_pubkey);
    Assert.ok(guard_idx !== -1, 'active guardian is missing from allowed guardians list');
    Assert.exists(price_commits, 'price commits are missing from liquid vault');
    const price_commit_idx = find_price_commit_idx(price_commits, liquid_key);
    Assert.exists(price_commit_idx, 'price commit is missing from liquid vault');
    const thold_hash = get_price_commit_thold_hash(price_commits, price_commit_idx);
    const scripts = create_pledged_vault_script_tree(client_pubkey, guard_members, price_commits);
    const script_idx = get_liquid_script_idx(guard_idx, price_commits.length, price_commit_idx);
    verify_liquid_script(scripts, script_idx, thold_hash);
    const liquid_utxo = get_vault_profile_utxo(vault_profile);
    const liquid_input = create_liquid_vault_input(liquid_utxo);
    const hlock_entry = PSBT.create_psbt_hashlock_entry(thold_hash, liquid_key);
    return {
        ...PSBT.create_psbt_input(liquid_input),
        hash160: [hlock_entry],
        tapLeafScript: [PSBT.create_psbt_tapscript_entry(scripts, { index: script_idx })],
        tapInternalKey: Buff.hex(UNSPENDABLE_KEY)
    };
}
