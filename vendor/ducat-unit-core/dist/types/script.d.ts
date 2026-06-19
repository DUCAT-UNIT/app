export interface VaultCosignerScript {
    client_pubkey: string;
    guard_pubkey: string;
}
export interface VaultCommitScript extends VaultCosignerScript {
    data_payload: string;
}
export interface VaultLiquidationScript {
    guard_pubkey: string;
    liquid_hash: string;
}
