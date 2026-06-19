import type { VaultCosignerScript, VaultLiquidationScript } from '../types/index.js';
export declare function parse_cosigner_script(script: string): VaultCosignerScript;
export declare function parse_liquidation_script(script: string): VaultLiquidationScript;
export declare function parse_script_pubkeys(script: string): string[];
