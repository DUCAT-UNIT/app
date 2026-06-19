import type { PSBTOutput } from '@ducat-unit/core';
import type { VaultBorrowRequestConfig, VaultBorrowRequestCtx, VaultOpenRequestConfig, VaultOpenRequestCtx, VaultRepayRequestCtx } from '../../../../types/index.js';
export declare function create_issue_account_output(vault_ctx: VaultOpenRequestConfig | VaultBorrowRequestConfig): PSBTOutput;
export declare function create_issue_change_output(vault_ctx: VaultOpenRequestCtx | VaultBorrowRequestCtx): PSBTOutput;
export declare function create_unit_change_output(vault_ctx: VaultOpenRequestCtx | VaultBorrowRequestCtx | VaultRepayRequestCtx): PSBTOutput;
