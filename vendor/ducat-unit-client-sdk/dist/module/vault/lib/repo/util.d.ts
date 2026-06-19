import type { LiquidVaultProfile, PriceCommitData } from '@ducat-unit/core';
export declare function find_price_commit_idx(price_commits: PriceCommitData[], thold_key: string): number | null;
export declare function get_liquid_script_idx(guard_index: number, thold_count: number, thold_idx: number): number;
export declare function get_price_commit_thold_hash(commits: PriceCommitData[], index: number): Uint8Array;
export declare function get_claimed_sats_amount(liquid_profiles: LiquidVaultProfile[]): number;
export declare function verify_liquid_script(scripts: Uint8Array[], script_idx: number, thold_bytes: Uint8Array): void;
