import type { LiquidVaultProfile, ProtoProfile, VaultProfile } from '../../../../types/index.js';
export declare function verify_vault_trim_strict(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile, target: {
    liquid: LiquidVaultProfile;
    prev: VaultProfile;
}): void;
export declare function verify_vault_trim(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile, target: {
    liquid: LiquidVaultProfile;
    prev: VaultProfile;
}): void;
