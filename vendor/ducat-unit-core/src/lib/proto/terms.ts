/**
 * @fileoverview Proto terms accessor — resolve vault terms from a proto profile.
 */

import { Test }    from '@vbyte/util'
import { SYMBOLS } from '@/const.js'
import * as SCHEMA from '@/schema/index.js'

import type {
  ProtoTermRecord,
  TermValue,
  VaultTerms
} from '@/types/index.js'

/**
 * Filter term records down to those belonging to a given term group.
 * @param entries - Proto term records to filter
 * @param group   - Term group (store) identifier to match
 * @returns The subset of entries whose `group` equals the given group
 */
export function filter_terms (
  entries : ProtoTermRecord[],
  group   : number
) : ProtoTermRecord[] {
  // Return the filteredentries by the given domain.
  return entries.filter(entry => entry.group === group)
}

/**
 * Find a term record by key and normalize its value(s).
 *
 * Returns the single contained value when the record holds exactly one value,
 * the full value array when it holds more than one, or `undefined` when no
 * record matches the key.
 * @param entries - Proto term records to search
 * @param key     - Term key to look up
 * @returns The single value, the value array, or `undefined` if not found
 */
export function find_term_value (
  entries : ProtoTermRecord[],
  key     : number
) : TermValue | TermValue[] | undefined {
  // Find the entry with the given key.
  const proto_term = entries.find(entry => entry.key === key)
  // If the entry is not an array, return undefined.
  if (!Test.exists(proto_term)) return undefined
  // Return the first value if it's a single value, otherwise return the array.
  return (proto_term.value.length === 1) ? proto_term.value[0] : proto_term.value
}

/** Parse and validate vault-related term values from protocol term records. */
export function get_vault_terms (
  term_entries : ProtoTermRecord[]
) : VaultTerms {
  // Filter the term entries for the vault store.
  const entries = filter_terms(term_entries, SYMBOLS.STORE.VAULT)
  // Parse the term values.
  const values  = {
    liquidation_tax   : find_term_value(entries, SYMBOLS.TERM.VAULT.LIQUIDATION_TAX),
    liquidation_thold : find_term_value(entries, SYMBOLS.TERM.VAULT.LIQUIDATION_THOLD),
    reserve_pubkey    : find_term_value(entries, SYMBOLS.TERM.VAULT.RESERVE_PUBKEY),
    reserve_sats_min  : find_term_value(entries, SYMBOLS.TERM.VAULT.RESERVE_VALUE_MIN),
    subsidy_increment : find_term_value(entries, SYMBOLS.TERM.VAULT.SUBSIDY_INCREMENT),
    subsidy_thold     : find_term_value(entries, SYMBOLS.TERM.VAULT.SUBSIDY_THOLD),
    unit_asset_id     : find_term_value(entries, SYMBOLS.TERM.VAULT.UNIT_ASSET_ID),
    unit_balance_min  : find_term_value(entries, SYMBOLS.TERM.VAULT.UNIT_BALANCE_MIN),
    vault_ratio_min   : find_term_value(entries, SYMBOLS.TERM.VAULT.VAULT_RATIO_MIN),
    vault_value_min   : find_term_value(entries, SYMBOLS.TERM.VAULT.VAULT_VALUE_MIN),
  }
  // Return the parsed vault terms.
  return SCHEMA.terms.vault.parse(values)
}
