/**
 * @fileoverview Vault state machine — defines states and validates transitions.
 *
 * States:
 * - empty: No vault exists (initial state)
 * - cleared: Vault exists with no debt (unit_balance = 0)
 * - encumbered: Vault exists with debt (unit_balance > 0)
 *
 * Valid Transitions:
 * - empty -> open -> encumbered or cleared
 * - cleared -> deposit/borrow -> encumbered
 * - cleared -> withdraw -> cleared
 * - cleared -> close -> empty
 * - encumbered -> repay -> cleared (if fully repaid) or encumbered
 * - encumbered -> deposit -> encumbered
 * - encumbered -> withdraw -> encumbered
 * - encumbered -> borrow -> encumbered
 * - encumbered -> liquidate/repo/trim -> cleared or encumbered
 */

import type { VaultAction, VaultReturnData } from '@/types/index.js'

export type VaultState = 'empty' | 'cleared' | 'encumbered'

/**
 * Determine the current state of a vault based on its return data.
 *
 * @param return_data - The vault return data to analyze
 * @returns The current vault state
 */
export function get_vault_state (return_data: VaultReturnData): VaultState {
  const { unit_balance, unit_price } = return_data

  if (unit_balance === 0 && unit_price === null) {
    return 'cleared'
  }
  if (unit_balance > 0 && unit_price !== null) {
    return 'encumbered'
  }
  // This shouldn't happen with valid data, but handle gracefully
  return 'empty'
}

/**
 * Get valid source states for a given vault action.
 *
 * @param action - The vault action to check
 * @returns Array of valid source states for the action
 */
export function get_valid_source_states (action: VaultAction): VaultState[] {
  const valid_transitions: Record<VaultAction, VaultState[]> = {
    'open':      ['empty'],
    'deposit':   ['cleared', 'encumbered'],
    'borrow':    ['cleared', 'encumbered'],
    'repay':     ['encumbered'],
    'withdraw':  ['cleared', 'encumbered'],
    'close':     ['cleared'],
    'liquidate': ['encumbered'],
    'repo':      ['encumbered'],
    'trim':      ['encumbered']
  }

  return valid_transitions[action]
}

/**
 * Check if a state transition is valid for the given action.
 *
 * @param current_state - The current vault state
 * @param action - The vault action being performed
 * @returns True if the transition is valid
 */
export function is_valid_transition (
  current_state : VaultState,
  action        : VaultAction
) : boolean {
  const allowed = get_valid_source_states(action)
  return allowed.includes(current_state)
}

/**
 * Verify state transition is valid for the given action.
 * This is a business logic check.
 *
 * @param current_state - The current vault state
 * @param action - The vault action being performed
 * @throws Error if the transition is not valid
 */
export function verify_state_transition (
  current_state : VaultState,
  action        : VaultAction
) : void {
  const allowed = get_valid_source_states(action)
  if (!allowed.includes(current_state)) {
    throw new Error(`verify_state_transition: cannot ${action} from ${current_state} state (allowed: ${allowed.join(', ')})`)
  }
}

/**
 * Verify vault action is valid given the return data.
 * Combines state determination and transition verification.
 *
 * @param return_data - The vault return data
 * @param action - The vault action being performed
 * @throws Error if the action is not valid for the current state
 */
export function verify_vault_action (
  return_data : VaultReturnData,
  action      : VaultAction
) : void {
  const current_state = get_vault_state(return_data)
  verify_state_transition(current_state, action)
}
