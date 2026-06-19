import { Assert } from '@vbyte/util';
import { verify_encumbered_vault } from '../../../../lib/vault/validate.js';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
import { eval_vault_trim_policy } from '../policy.js';
import { compose_strict_policy } from '../util.js';
import { verify_vault_trim_liquidated } from './liquidate.js';
export function verify_vault_trim_strict(proto_profile, vault_profile, prev_profile, target) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_vault_profile(prev_profile, proto_profile);
    verify_vault_trim_liquidated(proto_profile, target.liquid, target.prev);
    Assert.ok(vault_profile.unit_balance >= 0, `verify_vault_trim: unit balance must be non-negative (${vault_profile.unit_balance} < 0)`);
    verify_encumbered_vault(vault_profile);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_trim: guard members must remain unchanged');
    Assert.ok(vault_profile.client_pubkey === prev_profile.client_pubkey, 'verify_vault_trim: client pubkey must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_trim: root_txid must remain unchanged');
}
export function verify_vault_trim(proto_profile, vault_profile, prev_profile, target) {
    compose_strict_policy('verify_vault_trim', () => verify_vault_trim_strict(proto_profile, vault_profile, prev_profile, target), () => eval_vault_trim_policy(proto_profile, vault_profile, prev_profile));
}
