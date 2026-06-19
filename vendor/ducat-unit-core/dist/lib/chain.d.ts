import type { AddressNetwork, ChainNetwork } from '../types/chain.js';
export declare function to_chain_network(network: string): ChainNetwork;
export declare function to_address_network(network: ChainNetwork): AddressNetwork;
export declare function normalize_address_network(network: string): AddressNetwork;
