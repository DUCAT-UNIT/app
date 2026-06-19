import { Assert } from '@vbyte/util';
import { verify_encumbered_vault } from '../../../../lib/vault/validate.js';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
import { eval_vault_repo_policy } from '../policy.js';
import { compose_strict_policy } from '../util.js';
import { verify_vault_repo_liquidated } from './liquidate.js';
export function verify_vault_repo_strict(proto_profile, vault_profile, prev_profile, targets) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_vault_profile(prev_profile, proto_profile);
    Assert.ok(targets.length > 0, 'verify_vault_repo: at least one liquidated target must be provided');
    for (const target of targets) {
        verify_vault_repo_liquidated(proto_profile, target.liquid, target.prev);
    }
    verify_encumbered_vault(vault_profile);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_repo: guard members must remain unchanged');
    Assert.ok(vault_profile.client_pubkey === prev_profile.client_pubkey, 'verify_vault_repo: client pubkey must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_repo: root_txid must remain unchanged');
}
export function verify_vault_repo(proto_profile, vault_profile, prev_profile, targets) {
    compose_strict_policy('verify_vault_repo', () => verify_vault_repo_strict(proto_profile, vault_profile, prev_profile, targets), () => eval_vault_repo_policy(proto_profile, vault_profile, prev_profile));
}
