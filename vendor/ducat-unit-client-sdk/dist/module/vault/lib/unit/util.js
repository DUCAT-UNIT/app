import { get_address } from '@vbyte/btc-dev/address';
import { get_asset_pool, to_address_network } from '@ducat-unit/core/lib';
export function get_unit_issuer_address(vault_ctx) {
    const account = vault_ctx.issue_account;
    const network = vault_ctx.proto_profile.chain_network;
    return get_address(account.coin_script, to_address_network(network));
}
export function get_unit_asset_pool(vault_ctx) {
    const { asset_inputs, vault_terms } = vault_ctx;
    const unit_asset_id = vault_terms.unit_asset_id;
    return get_asset_pool(unit_asset_id, asset_inputs);
}
export function get_new_unit_balance(unit_balance, repay_amount) {
    const new_balance = unit_balance - repay_amount;
    if (new_balance < 0) {
        throw new Error(`repay amount is greater than unit balance: ${unit_balance} < ${repay_amount}`);
    }
    return new_balance;
}
export function get_unit_change(input_amount, repay_amount) {
    const change_amt = input_amount - repay_amount;
    if (change_amt < 0) {
        throw new Error(`insufficient unit balance from inputs: ${input_amount} < ${repay_amount}`);
    }
    return change_amt;
}
