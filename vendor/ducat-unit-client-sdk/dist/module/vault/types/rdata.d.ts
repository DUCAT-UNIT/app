import type { VaultActionFlag } from '../../../types/index.js';
export type VaultReturnData = LockedVaultReturnData | ClearedVaultReturnData;
export interface VaultReturnSchema {
    is_locked: boolean;
    thold_hash?: string;
    thold_price?: number;
    unit_balance: number;
    unit_price: number;
    unit_stamp: number;
    vault_action: VaultActionFlag;
}
export interface LockedVaultReturnData extends VaultReturnSchema {
    is_locked: true;
    thold_hash: string;
    thold_price: number;
}
export interface ClearedVaultReturnData extends VaultReturnSchema {
    is_locked: false;
}
