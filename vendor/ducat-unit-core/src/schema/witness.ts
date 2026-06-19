/**
 * @fileoverview Witness commit/record schema definitions.
 */

import { z } from 'zod'

import * as Base  from './base.js'
import * as Chain from './chain.js'
import * as Coin  from './coin.js'

import type {
  WitnessCommit,
  WitnessRecord
} from '@/types/index.js'

export const commit_id = Chain.scribe_id

export const data = z.object({
  author     : Base.hex32,
  commit_id  : commit_id,
  commit_ref : Base.str.nullable(),
  content    : Base.str.nullable(),
  mimetype   : Base.str.nullable(),
})

export const record = data.extend({
  commit_ref : Base.str,
  content    : Base.str,
  mimetype   : Base.str,
}) satisfies z.ZodType<WitnessRecord>

export const commit = z.object({
  ...data.shape,
  coin_id     : Coin.coin_id,
  coin_index  : Base.uint,
  seq_code    : Base.short,
  seq_version : Base.char,
}) satisfies z.ZodType<WitnessCommit>
