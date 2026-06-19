/**
 * @fileoverview Protocol terms type definitions.
 */

export interface ProtcolTerms {
  govern : GovernTerms
  vault  : VaultTerms
}

export interface GovernTerms {
  prop_locktime  : number
  token_asset_id : string
  vote_locktime  : number
  voting_thold   : number
  quorum_thold   : number
}

export interface VaultTerms {
  liquidation_tax   : number
  liquidation_thold : number
  reserve_pubkey    : string
  reserve_sats_min  : number
  subsidy_increment : number
  subsidy_thold     : number
  unit_asset_id     : string
  unit_balance_min  : number
  vault_ratio_min   : number
  vault_value_min   : number
}
