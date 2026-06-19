import type { LiquidVaultProfile } from '@ducat-unit/core';
import type { VaultBaseRequestConfig, VaultRequestCtx } from '../../../types/index.js';
export declare function verify_liquidator_vault_transition(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_liquid_vaults_eligible(liquid_profiles: LiquidVaultProfile[]): void;
export declare function verify_liquid_vault_transitions(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
export declare function verify_liquidation_amounts(vault_ctx: VaultRequestCtx<VaultBaseRequestConfig>): void;
