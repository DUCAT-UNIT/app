import { Assert } from '@vbyte/util';
import { create_asset_transfer_script, get_asset_pool } from '@ducat-unit/core/lib';
import { SIGCOUNT, TXMAP, TXSIZE } from '../../const.js';
import { create_asset_issue_return_script, get_unit_asset_id, get_vault_return_size, get_vault_connect_witness_vsize, get_vault_commit_script_size, get_vault_spend_witness_vsize, get_liquid_reserve_output_size, get_vault_liquidation_total_size, get_sigops_vsize, } from '../../lib/index.js';
export function get_vault_action_tx_vsize(action_config, action_ctx) {
    const vault_action = action_config.vault_action;
    switch (vault_action) {
        case 'open':
            return (get_asset_issue_tx_vsize(action_config) +
                get_vault_open_tx_vsize(action_config, action_ctx));
        case 'borrow':
            return (get_asset_issue_tx_vsize(action_config) +
                get_vault_borrow_tx_vsize(action_ctx));
        case 'repay':
            return (get_asset_burn_tx_vsize(action_config) +
                get_vault_repay_tx_vsize(action_ctx));
        case 'repo':
            return get_vault_repo_tx_vsize(action_ctx);
        case 'trim':
            return get_vault_trim_tx_vsize(action_ctx);
        case 'deposit':
            return get_vault_deposit_tx_vsize(action_ctx);
        case 'withdraw':
            return get_vault_withdraw_tx_vsize(action_ctx);
        case 'close':
            return get_vault_close_tx_vsize(action_ctx);
        default:
            throw new Error(`unknown vault action: ${vault_action}`);
    }
}
function get_vault_repo_sigops_count(action_config) {
    return (action_config.liquid_profiles?.length ?? 0) + SIGCOUNT.VAULT_REPO;
}
export function get_vault_action_sigops_count(action_config) {
    switch (action_config.vault_action) {
        case 'open': return SIGCOUNT.VAULT_OPEN;
        case 'borrow': return SIGCOUNT.VAULT_BORROW;
        case 'repay': return SIGCOUNT.VAULT_REPAY;
        case 'close': return SIGCOUNT.VAULT_CLOSE;
        case 'repo': return get_vault_repo_sigops_count(action_config);
        case 'trim': return SIGCOUNT.VAULT_TRIM;
        case 'deposit': return SIGCOUNT.VAULT_DEPOSIT;
        case 'withdraw': return SIGCOUNT.VAULT_WITHDRAW;
        default:
            throw new Error(`unknown vault action: ${action_config.vault_action}`);
    }
}
export function get_vault_action_sigops_vsize(action_config) {
    return get_sigops_vsize(get_vault_action_sigops_count(action_config));
}
export function get_asset_issue_tx_vsize(action_config) {
    const { borrow_amount, proto_profile } = action_config;
    Assert.exists(action_config, 'action config is missing from action config');
    Assert.exists(borrow_amount, 'borrow amount is missing from action config');
    const tx_base_size = TXSIZE.ASSET_ISSUE_TX_BASE_SIZE;
    const issue_return_script = create_asset_issue_return_script(proto_profile, borrow_amount);
    return tx_base_size + issue_return_script.length;
}
export function get_asset_burn_tx_vsize(action_config) {
    const { ASSET_BURN_TX_BASE_SIZE, VIN_P2TR_SPEND_SIZE, VOUT_P2TR_SIZE } = TXSIZE;
    const { asset_inputs, repay_amount, proto_profile } = action_config;
    Assert.exists(action_config, 'action config is missing from action config');
    Assert.exists(asset_inputs, 'asset inputs are missing from action config');
    Assert.exists(repay_amount, 'repay amount is missing from action config');
    const tx_base_size = ASSET_BURN_TX_BASE_SIZE;
    const unit_asset_id = get_unit_asset_id(proto_profile);
    const asset_pool = get_asset_pool(unit_asset_id, asset_inputs);
    const asset_input_size = asset_pool.coin_utxos.length * VIN_P2TR_SPEND_SIZE;
    const asset_change_size = (asset_pool.pool_active > repay_amount)
        ? VOUT_P2TR_SIZE
        : 0;
    const edicts = [{
            asset_id: get_unit_asset_id(proto_profile),
            amount: repay_amount,
            output: TXMAP.UNIT_REPAY.VOUT.RDATA
        }];
    if (asset_pool.pool_active > repay_amount) {
        edicts.push({
            asset_id: get_unit_asset_id(proto_profile),
            amount: 0,
            output: TXMAP.UNIT_REPAY.VOUT.CHANGE
        });
    }
    const burn_return_script = create_asset_transfer_script(edicts);
    return tx_base_size + asset_input_size + asset_change_size + burn_return_script.length;
}
export function get_vault_open_tx_vsize(action_config, action_ctx) {
    const { proto_profile, vault_config } = action_config;
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    Assert.exists(vault_config, 'vault commit configuration is missing from action config');
    const base_txsize = TXSIZE.VAULT_OPEN_TX_BASE_SIZE;
    const commit_script_size = get_vault_commit_script_size(proto_profile, vault_config);
    const connect_witness_vsize = get_vault_connect_witness_vsize(commit_script_size);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + connect_witness_vsize + vault_return_data_size;
}
export function get_vault_borrow_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_BORROW_TX_BASE_SIZE;
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const connect_witness_vsize = get_vault_connect_witness_vsize();
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + connect_witness_vsize + vault_return_data_size;
}
export function get_vault_repay_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_REPAY_TX_BASE_SIZE;
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const connect_witness_vsize = get_vault_connect_witness_vsize();
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + connect_witness_vsize + vault_return_data_size;
}
export function get_vault_deposit_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_UPDATE_TX_BASE_SIZE;
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + vault_return_data_size;
}
export function get_vault_withdraw_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_UPDATE_TX_BASE_SIZE;
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + vault_return_data_size;
}
export function get_vault_close_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_CLOSE_TX_BASE_SIZE;
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + vault_return_data_size;
}
export function get_vault_repo_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance, liquid_count, reserve_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_UPDATE_TX_BASE_SIZE;
    const liquid_reserve_output_size = get_liquid_reserve_output_size(reserve_balance);
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const liquid_total_size = get_vault_liquidation_total_size(guardian_count, oracle_count, liquid_count);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + liquid_total_size + liquid_reserve_output_size + vault_return_data_size;
}
export function get_vault_trim_tx_vsize(action_ctx) {
    const { guardian_count, oracle_count, unit_balance, liquid_count, reserve_balance } = action_ctx;
    const base_txsize = TXSIZE.VAULT_UPDATE_TX_BASE_SIZE;
    const liquid_reserve_output_size = get_liquid_reserve_output_size(reserve_balance);
    const spend_witness_vsize = get_vault_spend_witness_vsize(guardian_count, oracle_count);
    const liquid_total_size = get_vault_liquidation_total_size(guardian_count, oracle_count, liquid_count);
    const vault_return_data_size = get_vault_return_size(guardian_count, oracle_count, unit_balance);
    return base_txsize + spend_witness_vsize + liquid_total_size + liquid_reserve_output_size + vault_return_data_size;
}
