import type { VaultBorrowRequest } from '@ducat-unit/core';
import type { VaultBorrowRequestConfig, VaultBorrowRequestCtx } from '../../../types/index.js';
export declare function create_vault_borrow_ctx(vault_config: VaultBorrowRequestConfig): VaultBorrowRequestCtx;
export declare function create_vault_borrow_psbt1(vault_ctx: VaultBorrowRequestCtx): string;
export declare function create_vault_borrow_psbt2(vault_ctx: VaultBorrowRequestCtx, issue_psbt: string | Uint8Array): string;
export declare function create_vault_borrow_psbts(vault_ctx: VaultBorrowRequestCtx): string[];
export declare function create_vault_borrow_request(vault_ctx: VaultBorrowRequestCtx, vault_psbts: string[]): VaultBorrowRequest;
export declare namespace VaultBorrowAPI {
    const create_ctx: typeof create_vault_borrow_ctx;
    const create_psbts: typeof create_vault_borrow_psbts;
    const create_request: typeof create_vault_borrow_request;
}
