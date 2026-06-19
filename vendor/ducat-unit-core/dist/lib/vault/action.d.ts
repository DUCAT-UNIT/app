import type { VaultAction } from '../../types/index.js';
export declare function get_vault_action_code(vault_action: VaultAction): number;
export declare function get_vault_action_vin_idx(vault_action: VaultAction): number;
export declare function get_vault_action_vout_idx(vault_action: VaultAction): number;
export declare function get_vault_action_label(action_code: number): VaultAction;
