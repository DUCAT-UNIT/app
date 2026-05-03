export interface EsploraTxStatus {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
}
export interface EsploraAddressData {
    address: string;
    chain_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
    mempool_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
}
export interface EsploraAddressUtxo {
    txid: string;
    vout: number;
    status: EsploraTxStatus;
    value: number;
}
export interface EsploraTxOutput {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
}
export interface EsploraTxInput {
    txid: string;
    vout: number;
    prevout: EsploraTxOutput;
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
}
export interface EsploraTxData {
    txid: string;
    version: number;
    locktime: number;
    vin: EsploraTxInput[];
    vout: EsploraTxOutput[];
    size: number;
    weight: number;
    fee: number;
    status: EsploraTxStatus;
}
