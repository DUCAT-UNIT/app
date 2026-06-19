import type { VaultCloseRequest } from '@ducat-unit/core';
import type { VaultCloseRequestCtx, VaultCloseRequestConfig } from '../../../types/index.js';
export declare function create_vault_close_ctx(vault_config: VaultCloseRequestConfig): VaultCloseRequestCtx;
export declare function create_vault_close_psbt(vault_ctx: VaultCloseRequestCtx): string;
export declare function create_vault_close_request(vault_ctx: VaultCloseRequestCtx, vault_psbt: string): VaultCloseRequest;
export declare namespace VaultCloseAPI {
    const create_ctx: typeof create_vault_close_ctx;
    const create_psbt: typeof create_vault_close_psbt;
    const create_request: typeof create_vault_close_request;
}
