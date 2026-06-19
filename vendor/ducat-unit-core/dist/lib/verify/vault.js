import { Assert } from '@vbyte/util';
import { assert_schema } from '../../validate/schema.js';
import * as SCHEMA from '../../schema/index.js';
import { extract_vault_price_contracts } from '../../lib/vault/price.js';
import { get_vault_terms } from '../../lib/proto/terms.js';
import { is_vault_active } from '../../lib/vault/util.js';
import { verify_active_price_contract } from './price.js';
export function verify_vault_profile(profile, proto) {
    assert_schema(profile, SCHEMA.vault.profile, 'verify_vault_profile: schema validation failed');
    Assert.ok(profile.contract_id === proto.contract_id, `verify_vault_profile: contract_id mismatch — supplied ${profile.contract_id}, expected ${proto.contract_id}`);
    if (profile.vault_value !== null) {
        const vault_terms = get_vault_terms(proto.proto_terms);
        const expected_balance = profile.vault_value - vault_terms.vault_value_min;
        Assert.ok(profile.vault_balance === expected_balance, `verify_vault_profile: vault_balance invariant violation — ` +
            `supplied ${profile.vault_balance}, expected ${expected_balance} ` +
            `(vault_value=${profile.vault_value} - vault_value_min=${vault_terms.vault_value_min})`);
    }
    if (is_vault_active(profile)) {
        const contracts = extract_vault_price_contracts(proto, profile);
        for (const contract of contracts) {
            verify_active_price_contract(contract, proto);
        }
    }
}
