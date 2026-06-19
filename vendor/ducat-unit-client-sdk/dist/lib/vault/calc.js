import { TXSIZE } from '../../const.js';
import { PRICE_COMMIT_SIZE } from '@ducat-unit/core/const';
import { create_vault_commit } from '../../lib/index.js';
export function get_sigops_vsize(sigops_count) {
    return Math.ceil((65 * sigops_count) / 4);
}
export function get_vault_connect_witness_vsize(commit_size = 0) {
    const { P2TR_SIG_SIZE, COSIGN_SPEND_SCRIPT_SIZE, STACK_COUNT } = TXSIZE;
    const cblock_size = get_control_block_size(1);
    const sig_size = P2TR_SIG_SIZE * 2;
    const script_size = COSIGN_SPEND_SCRIPT_SIZE + commit_size;
    const witness_bytes = STACK_COUNT + sig_size + script_size + cblock_size;
    return Math.ceil(witness_bytes / 4);
}
export function get_vault_spend_witness_vsize(guard_count, oracle_count) {
    const { P2TR_SIG_SIZE, COSIGN_SPEND_SCRIPT_SIZE, STACK_COUNT } = TXSIZE;
    const script_count = get_vault_script_tree_count(guard_count, oracle_count);
    const cblock_size = get_control_block_size(script_count);
    const sig_size = P2TR_SIG_SIZE * 2;
    const script_size = COSIGN_SPEND_SCRIPT_SIZE;
    const witness_bytes = STACK_COUNT + sig_size + script_size + cblock_size;
    return Math.ceil(witness_bytes / 4);
}
export function get_vault_liquidation_total_size(guard_count, oracle_count, liquid_count) {
    const { VIN_BASE_SIZE, VOUT_P2TR_SIZE, P2TR_SIG_SIZE, HASH_PREIMG_SIZE, LIQUID_SPEND_SCRIPT_SIZE, STACK_COUNT } = TXSIZE;
    const script_count = get_vault_script_tree_count(guard_count, oracle_count);
    const cblock_size = get_control_block_size(script_count);
    const sig_size = P2TR_SIG_SIZE + HASH_PREIMG_SIZE;
    const script_size = LIQUID_SPEND_SCRIPT_SIZE;
    const witness_bytes = STACK_COUNT + sig_size + script_size + cblock_size;
    const liquid_pair_size = VIN_BASE_SIZE + VOUT_P2TR_SIZE + Math.ceil(witness_bytes / 4);
    return liquid_pair_size * liquid_count;
}
export function get_control_block_size(script_count) {
    const { CBLOCK_KEY_SIZE, CBLOCK_HASH_SIZE } = TXSIZE;
    if (script_count <= 1)
        return CBLOCK_KEY_SIZE;
    const tree_depth = Math.ceil(Math.log2(script_count));
    return CBLOCK_KEY_SIZE + (CBLOCK_HASH_SIZE * tree_depth);
}
export function get_vault_script_tree_count(guard_count, oracle_count) {
    if (oracle_count === 0)
        return guard_count;
    return guard_count * (oracle_count + 1);
}
export function get_vault_commit_script_size(proto_profile, vault_config) {
    const vault_commit = create_vault_commit(proto_profile, vault_config);
    return vault_commit.length / 2;
}
export function get_liquid_reserve_output_size(reserve_balance) {
    return (reserve_balance > 0) ? TXSIZE.VOUT_P2TR_SIZE : 0;
}
export function get_vault_return_size(guard_count, oracle_count, unit_balance) {
    const { VAULT_RETURN_BASE_SIZE, VAULT_RETURN_GUARD_DATA, VAULT_RETURN_PRICE_DATA } = TXSIZE;
    const base_data_size = VAULT_RETURN_BASE_SIZE;
    const guard_data_size = VAULT_RETURN_GUARD_DATA + guard_count;
    if (unit_balance === 0)
        return base_data_size + guard_data_size;
    const price_data_size = VAULT_RETURN_PRICE_DATA + (oracle_count * PRICE_COMMIT_SIZE);
    return base_data_size + guard_data_size + price_data_size;
}
