import type { LiquidVaultProfile, ProtoProfile, VaultProfile } from '../../../../types/index.js';
export declare function verify_vault_liquidate(proto_profile: ProtoProfile, vault_profile: LiquidVaultProfile, prev_profile: VaultProfile): void;
export declare function verify_vault_repo_liquidated(proto_profile: ProtoProfile, target: LiquidVaultProfile, target_prev: VaultProfile): void;
export declare function verify_vault_trim_liquidated(proto_profile: ProtoProfile, target: LiquidVaultProfile, target_prev: VaultProfile): void;
