import type { ProtoWallet } from '../class/wallet.js';
export declare function sign_psbt_api(client: ProtoWallet): (psbt: string) => Promise<string>;
export declare function sign_batch_api(client: ProtoWallet): (psbts: string[]) => Promise<string[]>;
