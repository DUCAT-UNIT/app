/**
 * @fileoverview Policy-violation flag surface for vault actions. Holds the stable flag
 * codes and the `make_flag` factory; per-action `eval_vault_<action>_policy`
 * evaluators are added here by later tasks. Evaluators return a (possibly
 * empty) array of PolicyFlags and NEVER throw — policy failures soft-fail on
 * the confirmed chain (index + flag); clients/guardians reject them before
 * broadcast.
 */

import { get_vault_terms } from '@/lib/proto/terms.js'

import type {
  PolicyFlag,
  PolicyFlagCode,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

/** Stable string codes for every deterministic policy flag. */
export const POLICY_FLAG = {
  DIRECTION       : 'direction_violation',
  RATIO_FLOOR     : 'ratio_floor_violation',
  REPAY_WORSENED  : 'repay_ratio_worsened',
  VALUE_FLOOR     : 'vault_value_floor_violation',
  STALE_PRICE     : 'stale_price_commit',
  BUCKET          : 'bucket_policy_violation',
  LIQ_FORMULA     : 'liquidation_formula_violation',
  FEE             : 'fee_policy_violation'
} as const satisfies Record<string, PolicyFlagCode>

/** Construct a structured policy flag. */
export function make_flag (code : PolicyFlagCode, detail : string) : PolicyFlag {
  return { code, detail }
}

/**
 * Shared encumbered ratio-floor check for open/borrow/repay/withdraw: returns a
 * RATIO_FLOOR flag when the resulting vault ratio is below the protocol minimum,
 * or null when it holds (or the ratio is null — a debt-free vault is guarded by
 * the value floor instead). `label` prefixes the flag detail.
 *
 * (Repo/trim are deliberately not routed through this — they treat a null
 * post-state ratio as a violation, which is the opposite of the skip here.)
 */
function check_ratio_floor (
  vault_profile : VaultProfile,
  terms         : ReturnType<typeof get_vault_terms>,
  label         : string
) : PolicyFlag | null {
  if (vault_profile.vault_ratio !== null && vault_profile.vault_ratio < terms.vault_ratio_min) {
    return make_flag(POLICY_FLAG.RATIO_FLOOR,
      `${label} ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`)
  }
  return null
}

/** Open policy: resulting ratio must meet the floor. */
export function eval_vault_open_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)
  const flag  = check_ratio_floor(vault_profile, terms, 'open')
  if (flag !== null) flags.push(flag)
  return flags
}

/** Borrow policy: resulting ratio must meet the floor. Collateral may move
 *  (deposit, withdraw, or unchanged) — that is allowed, not a violation. */
export function eval_vault_borrow_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  _prev_profile : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)
  const flag  = check_ratio_floor(vault_profile, terms, 'borrow')
  if (flag !== null) flags.push(flag)
  return flags
}

/** Repay policy: pure repayment is always fine. Repay-with-withdrawal must not
 *  worsen the ratio, must hold the floor while encumbered, and a full repay
 *  that withdraws must leave a debt-free vault above the value floor. */
export function eval_vault_repay_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)

  // Direction rule (docs/VALIDATION.md): repay collateral is unchanged or
  // decreases. An increase is a forbidden direction, not a withdrawal.
  if (vault_profile.vault_balance > prev_profile.vault_balance) {
    flags.push(make_flag(POLICY_FLAG.DIRECTION,
      `repay must not increase collateral (${vault_profile.vault_balance} > ${prev_profile.vault_balance})`))
    return flags
  }

  const withdrew = vault_profile.vault_balance < prev_profile.vault_balance
  if (!withdrew) return flags

  if (vault_profile.unit_balance === 0) {
    // Full repay with withdrawal → debt-free value floor.
    if (vault_profile.vault_balance < terms.vault_value_min) {
      flags.push(make_flag(POLICY_FLAG.VALUE_FLOOR,
        `repay collateral ${vault_profile.vault_balance} < value min ${terms.vault_value_min}`))
    }
    return flags
  }

  // Partial repay with withdrawal: must not worsen ratio, must hold floor.
  // prev_profile.vault_ratio is null only for a debt-free prior vault, which
  // cannot reach this branch (unit_balance > 0), so the null skip is purely
  // protective. The floor check below guards vault_ratio independently.
  if (
    vault_profile.vault_ratio !== null && prev_profile.vault_ratio !== null &&
    vault_profile.vault_ratio < prev_profile.vault_ratio
  ) {
    flags.push(make_flag(POLICY_FLAG.REPAY_WORSENED,
      `repay ratio ${vault_profile.vault_ratio} < prev ${prev_profile.vault_ratio}`))
  }
  const floor_flag = check_ratio_floor(vault_profile, terms, 'repay')
  if (floor_flag !== null) flags.push(floor_flag)
  return flags
}

/** Repo/liquidator policy: collateral and debt must increase (absorption),
 *  and the post-state ratio must hold the floor. Economic-formula failures
 *  soft-fail with liquidation_formula_violation. */
export function eval_vault_repo_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)
  if (vault_profile.vault_balance <= prev_profile.vault_balance) {
    flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA,
      `repo liquidator collateral did not increase (${vault_profile.vault_balance} <= ${prev_profile.vault_balance})`))
  }
  if (vault_profile.unit_balance <= prev_profile.unit_balance) {
    flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA,
      `repo liquidator debt did not increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`))
  }
  if (vault_profile.vault_ratio === null) {
    flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR,
      `repo post-state has no ratio (expected >= ${terms.vault_ratio_min})`))
  } else if (vault_profile.vault_ratio < terms.vault_ratio_min) {
    flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR,
      `repo post-state ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`))
  }
  return flags
}

/** Trim/liquidator policy: collateral and debt must increase (partial
 *  absorption), and the post-state ratio must hold the floor. */
export function eval_vault_trim_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)
  if (vault_profile.vault_balance <= prev_profile.vault_balance) {
    flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA,
      `trim liquidator collateral did not increase (${vault_profile.vault_balance} <= ${prev_profile.vault_balance})`))
  }
  if (vault_profile.unit_balance <= prev_profile.unit_balance) {
    flags.push(make_flag(POLICY_FLAG.LIQ_FORMULA,
      `trim liquidator debt did not increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`))
  }
  if (vault_profile.vault_ratio === null) {
    flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR,
      `trim post-state has no ratio (expected >= ${terms.vault_ratio_min})`))
  } else if (vault_profile.vault_ratio < terms.vault_ratio_min) {
    flags.push(make_flag(POLICY_FLAG.RATIO_FLOOR,
      `trim post-state ratio ${vault_profile.vault_ratio} < min ${terms.vault_ratio_min}`))
  }
  return flags
}

/** Withdraw policy: encumbered vault holds the ratio floor; debt-free vault
 *  holds the sat-value floor. */
export function eval_vault_withdraw_policy (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  _prev_profile : VaultProfile
) : PolicyFlag[] {
  const flags : PolicyFlag[] = []
  const terms = get_vault_terms(proto_profile.proto_terms)
  if (vault_profile.unit_balance > 0) {
    const flag = check_ratio_floor(vault_profile, terms, 'withdraw')
    if (flag !== null) flags.push(flag)
  } else if (vault_profile.vault_balance < terms.vault_value_min) {
    flags.push(make_flag(POLICY_FLAG.VALUE_FLOOR,
      `withdraw collateral ${vault_profile.vault_balance} < value min ${terms.vault_value_min}`))
  }
  return flags
}
