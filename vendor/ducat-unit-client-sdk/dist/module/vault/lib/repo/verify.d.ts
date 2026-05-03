import type { LiquidationTerms, LiquidVaultProfile } from '../../../../types/index.js';
export declare function verify_repo_portion(repo_portion: number): void;
export declare function verify_liquid_threshold(liquid_terms: LiquidationTerms, collateral_ratio: number): void;
export declare function verify_return_balances(repo_portion: number, return_sats: number, return_unit: number): void;
export declare function verify_batch_liquidate(vaults: LiquidVaultProfile[]): void;
