import { Assert } from '@vbyte/util';
import { verify_encumbered_vault } from '../../../../lib/vault/validate.js';
import { extract_vault_price_contracts } from '../../../../lib/vault/price.js';
import { get_price_contract_thold_hash } from '../../../../lib/price/contract.js';
import { validate_breached_price_contract } from '../../../../lib/price/validate.js';
import { verify_price_contract } from '../../../../lib/verify/price.js';
import { verify_vault_profile } from '../../../../lib/verify/vault.js';
import { guard_members_equal } from '../util.js';
export function verify_vault_liquidate(proto_profile, vault_profile, prev_profile) {
    verify_vault_profile(vault_profile, proto_profile);
    verify_encumbered_vault(prev_profile);
    const breach = derive_breach_contract(proto_profile, prev_profile, vault_profile.liquid_key);
    verify_price_contract(breach, proto_profile);
    validate_breached_price_contract(breach);
    Assert.ok(vault_profile.liquid_price <= breach.thold_price, `verify_vault_liquidate: liquid_price (${vault_profile.liquid_price}) must be <= ` +
        `breach.thold_price (${breach.thold_price})`);
    Assert.ok(vault_profile.root_txid === prev_profile.root_txid, 'verify_vault_liquidate: root_txid must remain unchanged');
}
function verify_liquidated_target_identity(target, target_prev) {
    Assert.ok(guard_members_equal(target.guard_members, target_prev.guard_members), 'verify_liquidated_target: guard members must remain unchanged');
    Assert.ok(target.client_pubkey === target_prev.client_pubkey, 'verify_liquidated_target: client pubkey must remain unchanged');
    Assert.ok(target.vault_action === 'liquidate', 'verify_liquidated_target: vault action must be liquidate');
}
export function verify_vault_repo_liquidated(proto_profile, target, target_prev) {
    verify_vault_liquidate(proto_profile, target, target_prev);
    verify_liquidated_target_identity(target, target_prev);
    Assert.ok(target.unit_balance === 0, 'verify_vault_repo_liquidated: unit balance must be zero');
    Assert.ok(target.vault_ratio === null, 'verify_vault_repo_liquidated: vault ratio must be null');
}
export function verify_vault_trim_liquidated(proto_profile, target, target_prev) {
    verify_vault_liquidate(proto_profile, target, target_prev);
    verify_liquidated_target_identity(target, target_prev);
    Assert.ok(target.unit_balance > 0, 'verify_vault_trim_liquidated: target must retain debt (partial liquidation; use repo for full)');
    Assert.ok(target.unit_balance < target_prev.unit_balance, 'verify_vault_trim_liquidated: target debt must be reduced');
    Assert.exists(target.vault_ratio, 'verify_vault_trim_liquidated: target ratio must be recomputed (target remains encumbered)');
}
function derive_breach_contract(proto_profile, prev_profile, liquid_key) {
    const want_hash = get_price_contract_thold_hash(liquid_key);
    const prev_contracts = extract_vault_price_contracts(proto_profile, prev_profile);
    const active = prev_contracts.find(c => c.thold_hash === want_hash);
    Assert.exists(active, `verify_vault_liquidate: liquid_key does not match any threshold the prev vault committed to ` +
        `(hash160(liquid_key)=${want_hash})`);
    return { ...active, thold_key: liquid_key };
}
