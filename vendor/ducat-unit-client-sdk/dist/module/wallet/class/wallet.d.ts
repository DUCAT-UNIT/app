import type { ProtoWalletAccountAPI, ProtoWalletAccountData, ProtoWalletConfig, ProtoWalletConnectAPI, ProtoWalletOptions } from '../types/index.js';
import type { ObserveContext } from '../../../lib/observe/index.js';
export declare class ProtoWallet {
    private readonly _acct;
    private readonly _conf;
    private readonly _conn;
    private readonly _observe;
    constructor(accounts: ProtoWalletAccountAPI, connector: ProtoWalletConnectAPI, options: ProtoWalletOptions);
    get account(): ProtoWalletAccountData;
    get config(): ProtoWalletConfig;
    get connector(): ProtoWalletConnectAPI;
    get observe(): ObserveContext;
    get fetch(): {
        assets: (validator_url: string, asset_id: string, asset_amount: number, balance_type?: import("@ducat-unit/core").AssetBalanceType) => Promise<import("@ducat-unit/core").AssetAccount[]>;
        funds: (funds_amount?: number) => Promise<import("@ducat-unit/core").CoinUtxo[]>;
        manifest: (psbt: string) => Promise<import("../types/connect.js").SignPSBTManifest>;
        vaults: (validator_url: string) => Promise<import("@ducat-unit/core").VaultProfile[]>;
    };
    get sign(): {
        batch: (psbts: string[]) => Promise<string[]>;
        coins: (psbt: string) => Promise<string>;
        psbt: (psbt: string) => Promise<string>;
    };
}
