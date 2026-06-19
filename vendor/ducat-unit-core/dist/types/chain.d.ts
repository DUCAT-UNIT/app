import { CHAIN_NETWORKS } from '../const.js';
export type ChainNetwork = typeof CHAIN_NETWORKS[number];
export type AddressNetwork = 'main' | 'testnet' | 'regtest';
