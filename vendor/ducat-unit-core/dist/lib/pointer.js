import { is_commit_id, is_block_id, is_coin_id, assert_commit_id, assert_block_id, assert_coin_id } from '../validate/pointer.js';
export { is_commit_id, is_block_id, is_coin_id, assert_commit_id, assert_block_id, assert_coin_id };
export function encode_commit_id(txid, index) {
    return `${txid}i${index}`;
}
export function decode_commit_id(commit_id) {
    assert_commit_id(commit_id);
    const [txid, index_str] = commit_id.split('i');
    const index = parseInt(index_str, 10);
    if (!Number.isSafeInteger(index)) {
        throw new Error(`commit id index exceeds safe integer range: ${index_str}`);
    }
    return { txid, index };
}
export function encode_block_id(block_height, txid_index) {
    return `${block_height}:${txid_index}`;
}
export function decode_block_id(block_id) {
    assert_block_id(block_id);
    const [height_str, index_str] = block_id.split(':');
    const block_height = parseInt(height_str, 10);
    const txid_index = parseInt(index_str, 10);
    if (!Number.isSafeInteger(block_height)) {
        throw new Error(`block height exceeds safe integer range: ${height_str}`);
    }
    if (!Number.isSafeInteger(txid_index)) {
        throw new Error(`txid index exceeds safe integer range: ${index_str}`);
    }
    return { block_height, txid_index };
}
export function encode_coin_id(txid, vout) {
    return `${txid}:${vout}`;
}
export function get_coin_id(utxo) {
    return encode_coin_id(utxo.txid, utxo.vout);
}
export function decode_coin_id(coin_id) {
    assert_coin_id(coin_id);
    const [txid, vout_str] = coin_id.split(':');
    const vout = parseInt(vout_str, 10);
    if (!Number.isSafeInteger(vout)) {
        throw new Error(`coin vout exceeds safe integer range: ${vout_str}`);
    }
    return { txid, vout };
}
