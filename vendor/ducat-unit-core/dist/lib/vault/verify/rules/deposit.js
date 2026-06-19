import { Assert } from '@vbyte/util';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
export function verify_vault_deposit(proto_profile, vault_profile, prev_profile) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_vault_profile(prev_profile, proto_profile);
    Assert.ok(vault_profile.vault_balance > prev_profile.vault_balance, `verify_vault_deposit: vault balance must increase (${vault_profile.vault_balance} <= ${prev_profile.vault_balance})`);
    Assert.ok(vault_profile.unit_balance === prev_profile.unit_balance, `verify_vault_deposit: unit balance must remain unchanged (${vault_profile.unit_balance} !== ${prev_profile.unit_balance})`);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_deposit: guard members must remain unchanged');
    Assert.ok(vault_profile.client_pubkey === prev_profile.client_pubkey, 'verify_vault_deposit: client pubkey must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_deposit: root_txid must remain unchanged');
}
