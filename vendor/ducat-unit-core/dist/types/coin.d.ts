export interface CoinOutput {
    script_pk: string;
    value: number;
}
export interface CoinUtxo extends CoinOutput {
    txid: string;
    vout: number;
}
export interface CoinInput extends CoinUtxo {
    sequence: number;
    witness: string[];
}
export type AssetEntry = [string, {
    active: number;
    reserve: number;
}];
export interface CoinUtxoWithAssets extends CoinUtxo {
    assets?: AssetEntry[];
}
