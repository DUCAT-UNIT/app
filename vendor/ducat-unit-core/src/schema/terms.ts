/**
 * @fileoverview Protocol terms schema definitions (price/vault).
 */

import { z } from 'zod'

import * as asset  from './asset.js'
import * as base   from './base.js'

import type { VaultTerms } from '@/types/index.js'

export const vault = z.object({
  liquidation_tax   : base.float,
  liquidation_thold : base.float,
  reserve_pubkey    : base.hex32,
  reserve_sats_min  : base.ulong,
  subsidy_increment : base.float,
  subsidy_thold     : base.float,
  unit_asset_id     : asset.asset_id,
  unit_balance_min  : base.uint,
  vault_ratio_min   : base.float,
  vault_value_min   : base.ulong,
}) satisfies z.ZodType<VaultTerms>
