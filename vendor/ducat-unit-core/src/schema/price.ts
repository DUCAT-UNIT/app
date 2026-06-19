/**
 * @fileoverview Price observation/quote/contract/commit schema definitions.
 */

import { z } from 'zod'

import { base, chain } from '@/schema/index.js'

import type {
  PriceContract,
  PriceCommitData,
  PriceQuote,
  PriceObservation
} from '@/types/index.js'

export const observation = z.object({
  base_price    : base.uint,
  base_stamp    : base.stamp,
  chain_network : chain.network,
  oracle_pubkey : base.hex32
}) satisfies z.ZodType<PriceObservation>

export const quote = z.object({
  ...observation.shape,
  rate_min   : base.float,
  rate_max   : base.float,
  rate_thold : base.float,
  step_size  : base.float
}) satisfies z.ZodType<PriceQuote>

export const contract = z.object({
  ...observation.shape,
  commit_hash : base.hex32,
  contract_id : base.hex32,
  oracle_sig  : base.hex64,
  thold_key   : base.hex32.nullable(),
  thold_hash  : base.hex20,
  thold_price : base.uint
}) satisfies z.ZodType<PriceContract>

export const commit = z.object({
  base_price    : base.uint,
  oracle_pubkey : base.hex32,
  oracle_sig    : base.hex64,
  thold_hash    : base.hex20,
  thold_price   : base.uint
}) satisfies z.ZodType<PriceCommitData>
