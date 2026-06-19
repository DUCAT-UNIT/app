import type { PSBTOutput, VaultProfile } from '@ducat-unit/core';
import type { VaultRequestCtx } from '../../../../types/index.js';
export declare function create_liquid_vault_locked_output(vault_profile: VaultProfile, vault_amount: number): PSBTOutput;
export declare function create_liquid_vault_cleared_output(vault_profile: VaultProfile, vault_amount: number): PSBTOutput;
export declare function create_reserve_spend_output(vault_ctx: VaultRequestCtx, reserve_amount: number): PSBTOutput;
