import { get_vault_terms } from '../../../lib/proto/terms.js';
export const POLICY_FLAG = {
    DIRECTION: 'direction_violation',
    RATIO_FLOOR: 'ratio_floor_violation',
    REPAY_WORSENED: 'repay_ratio_worsened',
    VALUE_FLOOR: 'vault_value_floor_violation',
    STALE_PRICE: 'stale_price_commit',
    BUCKET: 'bucket_policy_violation',
    LIQ_FORMULA: 'liquidation_formula_violation',
    FEE: 'fee_policy_violation'
};
export function make_flag(code, detail) {
    return { code, detail };
}
function check_ratio_floor(vault_profile, terms, label) {
    if (vault_profile.vault_ratio !== null && vault_profile.vault_ratio < terms.vault_ratio_min) {
        return make_flag(POLICY_FLAG.RATIO_FLOOR, `${label} ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`);
    }
    return null;
}
export function eval_vault_open_policy(proto_profile, vault_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    const flag = check_ratio_floor(vault_profile, terms, 'open');
    if (flag !== null)
        flags.push(flag);
    return flags;
}
export function eval_vault_borrow_policy(proto_profile, vault_profile, _prev_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    const flag = check_ratio_floor(vault_profile, terms, 'borrow');
    if (flag !== null)
        flags.push(flag);
    return flags;
}
export function eval_vault_repay_policy(proto_profile, vault_profile, prev_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    if (vault_profile.vault_balance > prev_profile.vault_balance) {
        flags.push(make_flag(POLICY_FLAG.DIRECTION, `repay must not increase collateral (${vault_profile.vault_balance} > ${prev_profile.vault_balance})`));
        return flags;
    }
    const withdrew = vault_profile.vault_balance < prev_profile.vault_balance;
    if (!withdrew)
        return flags;
    if (vault_profile.unit_balance === 0) {
        if (vault_profile.vault_balance < terms.vault_value_min) {
            flags.push(make_flag(POLICY_FLAG.VALUE_FLOOR, `repay collateral ${vault_profile.vault_balance} < value min ${terms.vault_value_min}`));
        }
        return flags;
    }
    if (vault_profile.vault_ratio !== null && prev_profile.vault_ratio !== null &&
        vault_profile.vault_ratio < prev_profile.vault_ratio) {
        flags.push(make_flag(POLICY_FLAG.REPAY_WORSENED, `repay ratio ${vault_profile.vault_ratio} < prev ${prev_profile.vault_ratio}`));
    }
    const floor_flag = check_ratio_floor(vault_profile, terms, 'repay');
    if (floor_flag !== null)
        flags.push(floor_flag);
    return flags;
}
export function eval_vault_repo_policy(proto_profile, vault_profile, prev_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    if (vault_profile.vault_balance <= prev_profile.vault_balance) {
        flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA, `repo liquidator collateral did not increase (${vault_profile.vault_balance} <= ${prev_profile.vault_balance})`));
    }
    if (vault_profile.unit_balance <= prev_profile.unit_balance) {
        flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA, `repo liquidator debt did not increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`));
    }
    if (vault_profile.vault_ratio === null) {
        flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR, `repo post-state has no ratio (expected >= ${terms.vault_ratio_min})`));
    }
    else if (vault_profile.vault_ratio < terms.vault_ratio_min) {
        flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR, `repo post-state ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`));
    }
    return flags;
}
export function eval_vault_trim_policy(proto_profile, vault_profile, prev_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    if (vault_profile.vault_balance <= prev_profile.vault_balance) {
        flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA, `trim liquidator collateral did not increase (${vault_profile.vault_balance} <= ${prev_profile.vault_balance})`));
    }
    if (vault_profile.unit_balance <= prev_profile.unit_balance) {
        flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA, `trim liquidator debt did not increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`));
    }
    if (vault_profile.vault_ratio === null) {
        flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR, `trim post-state has no ratio (expected >= ${terms.vault_ratio_min})`));
    }
    else if (vault_profile.vault_ratio < terms.vault_ratio_min) {
        flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR, `trim post-state ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`));
    }
    return flags;
}
export function eval_vault_withdraw_policy(proto_profile, vault_profile, _prev_profile) {
    const flags = [];
    const terms = get_vault_terms(proto_profile.proto_terms);
    if (vault_profile.unit_balance > 0) {
        const flag = check_ratio_floor(vault_profile, terms, 'withdraw');
        if (flag !== null)
            flags.push(flag);
    }
    else if (vault_profile.vault_balance < terms.vault_value_min) {
        flags.push(make_flag(POLICY_FLAG.VALUE_FLOOR, `withdraw collateral ${vault_profile.vault_balance} < value min ${terms.vault_value_min}`));
    }
    return flags;
}
