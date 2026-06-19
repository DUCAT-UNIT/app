import { Assert } from '@vbyte/util';
import { VAULT_VERSION } from '../../../../const.js';
import { create_vault_action_quote } from '../../../../lib/vault/quote.js';
import { verify_vault_request_ctx } from '../../../../module/vault/lib/index.js';
import { emit_info, get_observe_context, with_observe_span } from '../../../../lib/observe/index.js';
import { create_price_commits, get_vault_terms, select_base_price_contract, get_coin_total_value, get_asset_account_utxo } from '@ducat-unit/core/lib';
export function get_vault_context_coin_value(vault_ctx) {
    const { asset_inputs, fund_inputs } = vault_ctx;
    const asset_coins = asset_inputs.map(input => get_asset_account_utxo(input));
    return get_coin_total_value([...asset_coins, ...fund_inputs]);
}
export function create_vault_ctx(vault_config) {
    const observe = get_observe_context(vault_config.observability, {
        module: 'vault.ctx',
        vault_action: vault_config.vault_action
    });
    return with_observe_span(observe, `vault.${vault_config.vault_action}.create_ctx`, { vault_action: vault_config.vault_action }, scope => {
        const { guard_members, proto_profile, price_contracts = [], vault_profile } = vault_config;
        const vault_terms = get_vault_terms(proto_profile.proto_terms);
        const action_quote = create_vault_action_quote(vault_config);
        const vault_ctx = {
            ...vault_config,
            ...action_quote,
            asset_inputs: vault_config.asset_inputs ?? [],
            client_pubkey: get_vault_client_pubkey(vault_config),
            fund_inputs: vault_config.fund_inputs ?? [],
            guard_members: guard_members ?? vault_profile?.guard_members ?? [],
            observe: scope,
            price_commits: [],
            price_stamp: null,
            vault_terms: get_vault_terms(proto_profile.proto_terms),
            vault_value: action_quote.vault_balance + vault_terms.vault_value_min,
            vault_version: VAULT_VERSION
        };
        if (price_contracts && price_contracts.length > 0) {
            const base_contract = select_base_price_contract(price_contracts);
            vault_ctx.price_commits = create_price_commits(price_contracts);
            vault_ctx.price_stamp = base_contract?.base_stamp ?? null;
        }
        verify_vault_request_ctx(vault_ctx);
        emit_info(scope, `vault.${vault_config.vault_action}.ctx.created`, `created vault ${vault_config.vault_action} context`, {
            guard_count: vault_ctx.guard_members.length,
            input_count: vault_ctx.fund_inputs.length,
            oracle_count: vault_ctx.price_commits.length
        });
        return vault_ctx;
    });
}
export function create_vault_request(vault_ctx) {
    return {
        borrow_amount: vault_ctx.borrow_amount,
        chain_network: vault_ctx.proto_profile.chain_network,
        client_pubkey: vault_ctx.client_pubkey,
        contract_id: vault_ctx.proto_profile.contract_id,
        deposit_amount: vault_ctx.deposit_amount,
        guard_members: vault_ctx.guard_members,
        guard_pubkey: vault_ctx.guard_pubkey,
        repay_amount: vault_ctx.repay_amount,
        root_txid: vault_ctx.vault_profile?.root_txid,
        vault_action: vault_ctx.vault_action,
        withdraw_amount: vault_ctx.withdraw_amount
    };
}
export function get_vault_client_pubkey(vault_config) {
    const { client_pubkey, vault_profile } = vault_config;
    if (vault_profile?.client_pubkey !== undefined) {
        Assert.ok(client_pubkey === undefined || client_pubkey === vault_profile.client_pubkey, `client_pubkey mismatch: request key does not match the existing vault's client_pubkey`);
        return vault_profile.client_pubkey;
    }
    Assert.exists(client_pubkey, 'vault user pubkey is missing from vault context');
    return client_pubkey;
}
