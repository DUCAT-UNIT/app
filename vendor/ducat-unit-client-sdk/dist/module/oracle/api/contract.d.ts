import type { ApiResponse, ContractPointer, GuardContract, MasterContract, OracleContract, RecordFetchConfig, TermsContract } from '../../../types/index.js';
export declare function fetch_master_contract(ord_url: string, identifier: string): Promise<ApiResponse<MasterContract>>;
export declare function fetch_child_contract<T>(ord_url: string, pointer: ContractPointer, options?: Partial<RecordFetchConfig>): Promise<ApiResponse<T>>;
export declare function fetch_guard_contract(ord_url: string, pointer: ContractPointer, ival?: number): Promise<ApiResponse<GuardContract>>;
export declare function fetch_oracle_contract(ord_url: string, pointer: ContractPointer, ival?: number): Promise<ApiResponse<OracleContract>>;
export declare function fetch_terms_contract(ord_url: string, pointer: ContractPointer, ival?: number): Promise<ApiResponse<TermsContract>>;
