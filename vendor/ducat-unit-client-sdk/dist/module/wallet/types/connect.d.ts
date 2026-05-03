import { VaultWallet } from '../class/wallet.js';
import type { BaseUtxo, ChainNetwork, RuneAddressBalance, RuneData, RuneUtxoMap, VaultTokenMap } from '../../../types/index.js';
export type SignPSBTEntry = [string, PSBTManifest];
export type PSBTManifest = {
    [key: string]: number[];
};
export interface WalletAccount {
    address: string;
    pubkey: string;
}
export interface WalletAccountRecord {
    sats: WalletAccount;
    runes: WalletAccount;
    vault: WalletAccount;
}
export interface WalletBalance {
    sats_bal: number;
    rune_bal: Map<string, RuneData>;
}
export interface WalletConfig {
    indexer: {
        ord: string;
        esp: string;
    };
    network: ChainNetwork;
    postage: {
        unit: number;
        vault: number;
    };
}
export interface WalletConnectAPI {
    fetch: {
        balance: (client: VaultWallet) => () => Promise<RuneAddressBalance>;
        sats_utxos: (client: VaultWallet) => () => Promise<BaseUtxo[]>;
        rune_utxos: (client: VaultWallet) => (cache?: RuneUtxoMap) => Promise<RuneUtxoMap>;
        vault_tokens: (client: VaultWallet) => (cache?: VaultTokenMap) => Promise<VaultTokenMap>;
    };
    sign: {
        batch?: (client: VaultWallet) => (psbts: SignPSBTEntry[]) => Promise<string[]>;
        psbt: (client: VaultWallet) => (psbt: string, vins: Record<string, number[]>) => Promise<string>;
        utxos: (client: VaultWallet) => (psbt: string) => Promise<string>;
    };
}
