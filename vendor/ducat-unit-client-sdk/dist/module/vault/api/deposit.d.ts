import type { VaultDepositRequest } from '@ducat-unit/core';
import { VaultDepositRequestConfig, VaultDepositRequestCtx } from '../../../types/index.js';
export declare function create_vault_deposit_ctx(vault_config: VaultDepositRequestConfig): VaultDepositRequestCtx;
export declare function create_vault_deposit_psbt(vault_ctx: VaultDepositRequestCtx): string;
export declare function create_vault_deposit_request(vault_ctx: VaultDepositRequestCtx, vault_psbt: string): VaultDepositRequest;
export declare namespace VaultDepositAPI {
    const create_ctx: typeof create_vault_deposit_ctx;
    const create_psbt: typeof create_vault_deposit_psbt;
    const create_request: typeof create_vault_deposit_request;
}
