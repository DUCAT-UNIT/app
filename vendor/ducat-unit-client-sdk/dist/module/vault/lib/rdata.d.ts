import { Buff } from '@cmdcode/buff';
import { VaultReturnData, VaultBaseCtx, LockedVaultReturnData, ClearedVaultReturnData, VaultRepoCtx, LiquidationCtx } from '../../../types/index.js';
export declare function get_vault_return_data(vault_ctx: VaultBaseCtx, unit_bal: number): VaultReturnData;
export declare function get_vault_cleared_data(vault_ctx: VaultBaseCtx): ClearedVaultReturnData;
export declare function get_vault_locked_data(vault_ctx: VaultBaseCtx, unit_balance: number): LockedVaultReturnData;
export declare function get_liquid_vault_return_data(liquid_ctx: LiquidationCtx, vault_ctx: VaultRepoCtx): VaultReturnData;
export declare function create_vault_return(data: VaultReturnData): {
    amount: bigint;
    script: Buff;
};
export declare function parse_vault_return(script: string, version?: number): VaultReturnData;
