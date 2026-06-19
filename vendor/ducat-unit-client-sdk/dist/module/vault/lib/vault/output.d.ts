import type { PriceCommitData, PSBTOutput } from '@ducat-unit/core';
import type { VaultRequestCtx } from '../../../../types/index.js';
export declare function create_vault_commit_vout(vault_ctx: VaultRequestCtx, fund_value: number): PSBTOutput;
export declare function create_vault_connector_vout(vault_ctx: VaultRequestCtx, fund_value: number): PSBTOutput;
export declare function create_pledged_vault_output(client_pubkey: string, guard_pubkeys: string[], price_commits: PriceCommitData[], vault_amount: number): PSBTOutput;
export declare function create_cleared_vault_output(client_pubkey: string, guard_pubkeys: string[], vault_amount: number): PSBTOutput;
export declare function create_vault_output(vault_ctx: VaultRequestCtx, unit_balance: number, vault_balance: number): PSBTOutput;
export declare function create_sats_change_output(vault_ctx: VaultRequestCtx, change_amt: number): PSBTOutput;
export declare function create_vault_return_output(vault_ctx: VaultRequestCtx): PSBTOutput;
