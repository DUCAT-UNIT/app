export interface VaultBaseResponse {
    vault_tx: string;
    vault_txid: string;
}
export interface VaultOpenResponse {
    issue_tx: string;
    issue_txid: string;
    vault_tx: string;
    vault_txid: string;
}
export interface VaultBorrowResponse extends VaultOpenResponse {
}
export interface VaultRepayResponse extends VaultBaseResponse {
    burn_tx: string;
    burn_txid: string;
}
