import type { PSBTOutput } from '@ducat-unit/core';
import type { VaultBorrowRequestCtx, VaultOpenRequestCtx, VaultRepayRequestCtx } from '../../../../types/index.js';
export declare function create_unit_issue_runestone(vault_ctx: VaultOpenRequestCtx | VaultBorrowRequestCtx): PSBTOutput;
export declare function create_unit_burn_runestone(vault_ctx: VaultRepayRequestCtx, route_change?: boolean): PSBTOutput;
