import type { LiquidationConfig, LiquidationQuote, LiquidVaultProfile, ProtocolProfile, TermsMap, VaultProfile } from '../../../../types/index.js';
export declare function get_liquid_profile(proto_profile: ProtocolProfile, liquid_vault: VaultProfile, thold_key: string, coin_price: number, repo_portion?: number): LiquidVaultProfile;
export declare function get_liquidation_quote(proto_terms: TermsMap, liquid_config: LiquidationConfig): LiquidationQuote;
