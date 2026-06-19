import { Assert } from '@vbyte/util';
import { calc_collateral_ratio, extract_vault_price_contracts, DEFAULT_RETURN_DATA, decode_coin_id, get_adjusted_unit_price, get_asset_profile, get_vault_terms } from '../../lib/index.js';
import { verify_vault_balance } from './validate.js';
export function get_vault_profile_utxo(vault_profile) {
    const { coin_id, vault_script: script_pk, vault_value: value } = vault_profile;
    Assert.exists(coin_id, 'vault profile has no active coin_id');
    Assert.exists(script_pk, 'vault profile has no active vault_script');
    Assert.exists(value, 'vault profile has no active vault_value');
    const { txid, vout } = decode_coin_id(coin_id);
    return { txid, vout, value, script_pk };
}
export function collect_vault_price_contracts(proto_profile, vault_profiles) {
    const price_contracts = new Set();
    for (const vault_profile of vault_profiles) {
        const contracts = extract_vault_price_contracts(proto_profile, vault_profile);
        for (const contract of contracts) {
            price_contracts.add(contract);
        }
    }
    return Array.from(price_contracts);
}
export function get_vault_profile_price_hashes(proto_profile, vault_profile) {
    const price_contracts = extract_vault_price_contracts(proto_profile, vault_profile);
    return price_contracts.map(c => c.commit_hash);
}
export function get_vault_profile_ratio(proto_profile, vault_profile) {
    const { unit_balance, unit_price, vault_balance } = vault_profile;
    if (unit_price === null || unit_balance <= 0)
        return null;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const unit_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    const adj_price = get_adjusted_unit_price(unit_price, unit_profile.div);
    return calc_collateral_ratio(vault_balance, unit_balance, adj_price);
}
export function create_vault_profile(proto_profile, vault_txdata) {
    const { vault_return, vault_signers, vault_utxo } = vault_txdata;
    Assert.exists(vault_utxo, 'vault utxo is required to create active vault profile');
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    verify_vault_balance(vault_utxo.value, vault_terms.vault_value_min);
    const vault_balance = vault_utxo.value - vault_terms.vault_value_min;
    const return_data = vault_return ?? DEFAULT_RETURN_DATA();
    const root_txid = decode_coin_id(vault_txdata.coin_id).txid;
    return {
        ...return_data,
        ...vault_signers,
        coin_id: vault_txdata.coin_id,
        contract_id: proto_profile.contract_id,
        root_txid: root_txid,
        vault_action: vault_txdata.vault_action,
        vault_balance: vault_balance,
        vault_config: vault_txdata.vault_config,
        vault_ratio: vault_txdata.vault_ratio,
        vault_script: vault_utxo.script_pk,
        vault_value: vault_utxo.value,
        vault_version: vault_txdata.vault_version,
    };
}
export function create_vault_close_profile(proto_profile, prev_profile, vault_txdata) {
    const { vault_action, vault_return, vault_signers, vault_version } = vault_txdata;
    Assert.ok(vault_action === 'close', 'create_vault_close_profile requires close action');
    Assert.exists(vault_return, 'create_vault_close_profile requires vault return data');
    return {
        ...vault_return,
        ...vault_signers,
        coin_id: null,
        contract_id: proto_profile.contract_id,
        root_txid: prev_profile.root_txid,
        vault_action: 'close',
        vault_balance: 0,
        vault_config: prev_profile.vault_config,
        vault_ratio: null,
        vault_script: null,
        vault_value: null,
        vault_version
    };
}
export function update_vault_profile(proto_profile, vault_profile, vault_txdata) {
    if (vault_txdata.vault_action === 'close') {
        return create_vault_close_profile(proto_profile, vault_profile, vault_txdata);
    }
    const new_profile = create_vault_profile(proto_profile, vault_txdata);
    const root_txid = vault_profile.root_txid;
    const vault_config = new_profile.vault_config ?? vault_profile.vault_config;
    return { ...new_profile, root_txid, vault_config };
}
