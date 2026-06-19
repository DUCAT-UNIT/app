import type { ChainNetwork } from './chain.js';
export type TermValue = string | number | boolean | null;
export type AnchorAssetEntry = [asset_id: string, mint_commit: string];
export type AnchorSignerEntry = [group: number, id: number, pubkey: string];
export type AnchorTermEntry = [group: number, key: number, ...values: TermValue[]];
export interface AnchorContract {
    assets: AnchorAssetEntry[];
    boot: number;
    domain: string;
    network: string;
    signers: AnchorSignerEntry[];
    terms: AnchorTermEntry[];
}
export interface AnchorData {
    anchor_id: string;
    anchor_height: number;
    anchor_index: number;
    anchor_txid: string;
    boot_height: number;
    chain_network: ChainNetwork;
    domain_hash: string;
}
export interface AnchorProfile extends AnchorData {
    anchor_assets: AnchorAssetEntry[];
    anchor_signers: AnchorSignerEntry[];
    anchor_terms: AnchorTermEntry[];
}
