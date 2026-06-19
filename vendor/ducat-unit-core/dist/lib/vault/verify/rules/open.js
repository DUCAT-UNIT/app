import { verify_encumbered_vault, verify_guardian_data, verify_price_oracle_data, verify_price_commit_signatures } from '../../../../lib/vault/validate.js';
import { verify_oracles_authorized } from '../../../../lib/price/validate.js';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
export function verify_vault_open_strict(proto_profile, vault_profile) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_encumbered_vault(vault_profile);
    verify_price_oracle_data(vault_profile);
    verify_guardian_data(vault_profile.guard_members);
    verify_price_commit_signatures(vault_profile, proto_profile);
    const oracle_pubkeys = vault_profile.price_commits.map(c => c.oracle_pubkey);
    verify_oracles_authorized(oracle_pubkeys, proto_profile);
}
