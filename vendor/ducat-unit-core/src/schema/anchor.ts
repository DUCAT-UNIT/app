/**
 * @fileoverview Anchor contract/data/profile schema definitions.
 */

import { z } from 'zod'

import * as Asset from './asset.js'
import * as Base  from './base.js'
import * as Chain from './chain.js'

import { ANCHOR_TERMS_MAX } from '@/const.js'

import type { AnchorContract, AnchorData, AnchorProfile } from '../types/anchor.js'

const asset_entry  = z.tuple([ Asset.asset_id, Base.hex ])
const signer_entry = z.tuple([ Base.char, Base.char, Base.hex32 ])
const term_entry   = z.tuple([ Base.char, Base.char ]).rest(Base.literal)
const anchor_id    = Base.hex32

export const contract = z.object({
  assets  : z.array(asset_entry).min(1).max(100),
  boot    : Base.uint,
  domain  : Base.hex20,
  network : Chain.network,
  signers : z.array(signer_entry).min(1).max(100),
  terms   : z.array(term_entry).max(ANCHOR_TERMS_MAX),
}) satisfies z.ZodType<AnchorContract>

export const data = z.object({
  anchor_id,
  anchor_height : Base.uint,
  anchor_index  : Base.uint,
  anchor_txid   : Base.hex32,
  boot_height   : Base.uint,
  chain_network : Chain.network,
  domain_hash   : Base.hex20,
}) satisfies z.ZodType<AnchorData>

export const profile = data.extend({
  anchor_assets  : z.array(asset_entry).min(1).max(100),
  anchor_signers : z.array(signer_entry).min(1).max(100),
  anchor_terms   : z.array(term_entry).max(ANCHOR_TERMS_MAX)
}) satisfies z.ZodType<AnchorProfile>
