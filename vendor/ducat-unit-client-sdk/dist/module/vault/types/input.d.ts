import type { BaseUtxo, SignedUtxo, TermsMap } from '../../../types/index.js';
export interface AccountInput {
    acct_id: string;
    acct_utxo: BaseUtxo;
}
export interface LiquidInput extends SignedUtxo {
    repo_portion: number;
    vault_pubkey: string;
}
export interface ProtoInput {
    contract_id: string;
    guard_pubkey: string;
    proto_terms: TermsMap;
    unit_rune_id: string;
    unit_rune_lbl: string;
}
export interface VaultInput {
    vault_balance: number;
    vault_pubkey: string;
    vault_utxo: BaseUtxo;
}
