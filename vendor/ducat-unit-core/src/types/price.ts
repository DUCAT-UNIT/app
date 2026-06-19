/**
 * @fileoverview Price quote/contract/commit type definitions.
 */

import type { ChainNetwork } from './chain.js'

export type PriceCommitEntry = [
  oracle_idx  : number,
  base_price  : number,
  thold_price : number,
  thold_hash  : string,
  oracle_sig  : string
]

export interface PriceCommitData {
  base_price    : number
  oracle_pubkey : string
  oracle_sig    : string
  thold_hash    : string
  thold_price   : number
}

export interface PriceObservation {
  base_price    : number
  base_stamp    : number
  chain_network : ChainNetwork
  oracle_pubkey : string
}

export interface PriceQuote extends PriceObservation {
  rate_min   : number
  rate_max   : number
  rate_thold : number
  step_size  : number
}

export interface PriceContract extends PriceObservation {
  commit_hash : string
  contract_id : string
  oracle_sig  : string
  thold_hash  : string
  thold_key   : string | null
  thold_price : number
}

export interface PriceBucket {
  base_rate : number
  contract  : PriceContract
}

export interface ActivePriceContract extends PriceContract {
  thold_key : null
}

export interface BreachedPriceContract extends PriceContract {
  thold_key : string
}
