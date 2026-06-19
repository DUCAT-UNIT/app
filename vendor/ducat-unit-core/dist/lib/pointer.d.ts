import type { CoinUtxo } from '../types/index.js';
import { is_commit_id, is_block_id, is_coin_id, assert_commit_id, assert_block_id, assert_coin_id } from '../validate/pointer.js';
export { is_commit_id, is_block_id, is_coin_id, assert_commit_id, assert_block_id, assert_coin_id };
export declare function encode_commit_id(txid: string, index: number): string;
export declare function decode_commit_id(commit_id: string): {
    txid: string;
    index: number;
};
export declare function encode_block_id(block_height: number, txid_index: number): string;
export declare function decode_block_id(block_id: string): {
    block_height: number;
    txid_index: number;
};
export declare function encode_coin_id(txid: string, vout: number): string;
export declare function get_coin_id(utxo: CoinUtxo): string;
export declare function decode_coin_id(coin_id: string): {
    txid: string;
    vout: number;
};
