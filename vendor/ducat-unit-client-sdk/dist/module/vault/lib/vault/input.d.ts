import type { CoinUtxo, PSBTInput, VaultAction, VaultProfile } from '@ducat-unit/core';
import type { VaultOpenRequestCtx, VaultRequestCtx, VaultUpdateCtx } from '../../../../types/index.js';
export declare function create_vault_commit_input(vault_ctx: VaultOpenRequestCtx, vault_utxo: CoinUtxo): PSBTInput;
export declare function create_vault_conn_input(vault_ctx: VaultRequestCtx, conn_utxo: CoinUtxo): PSBTInput;
export declare function create_vault_cleared_input(vault_action: VaultAction, vault_profile: VaultProfile, guard_pubkey: string): PSBTInput;
export declare function create_vault_pledged_input(vault_action: VaultAction, vault_profile: VaultProfile, guard_pubkey: string): PSBTInput;
export declare function create_vault_spend_input(vault_ctx: VaultUpdateCtx): PSBTInput;
