/**
 * @fileoverview Protocol contract/profile schema definitions.
 */

import { z }       from 'zod'

import * as Anchor from './anchor.js'
import * as Asset  from './asset.js'
import * as Base   from './base.js'

import {
  PROTO_ASSETS_MAX,
  PROTO_LITERAL_MAX,
  PROTO_MEMBERS_MAX,
  PROTO_TERMS_MAX
} from '@/const.js'

import type {
  ProtoProfile,
  ProtoContractData,
  ProtoMemberRecord,
  ProtoTermRecord
} from '@/types/index.js'

export const signer_record = z.object({
  group  : Base.char,
  idx    : Base.char,
  pubkey : Base.hex32,
}) satisfies z.ZodType<ProtoMemberRecord>

export const term_record = z.object({
  group : Base.char,
  key   : Base.char,
  value : z.array(Base.literal).max(PROTO_LITERAL_MAX),
}) satisfies z.ZodType<ProtoTermRecord>

export const data = z.object({
  contract_height : Base.uint,
  contract_index  : Base.uint,
  contract_txid   : Base.hex32,
  chain_height    : Base.uint,
  contract_id     : Base.hex32,
  proto_assets    : z.array(Asset.profile).max(PROTO_ASSETS_MAX),
  proto_members   : z.array(signer_record).max(PROTO_MEMBERS_MAX),
  proto_terms     : z.array(term_record).max(PROTO_TERMS_MAX),
}) satisfies z.ZodType<ProtoContractData>

export const profile = Anchor.data.extend(data.shape) satisfies z.ZodType<ProtoProfile>
