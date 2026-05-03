import { ApiResponse, EsploraAddressData, EsploraAddressUtxo, EsploraTxData } from '../../../types/index.js';
export declare function esplora_get_tx(esplora_url: string, txid: string): Promise<ApiResponse<EsploraTxData>>;
export declare function esplora_get_address_data(esplora_url: string, address: string): Promise<ApiResponse<EsploraAddressData>>;
export declare function esplora_get_utxos(esplora_url: string, address: string, filter?: number[]): Promise<ApiResponse<EsploraAddressUtxo[]>>;
export declare function esplora_publish_tx(esplora_url: string, txhex: string): Promise<ApiResponse<string>>;
