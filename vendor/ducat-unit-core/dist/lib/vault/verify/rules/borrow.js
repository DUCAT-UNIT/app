import { Assert } from '@vbyte/util';
import { verify_price_oracle_data, verify_price_commit_signatures } from '../../../../lib/vault/validate.js';
import { verify_oracles_authorized } from '../../../../lib/price/validate.js';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
export function verify_vault_borrow_strict(proto_profile, vault_profile, prev_profile) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_vault_profile(prev_profile, proto_profile);
    Assert.ok(vault_profile.unit_balance > prev_profile.unit_balance, `verify_vault_borrow: unit balance must increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`);
    verify_price_oracle_data(vault_profile);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_borrow: guard members must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_borrow: root_txid must remain unchanged');
    verify_price_commit_signatures(vault_profile, proto_profile);
    const oracle_pubkeys = vault_profile.price_commits.map(c => c.oracle_pubkey);
    verify_oracles_authorized(oracle_pubkeys, proto_profile);
}
