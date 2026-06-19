import { ProtoWallet } from '../../../module/wallet/class/wallet.js';
import type { CoinUtxo } from '@ducat-unit/core';
export type SignPSBTEntry = [string, SignPSBTManifest];
export type SignPSBTManifest = {
    [key: string]: number[];
};
export interface ProtoWalletConnectAPI {
    fetch: {
        funds: (client: ProtoWallet) => () => Promise<CoinUtxo[]>;
        manifest?: (client: ProtoWallet) => (psbt: string) => Promise<SignPSBTManifest>;
    };
    sign: {
        batch?: (client: ProtoWallet) => (psbts: SignPSBTEntry[]) => Promise<string[]>;
        coins: (client: ProtoWallet) => (psbt: string) => Promise<string>;
        psbt: (client: ProtoWallet) => (psbt: string, vins: Record<string, number[]>) => Promise<string>;
    };
}
