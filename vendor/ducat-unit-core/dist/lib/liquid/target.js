import { Assert } from '@vbyte/util';
import { get_coin_id } from '../../lib/pointer.js';
import { get_vault_terms } from '../../lib/proto/terms.js';
import { get_liquidation_quote } from '../../lib/liquid/quote.js';
import { extract_liquid_thold_key } from '../../lib/vault/txdata.js';
import { get_vault_profile_ratio } from '../../lib/vault/profile.js';
import { DEFAULT_RETURN_DATA } from '../../lib/vault/rdata.js';
export function build_repo_liquidated_target(proto_profile, liquid_txinput, prev_profile, liquid_price) {
    Assert.exists(liquid_txinput.liquid_utxo, 'liquidation input is missing its utxo');
    const liquid_utxo = liquid_txinput.liquid_utxo;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const liquid_key = extract_liquid_thold_key(liquid_txinput);
    const quote = get_liquidation_quote(proto_profile, prev_profile.vault_balance, prev_profile.unit_balance, liquid_price);
    return {
        ...prev_profile,
        ...DEFAULT_RETURN_DATA(),
        ...quote,
        guard_members: prev_profile.guard_members,
        guard_pubkey: prev_profile.guard_pubkey,
        client_pubkey: prev_profile.client_pubkey,
        vault_config: prev_profile.vault_config,
        coin_id: get_coin_id(liquid_utxo),
        contract_id: proto_profile.contract_id,
        vault_action: 'liquidate',
        unit_balance: 0,
        vault_balance: liquid_utxo.value - vault_terms.vault_value_min,
        vault_ratio: null,
        vault_script: liquid_utxo.script_pk,
        vault_value: liquid_utxo.value,
        liquid_key,
        liquid_price
    };
}
export function build_trim_liquidated_target(proto_profile, liquid_txinput, prev_profile, liquid_price, trim_amount) {
    Assert.exists(liquid_txinput.liquid_utxo, 'liquidation input is missing its utxo');
    Assert.exists(prev_profile.unit_price, 'liquidated vault is missing its unit price');
    const liquid_utxo = liquid_txinput.liquid_utxo;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const liquid_key = extract_liquid_thold_key(liquid_txinput);
    const quote = get_liquidation_quote(proto_profile, prev_profile.vault_balance, prev_profile.unit_balance, liquid_price);
    const target = {
        ...prev_profile,
        ...quote,
        coin_id: get_coin_id(liquid_utxo),
        contract_id: proto_profile.contract_id,
        vault_action: 'liquidate',
        unit_balance: prev_profile.unit_balance - trim_amount,
        vault_balance: liquid_utxo.value - vault_terms.vault_value_min,
        vault_ratio: null,
        vault_script: liquid_utxo.script_pk,
        vault_value: liquid_utxo.value,
        liquid_key,
        liquid_price
    };
    target.vault_ratio = get_vault_profile_ratio(proto_profile, target);
    return target;
}
