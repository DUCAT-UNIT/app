import type { LiquidVaultProfile, LiquidVaultConfig, VaultProfile } from '../../types/index.js';
export declare function get_liquid_vault_profiles(liquid_config: LiquidVaultConfig, vault_profiles: VaultProfile[]): LiquidVaultProfile[];
export declare function get_liquid_vault_profile(liquid_config: LiquidVaultConfig, vault_profile: VaultProfile, recap_amount?: number): LiquidVaultProfile;
