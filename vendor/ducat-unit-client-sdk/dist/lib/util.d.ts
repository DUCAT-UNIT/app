import { Bytes } from '@cmdcode/buff';
import type { ChainNetwork, ContractProfile, ProtocolProfile } from '../types/index.js';
type Network = 'main' | 'testnet' | 'regtest' | 'signet';
export declare function get_vsize(bytes: Bytes): number;
export declare function get_chain_network(network: ChainNetwork): Network;
export declare function create_proto_profile(profile: ContractProfile, network?: Network): ProtocolProfile;
export {};
