import { Assert } from '@vbyte/util';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
export function verify_vault_repay_strict(proto_profile, vault_profile, prev_profile) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_vault_profile(prev_profile, proto_profile);
    Assert.ok(vault_profile.unit_balance < prev_profile.unit_balance, `verify_vault_repay: unit balance must decrease (${vault_profile.unit_balance} >= ${prev_profile.unit_balance})`);
    Assert.ok(vault_profile.unit_balance >= 0, `verify_vault_repay: unit balance must be non-negative (${vault_profile.unit_balance} < 0)`);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_repay: guard members must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_repay: root_txid must remain unchanged');
}
