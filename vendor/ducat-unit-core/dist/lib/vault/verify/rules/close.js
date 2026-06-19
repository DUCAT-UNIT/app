import { Assert } from '@vbyte/util';
import { verify_cleared_vault } from '../../../../lib/vault/validate.js';
import { guard_members_equal } from '../util.js';
export function verify_vault_close(_proto_profile, vault_profile, prev_profile) {
    verify_cleared_vault(prev_profile);
    verify_cleared_vault(vault_profile);
    Assert.ok(guard_members_equal(vault_profile.guard_members, prev_profile.guard_members), 'verify_vault_close: guard members must remain unchanged');
    Assert.ok(vault_profile.client_pubkey === prev_profile.client_pubkey, 'verify_vault_close: client pubkey must remain unchanged');
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_close: root_txid must remain unchanged');
    Assert.ok(vault_profile.coin_id === null, 'verify_vault_close: coin_id must be null');
    Assert.ok(vault_profile.vault_script === null, 'verify_vault_close: vault_script must be null');
    Assert.ok(vault_profile.vault_value === null, 'verify_vault_close: vault_value must be null');
    Assert.ok(vault_profile.vault_balance === 0, 'verify_vault_close: vault_balance must be zero');
    Assert.ok(vault_profile.vault_ratio === null, 'verify_vault_close: vault_ratio must be null');
}
