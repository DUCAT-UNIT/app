export interface ProtoWalletAccountAPI {
    asset: {
        pubkey: string;
    };
    funds: {
        pubkey: string;
        version: number;
    };
    vault: {
        pubkey: string;
    };
}
export interface ProtoWalletAccount {
    address: string;
    keydata: string;
    pubkey: string;
    version: number;
}
export interface ProtoWalletAccountData {
    asset: ProtoWalletAccount;
    funds: ProtoWalletAccount;
    vault: ProtoWalletAccount;
}
