import type { PolicyFlag, PolicyFlagCode, ProtoProfile, VaultProfile } from '../../../types/index.js';
export declare const POLICY_FLAG: {
    readonly DIRECTION: "direction_violation";
    readonly RATIO_FLOOR: "ratio_floor_violation";
    readonly REPAY_WORSENED: "repay_ratio_worsened";
    readonly VALUE_FLOOR: "vault_value_floor_violation";
    readonly STALE_PRICE: "stale_price_commit";
    readonly BUCKET: "bucket_policy_violation";
    readonly LIQ_FORMULA: "liquidation_formula_violation";
    readonly FEE: "fee_policy_violation";
};
export declare function make_flag(code: PolicyFlagCode, detail: string): PolicyFlag;
export declare function eval_vault_open_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile): PolicyFlag[];
export declare function eval_vault_borrow_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile, _prev_profile: VaultProfile): PolicyFlag[];
export declare function eval_vault_repay_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile): PolicyFlag[];
export declare function eval_vault_repo_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile): PolicyFlag[];
export declare function eval_vault_trim_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile, prev_profile: VaultProfile): PolicyFlag[];
export declare function eval_vault_withdraw_policy(proto_profile: ProtoProfile, vault_profile: VaultProfile, _prev_profile: VaultProfile): PolicyFlag[];
