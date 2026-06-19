import type { VaultAction, VaultReturnData } from '../../types/index.js';
export type VaultState = 'empty' | 'cleared' | 'encumbered';
export declare function get_vault_state(return_data: VaultReturnData): VaultState;
export declare function get_valid_source_states(action: VaultAction): VaultState[];
export declare function is_valid_transition(current_state: VaultState, action: VaultAction): boolean;
export declare function verify_state_transition(current_state: VaultState, action: VaultAction): void;
export declare function verify_vault_action(return_data: VaultReturnData, action: VaultAction): void;
