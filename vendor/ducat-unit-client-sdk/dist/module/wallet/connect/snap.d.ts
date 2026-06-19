import { ProtoWallet } from '../../../module/wallet/class/wallet.js';
import type { ChainNetwork } from '@ducat-unit/core';
export interface SnapProvider {
    request: (args: {
        method: string;
        params?: unknown;
    }) => Promise<unknown>;
}
export declare function create_snap_wallet(provider: SnapProvider, network?: ChainNetwork): Promise<ProtoWallet>;
