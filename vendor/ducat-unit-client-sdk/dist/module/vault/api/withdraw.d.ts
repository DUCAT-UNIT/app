import type { VaultWithdrawRequest } from '@ducat-unit/core';
import type { VaultWithdrawRequestCtx, VaultWithdrawRequestConfig } from '../../../types/index.js';
export declare function create_vault_withdraw_ctx(vault_config: VaultWithdrawRequestConfig): VaultWithdrawRequestCtx;
export declare function create_vault_withdraw_psbt(vault_ctx: VaultWithdrawRequestCtx): string;
export declare function create_vault_withdraw_request(vault_ctx: VaultWithdrawRequestCtx, vault_psbt: string): VaultWithdrawRequest;
export declare namespace VaultWithdrawAPI {
    const create_ctx: typeof create_vault_withdraw_ctx;
    const create_psbt: typeof create_vault_withdraw_psbt;
    const create_request: typeof create_vault_withdraw_request;
}
