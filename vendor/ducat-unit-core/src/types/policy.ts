/**
 * @fileoverview Deterministic policy-violation flag surface. A policy flag is a warning
 * derived only from chain data, protocol profile, and indexed vault state —
 * every conforming validator derives the same flags from the same inputs.
 * See docs/VALIDATION.md ("Policy Violation Flags").
 */

export type PolicyFlagCode =
  | 'direction_violation'
  | 'ratio_floor_violation'
  | 'repay_ratio_worsened'
  | 'vault_value_floor_violation'
  | 'stale_price_commit'
  | 'bucket_policy_violation'
  | 'liquidation_formula_violation'
  | 'fee_policy_violation'

export interface PolicyFlag {
  code   : PolicyFlagCode
  detail : string
}
