import type { ApiResponse, ProtoFetchConfig, ProtocolProfile, ChainNetwork } from '../../../types/index.js';
export declare function fetch_master_id(esp_url: string, ord_url: string, master_pk: string, network?: ChainNetwork, ival?: number): Promise<ApiResponse<string>>;
export declare function fetch_master_ctx(ord_url: string, master_id: string, options?: Partial<ProtoFetchConfig>): Promise<ApiResponse<ProtocolProfile>>;
