import type { VaultTxData, ProtoProfile, VaultProfile, CoinUtxo, PriceContract } from '../../types/index.js';
export declare function get_vault_profile_utxo(vault_profile: VaultProfile): CoinUtxo;
export declare function collect_vault_price_contracts(proto_profile: ProtoProfile, vault_profiles: VaultProfile[]): PriceContract[];
export declare function get_vault_profile_price_hashes(proto_profile: ProtoProfile, vault_profile: VaultProfile): string[];
export declare function get_vault_profile_ratio(proto_profile: ProtoProfile, vault_profile: VaultProfile): number | null;
export declare function create_vault_profile(proto_profile: ProtoProfile, vault_txdata: VaultTxData): VaultProfile;
export declare function create_vault_close_profile(proto_profile: ProtoProfile, prev_profile: VaultProfile, vault_txdata: VaultTxData): VaultProfile;
export declare function update_vault_profile(proto_profile: ProtoProfile, vault_profile: VaultProfile, vault_txdata: VaultTxData): VaultProfile;
