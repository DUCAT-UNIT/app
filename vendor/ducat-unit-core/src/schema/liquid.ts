/**
 * @fileoverview Liquidation quote and liquid-vault schema definitions.
 */

import { z } from 'zod'

import * as Base  from './base.js'
import * as Price from './price.js'
import * as Vault from './vault.js'

import type {
  LiquidationQuote,
  LiquidVaultProfile
} from '@/types/index.js'

export const quote = z.object({
  claimed_sats     : Base.ulong,
  claimed_unit     : Base.uint,
  deficit_ratio    : Base.float,
  deficit_sats     : Base.ulong,
  reserve_rate     : Base.float,
  reserve_sats     : Base.ulong,
  reward_ratio     : Base.float,
  reward_sats      : Base.ulong,
  subsidy_multi    : Base.float,
  subsidy_rate     : Base.float,
}) satisfies z.ZodType<LiquidationQuote>

/**
 * A breached price contract is a PriceContract whose `thold_key` has
 * been revealed (non-null). The base price-contract schema accepts
 * either nullable or revealed; this tightened variant rejects active
 * (untriggered) contracts at the schema layer. Used as liquidation
 * *construction* input (`LiquidVaultConfig.breach_contracts`); the
 * serialized `LiquidVaultProfile` does not store it — see `liquid_key`.
 */
export const breached_contract = Price.contract.extend({
  thold_key : Base.hex32
})

export const vault = z.object({
  ...Vault.profile.shape,
  ...quote.shape,
  liquid_key       : Base.hex32,
  liquid_price     : Base.uint,
}) satisfies z.ZodType<LiquidVaultProfile>
