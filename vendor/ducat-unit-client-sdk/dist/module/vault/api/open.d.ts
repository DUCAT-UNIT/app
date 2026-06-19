import type { VaultOpenRequest } from '@ducat-unit/core';
import type { VaultOpenRequestCtx, VaultOpenRequestConfig } from '../../../types/index.js';
export declare function create_vault_open_ctx(vault_config: VaultOpenRequestConfig): VaultOpenRequestCtx;
export declare function create_vault_open_psbt_1(vault_ctx: VaultOpenRequestCtx): string;
export declare function create_vault_open_psbt_2(vault_ctx: VaultOpenRequestCtx, issue_psbt: string | Uint8Array): string;
export declare function create_vault_open_psbt_pkg(vault_ctx: VaultOpenRequestCtx): string[];
export declare function create_vault_open_request(vault_ctx: VaultOpenRequestCtx, signed_psbts: string[]): VaultOpenRequest;
export declare namespace VaultOpenAPI {
    const create_ctx: typeof create_vault_open_ctx;
    const create_psbts: typeof create_vault_open_psbt_pkg;
    const create_request: typeof create_vault_open_request;
}
