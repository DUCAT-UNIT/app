export function is_commit_id(commit_id) {
    return commit_id.match(/^[a-f0-9]{64}i\d+$/) !== null;
}
export function assert_commit_id(commit_id) {
    if (!is_commit_id(commit_id)) {
        throw new Error(`invalid commit ID format: '${commit_id}' (expected: {txid}i{index})`);
    }
}
export function is_block_id(block_id) {
    return block_id.match(/^\d+:\d+$/) !== null;
}
export function assert_block_id(block_id) {
    if (!is_block_id(block_id)) {
        throw new Error(`invalid block ID format: '${block_id}' (expected: {height}:{tx_index})`);
    }
}
export function is_coin_id(coin_id) {
    return coin_id.match(/^[a-f0-9]{64}:[0-9]+$/) !== null;
}
export function assert_coin_id(coin_id) {
    if (!is_coin_id(coin_id)) {
        throw new Error(`invalid coin ID format: '${coin_id}' (expected: {txid}:{vout})`);
    }
}
