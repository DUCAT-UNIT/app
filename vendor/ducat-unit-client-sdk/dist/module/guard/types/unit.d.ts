import type { ChainNetwork, VaultActionLabel, AccountProfile, SubscriptionEventMap } from '../../../types/index.js';
export type UnitSubscriptionMap = SubscriptionEventMap<UnitAccountResponse>;
export interface UnitAccountConfig {
    unit_amount: number;
    vault_action: VaultActionLabel;
    vault_pubkey: string;
}
export interface UnitAccountRequest extends UnitAccountConfig {
    network: ChainNetwork;
}
export interface UnitAccountResponse {
    mint_account: AccountProfile;
    vault_action: VaultActionLabel;
    vault_pubkey: string;
}
