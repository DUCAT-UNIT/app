import type { RpcResponse, RpcClientConfig, CoreBlockData, CoreTxData, TestMempoolResult, SubmitPackageResult, ScanTxOutsetResult, ListUnspentResult, MempoolInfo, SmartFeeEstimate, NetworkInfo, DecodedRawTransaction } from '../types/rpc.js';
export type { RpcClientConfig };
export declare class RpcClient {
    private readonly _config;
    constructor(config: RpcClientConfig);
    call<T = unknown>(method: string, params?: unknown[]): Promise<RpcResponse<T>>;
    private _call;
    get_block_count(): Promise<number>;
    get_block_hash(height: number): Promise<string>;
    get_block(hash: string, verbosity: 0): Promise<string>;
    get_block(hash: string, verbosity: 1): Promise<CoreBlockData<string>>;
    get_block(hash: string, verbosity?: 2 | 3): Promise<CoreBlockData<CoreTxData>>;
    get_raw_transaction(txid: string, verbose: false): Promise<string>;
    get_raw_transaction(txid: string, verbose?: true): Promise<CoreTxData>;
    send_raw_transaction(hex: string): Promise<string>;
    test_mempool_accept(rawtxs: string[]): Promise<TestMempoolResult[]>;
    submit_package(rawtxs: string[]): Promise<SubmitPackageResult>;
    scan_tx_outset(action: 'start' | 'abort' | 'status', scanobjects: string[]): Promise<ScanTxOutsetResult>;
    list_unspent(minconf?: number, maxconf?: number, addresses?: string[]): Promise<ListUnspentResult[]>;
    get_mempool_info(): Promise<MempoolInfo>;
    get_network_info(): Promise<NetworkInfo>;
    estimate_smart_fee(conf_target: number, estimate_mode?: 'unset' | 'economical' | 'conservative'): Promise<SmartFeeEstimate>;
    decode_raw_transaction(hex: string): Promise<DecodedRawTransaction>;
}
