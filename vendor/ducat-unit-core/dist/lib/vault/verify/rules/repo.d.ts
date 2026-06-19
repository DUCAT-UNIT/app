import type { LiquidVaultProfile, ProtoProfile, VaultProfile } from '../../../../types/index.js';
export declare function verify_vault_repo_strict(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile, targets: Array<{
    liquid: LiquidVaultProfile;
    prev: VaultProfile;
}>): void;
export declare function verify_vault_repo(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile, targets: Array<{
    liquid: LiquidVaultProfile;
    prev: VaultProfile;
}>): void;
