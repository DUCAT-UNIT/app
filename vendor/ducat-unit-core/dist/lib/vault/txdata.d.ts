import { ProtoTxData, VaultTxData, VaultTxContext, VaultConfigData, CoinUtxo, ProtoTxInput, LiquidTxInput, VaultReturnData, ProtoProfile } from '../../types/index.js';
export declare function extract_vault_ctx(txdata: ProtoTxData): VaultTxContext | null;
export declare function extract_vault_config(txdata: ProtoTxData): VaultConfigData | null;
export declare function extract_vault_connector_input(txdata: ProtoTxData): ProtoTxInput | null;
export declare function extract_vault_ratio(proto_profile: ProtoProfile, vault_return: VaultReturnData | null, vault_utxo: CoinUtxo | null): number | null;
export declare function extract_vault_return_data(proto_profile: ProtoProfile, proto_txdata: ProtoTxData): VaultReturnData | null;
export declare function extract_vault_txdata(proto_profile: ProtoProfile, proto_txdata: ProtoTxData | string): VaultTxData | null;
export declare function extract_liquid_inputs(proto_txdata: ProtoTxData | string): LiquidTxInput[];
export declare function extract_liquid_thold_key(liquid: LiquidTxInput): string;
