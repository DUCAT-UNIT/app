import { BaseUtxo, VaultOpenCtx, PSBTBaseInput, VaultBaseCtx, VaultRepoCtx, VaultInput, LiquidVaultProfile } from '../../../types/index.js';
export declare function create_vault_open_conn_vin(vault_ctx: VaultOpenCtx, vault_utxo: BaseUtxo): PSBTBaseInput;
export declare function create_vault_fund_conn_vin(vault_ctx: VaultBaseCtx, conn_utxo: BaseUtxo): PSBTBaseInput;
export declare function create_vault_cleared_spend_vin(guard_pubkey: string, vault_pubkey: string, vault_utxo: BaseUtxo): PSBTBaseInput;
export declare function create_vault_locked_spend_vin(guard_pubkey: string, thold_hash: string, vault_pubkey: string, vault_utxo: BaseUtxo): PSBTBaseInput;
export declare function create_vault_spend_vin(vault_ctx: VaultBaseCtx & VaultInput): PSBTBaseInput;
export declare function create_liquid_spend_vin(vault_ctx: VaultRepoCtx, vault_profile: LiquidVaultProfile): PSBTBaseInput;
