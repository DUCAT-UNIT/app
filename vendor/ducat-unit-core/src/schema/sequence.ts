/**
 * @fileoverview Sequence field variant schema definitions.
 */

import { z } from 'zod'

import * as Base from './base.js'

import {
  SequenceData,
  SequenceMetaData,
  SequenceNull,
  SequenceNumber,
  SequenceTimelock
} from '@/types/index.js'

export const type = z.enum(['number', 'timelock', 'metadata', 'null'])

export const nullified = z.object({
  type : z.literal('null')
}) satisfies z.ZodType<SequenceNull>

export const number = z.object({
  type  : z.literal('number'),
  value : Base.uint
}) satisfies z.ZodType<SequenceNumber>

export const timelock = z.object({
  format : z.enum(['height', 'stamp']),
  type   : z.literal('timelock'),
  value  : Base.uint
}) satisfies z.ZodType<SequenceTimelock>

export const metadata = z.object({
  code    : Base.short,
  type    : z.literal('metadata'),
  version : Base.char
}) satisfies z.ZodType<SequenceMetaData>

export const data = z.discriminatedUnion('type', [
  nullified,
  number,
  timelock,
  metadata
]) satisfies z.ZodType<SequenceData>
