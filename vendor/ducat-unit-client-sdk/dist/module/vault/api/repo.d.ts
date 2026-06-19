import type { VaultRepoRequest } from '@ducat-unit/core';
import type { VaultRepoRequestCtx, VaultRepoRequestConfig } from '../../../types/index.js';
export declare function create_vault_repo_ctx(vault_config: VaultRepoRequestConfig): VaultRepoRequestCtx;
export declare function create_vault_repo_psbt(vault_ctx: VaultRepoRequestCtx): string;
export declare function create_vault_repo_request(vault_ctx: VaultRepoRequestCtx, vault_psbt: string): VaultRepoRequest;
export declare namespace VaultRepoAPI {
    const create_ctx: typeof create_vault_repo_ctx;
    const create_psbt: typeof create_vault_repo_psbt;
    const create_request: typeof create_vault_repo_request;
}
