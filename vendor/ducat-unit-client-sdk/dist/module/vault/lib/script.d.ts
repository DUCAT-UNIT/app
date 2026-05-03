import type { VaultOpenCtx } from '../../../types/index.js';
export declare function create_vault_open_conn_script(vault_ctx: VaultOpenCtx): Uint8Array[];
export declare function create_vault_fund_conn_script(guard_pk: string, vault_pk: string): Uint8Array[];
export declare function create_vault_locked_spend_script(guard_pk: string, thold_hash: string, vault_pk: string): Uint8Array[];
export declare function create_vault_cleared_spend_script(guard_pk: string, vault_pk: string): Uint8Array[];
