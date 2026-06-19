export interface RpcDataResponse<T> {
    ok: true;
    data: T;
    error?: string;
}
export interface RpcErrorResponse {
    ok: false;
    data?: undefined;
    error: string;
}
export type RpcResponse<T = unknown> = RpcDataResponse<T> | RpcErrorResponse;
export interface RpcClientConfig {
    rpc_url: string;
    rpc_user: string;
    rpc_pass: string;
    allow_insecure?: boolean;
}
export interface CoreScriptPubKey {
    asm: string;
    desc: string;
    hex: string;
    type: string;
    address?: string;
}
export interface CoreScriptSig {
    asm: string;
    hex: string;
}
export interface CoreTxPrevout {
    generated: boolean;
    height: number;
    value: number;
    scriptPubKey: CoreScriptPubKey;
}
export interface CoreTxCoinbase {
    coinbase: string;
    sequence: number;
    txinwitness?: string[];
}
export interface CoreTxInput {
    coinbase?: undefined;
    txid: string;
    vout: number;
    scriptSig: CoreScriptSig;
    sequence: number;
    txinwitness?: string[];
    prevout: CoreTxPrevout | null;
}
export interface CoreTxOutput {
    value: number;
    n: number;
    scriptPubKey: CoreScriptPubKey;
}
export interface CoreTxData {
    txid: string;
    hash: string;
    version: number;
    size: number;
    vsize: number;
    weight: number;
    locktime: number;
    hex?: string;
    vin: (CoreTxCoinbase | CoreTxInput)[];
    vout: CoreTxOutput[];
    blockhash?: string;
    confirmations?: number;
    time?: number;
    blocktime?: number;
}
export interface CoreBlockData<T = CoreTxData> {
    hash: string;
    confirmations: number;
    height: number;
    version: number;
    versionHex: string;
    merkleroot: string;
    time: number;
    mediantime: number;
    nonce: number;
    bits: string;
    difficulty: number;
    chainwork: string;
    nTx: number;
    previousblockhash: string;
    nextblockhash?: string;
    strippedsize: number;
    size: number;
    weight: number;
    tx: T[];
}
export interface TxFeeInfo {
    base: number;
    effective_feerate: number;
    ancestor?: number;
    descendant?: number;
}
export interface TestMempoolResult {
    txid: string;
    wtxid: string;
    allowed: boolean;
    vsize?: number;
    fees?: TxFeeInfo;
    reject_reason?: string;
}
export interface TxPackageResult {
    txid: string;
    wtxid: string;
    vsize: number;
    fees: TxFeeInfo;
    error?: string;
}
export interface SubmitPackageResult {
    package_msg: string;
    tx_results: Record<string, TxPackageResult>;
    replaced_transactions?: string[];
}
export interface ScannedUtxo {
    txid: string;
    vout: number;
    scriptPubKey: string;
    desc: string;
    amount: number;
    coinbase: boolean;
    height: number;
}
export interface ScanTxOutsetResult {
    success: boolean;
    txouts: number;
    height: number;
    bestblock: string;
    unspents: ScannedUtxo[];
    total_amount: number;
}
export interface ListUnspentResult {
    txid: string;
    vout: number;
    address: string;
    label?: string;
    scriptPubKey: string;
    amount: number;
    confirmations: number;
    spendable: boolean;
    solvable: boolean;
    desc?: string;
    parent_descs?: string[];
    safe: boolean;
}
export interface MempoolInfo {
    loaded: boolean;
    size: number;
    bytes: number;
    usage: number;
    total_fee: number;
    maxmempool: number;
    mempoolminfee: number;
    minrelaytxfee: number;
    incrementalrelayfee: number;
    unbroadcastcount: number;
    fullrbf: boolean;
}
export interface SmartFeeEstimate {
    feerate: number;
    errors?: string[];
    blocks: number;
}
export interface NetworkInfo {
    version: number;
    subversion: string;
    protocolversion: number;
    localservices: string;
    localservicesnames: string[];
    localrelay: boolean;
    timeoffset: number;
    networkactive: boolean;
    connections: number;
    connections_in: number;
    connections_out: number;
    networks: NetworkInterface[];
    relayfee: number;
    incrementalfee: number;
    localaddresses: LocalAddress[];
    warnings: string;
}
export interface NetworkInterface {
    name: string;
    limited: boolean;
    reachable: boolean;
    proxy: string;
    proxy_randomize_credentials: boolean;
}
export interface LocalAddress {
    address: string;
    port: number;
    score: number;
}
export interface DecodedRawTransaction {
    txid: string;
    hash: string;
    version: number;
    size: number;
    vsize: number;
    weight: number;
    locktime: number;
    vin: DecodedTxInput[];
    vout: DecodedTxOutput[];
}
export interface DecodedTxInput {
    txid: string;
    vout: number;
    scriptSig: {
        asm: string;
        hex: string;
    };
    txinwitness?: string[];
    sequence: number;
}
export interface DecodedTxOutput {
    value: number;
    n: number;
    scriptPubKey: {
        asm: string;
        desc: string;
        hex: string;
        type: string;
        address?: string;
    };
}
