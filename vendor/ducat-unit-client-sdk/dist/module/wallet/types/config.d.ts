import type { ObserveContext, ObservabilityOptions } from '../../../lib/observe/index.js';
import type { ChainNetwork } from '@ducat-unit/core';
export interface ProtoWalletRuntimeOptions {
    observability?: ObservabilityOptions | ObserveContext;
}
export type ProtoWalletOptions = Partial<ProtoWalletConfig> & ProtoWalletRuntimeOptions;
export interface ProtoWalletConfig {
    asset_postage: number;
    chain_network: ChainNetwork;
    txfee_rate: number;
    txfee_reserve: number;
}
