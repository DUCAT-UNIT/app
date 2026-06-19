export interface EsploraBlockData {
    hash: string;
    height: number;
    prev: string;
    stamp: number;
    tx: EsploraTxData[];
}
export interface EsploraAddressUtxo {
    txid: string;
    vout: number;
    value: number;
}
export interface EsploraTxOutput {
    scriptpubkey: string;
    value: number;
}
export interface EsploraTxCoinbase {
    is_coinbase: true;
    prevout: null;
    scriptsig: string;
    sequence: number;
    txid: string;
    vout: number;
    witness: string[];
}
export interface EsploraTxInput {
    is_coinbase: false;
    prevout: EsploraTxOutput;
    scriptsig: string;
    sequence: number;
    txid: string;
    vout: number;
    witness: string[];
}
export interface EsploraTxData {
    txid: string;
    version: number;
    locktime: number;
    vin: (EsploraTxInput | EsploraTxCoinbase)[];
    vout: EsploraTxOutput[];
}
