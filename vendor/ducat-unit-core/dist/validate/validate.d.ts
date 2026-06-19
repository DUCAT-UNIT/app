import type { AssetProfile, ProtoProfile, VaultProfile } from '../types/index.js';
export declare function validate_asset_account(data: unknown): asserts data is AssetProfile;
export declare function validate_proto_profile(profile: unknown): asserts profile is ProtoProfile;
export declare function validate_vault_profile(profile: unknown): asserts profile is VaultProfile;
