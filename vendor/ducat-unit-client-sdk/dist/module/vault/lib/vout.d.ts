import type { PSBTBaseOutput, VaultOpenCtx, VaultBaseCtx, LiquidationCtx } from '../../../types/index.js';
export declare function create_vault_open_conn_out(vault_ctx: VaultOpenCtx, fund_value: number): PSBTBaseOutput;
export declare function create_vault_fund_conn_out(vault_ctx: VaultBaseCtx, fund_value: number): PSBTBaseOutput;
export declare function create_vault_locked_spend_out(guard_pubkey: string, thold_hash: string, vault_amount: number, vault_pubkey: string): PSBTBaseOutput;
export declare function create_vault_cleared_spend_out(guard_pubkey: string, vault_amount: number, vault_pubkey: string): PSBTBaseOutput;
export declare function create_vault_spend_out(vault_ctx: VaultBaseCtx, unit_bal: number, vault_amt: number): PSBTBaseOutput;
export declare function create_reserve_spend_out(liquid_ctx: LiquidationCtx): PSBTBaseOutput;
export declare function create_change_out(vault_ctx: VaultBaseCtx, change_amt: number): PSBTBaseOutput;
