import { Assert } from '../../../../util/index.js';
import { parse_liquidation_terms } from '../util.js';
import { verify_batch_liquidate } from './verify.js';
import CONST from '../../../../const.js';
export function get_liquidation_ctx(liquid_vaults, proto_contract) {
    verify_batch_liquidate(liquid_vaults);
    const vault_count = liquid_vaults.length;
    const liquid_terms = parse_liquidation_terms(proto_contract.terms);
    const reserve_pk = liquid_terms.reserve_pubkey;
    const total_sats = get_liquid_sats_total(liquid_vaults);
    const total_unit = get_liquid_unit_total(liquid_vaults);
    const initial_vault = liquid_vaults.at(0);
    Assert.exists(initial_vault, 'no vaults to liquidate');
    const return_unit = initial_vault.return_unit;
    const return_sats = initial_vault.return_sats;
    Assert.ok(liquid_vaults.slice(1).every(vault => vault.repo_portion === 1), 'remaining vaults must be fully liquidated');
    let reserve_sats = 0, claimed_sats = 0;
    for (let i = 0; i < vault_count; i++) {
        const profile = liquid_vaults.at(i);
        Assert.exists(profile, 'vault is undefined');
        claimed_sats += profile.liquid_quote.reward_sats;
        reserve_sats += profile.liquid_quote.reserve_sats;
    }
    const claimed_unit = total_unit - return_unit;
    return {
        liquid_terms,
        liquid_vaults,
        reserve_pk,
        reserve_sats,
        return_unit,
        return_sats,
        claimed_sats,
        claimed_unit,
        total_sats,
        total_unit,
        vault_count
    };
}
export function get_liquid_sats_total(liquid_vaults) {
    return liquid_vaults.reduce((prev, curr) => {
        const value = curr.utxo.value - CONST.MIN_VAULT_BAL;
        Assert.ok(value > 0, 'liquid vault value is less than minimum vault balance');
        return prev + value;
    }, 0);
}
export function get_liquid_unit_total(liquid_vaults) {
    return liquid_vaults.reduce((prev, curr) => prev + curr.rdata.unit_balance, 0);
}
