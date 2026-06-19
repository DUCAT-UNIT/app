import type { PriceCommitData } from '@ducat-unit/core';
import type { VaultRequestCtx } from '../../../../module/vault/types/context.js';
export declare function create_commit_script(vault_ctx: VaultRequestCtx): Uint8Array;
export declare function create_connector_script(client_pubkey: string, guard_pubkey: string): Uint8Array;
export declare function create_cleared_vault_script_tree(client_pubkey: string, guard_pubkeys: string[]): Uint8Array[];
export declare function create_pledged_vault_script_tree(client_pubkey: string, guard_pubkeys: string[], price_commits: PriceCommitData[]): Uint8Array[];
