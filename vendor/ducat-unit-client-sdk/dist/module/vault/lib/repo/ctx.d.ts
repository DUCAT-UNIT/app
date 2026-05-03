import type { LiquidationCtx, LiquidVaultProfile, ProtocolProfile } from '../../../../types/index.js';
export declare function get_liquidation_ctx(liquid_vaults: LiquidVaultProfile[], proto_contract: ProtocolProfile): LiquidationCtx;
export declare function get_liquid_sats_total(liquid_vaults: LiquidVaultProfile[]): number;
export declare function get_liquid_unit_total(liquid_vaults: LiquidVaultProfile[]): number;
