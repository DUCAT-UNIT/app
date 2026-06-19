import type { LiquidTxInput, LiquidVaultProfile, ProtoProfile, VaultProfile } from '../../types/index.js';
export declare function build_repo_liquidated_target(proto_profile: ProtoProfile, liquid_txinput: LiquidTxInput, prev_profile: VaultProfile, liquid_price: number): LiquidVaultProfile;
export declare function build_trim_liquidated_target(proto_profile: ProtoProfile, liquid_txinput: LiquidTxInput, prev_profile: VaultProfile, liquid_price: number, trim_amount: number): LiquidVaultProfile;
