import type { OrdTxResponse, VaultActionFlag, VaultActionLabel, VaultPrevout } from '../../../types/index.js';
export declare function parse_vault_prevout(res: OrdTxResponse): VaultPrevout;
export declare function get_vault_output_idx(action: VaultActionFlag): number;
export declare function get_vault_input_idx(action: VaultActionFlag): number;
export declare function get_vault_return_idx(action: VaultActionFlag): number;
export declare function parse_vault_id(identifier: string): string;
export declare function get_vault_action_label(action: VaultActionFlag): VaultActionLabel;
