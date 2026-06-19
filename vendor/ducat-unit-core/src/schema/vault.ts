/**
 * @fileoverview Vault action, commit, return-data, and profile schema definitions.
 */

import { z } from 'zod'

import {
  VAULT_MAX_GUARD_COUNT,
  VAULT_MAX_ORACLE_COUNT
} from '@/const.js'

import * as base  from './base.js'
import * as coin  from './coin.js'
import * as price from './price.js'

import type {
  VaultProfile,
  VaultHistoryProfile,
  VaultReturnData,
  VaultConfigData,
  VaultAction,
  VaultConfigPayload,
  VaultSequenceData
} from '@/types/index.js'

export const action = z.enum([
  'open', 'close', 'borrow', 'repay', 'liquidate', 'repo', 'trim', 'withdraw', 'deposit'
]) satisfies z.ZodType<VaultAction>

export const commit = z.object({
  lbl : base.str
}) satisfies z.ZodType<VaultConfigPayload>

export const config = z.object({
  label : base.str
}) satisfies z.ZodType<VaultConfigData>

export const rdata = z.object({
  guard_members  : z.array(base.hex32).min(1).max(VAULT_MAX_GUARD_COUNT),
  price_commits  : z.array(price.commit).max(VAULT_MAX_ORACLE_COUNT),
  price_stamp    : base.stamp.nullable(),  // Must be positive when set
  unit_balance   : base.uint,              // Can be 0 for cleared vaults
  unit_price     : base.uint.nullable(),   // Must be positive when set
  thold_price    : base.uint.nullable()    // Must be positive when set
}) satisfies z.ZodType<VaultReturnData>

export const sdata = z.object({
  vault_action  : action,
  vault_version : base.char
}) satisfies z.ZodType<VaultSequenceData>

export const profile = z.object({
  ...rdata.shape,
  ...sdata.shape,
  coin_id        : coin.coin_id.nullable(),
  client_pubkey  : base.hex32,
  contract_id    : base.hex32,
  guard_pubkey   : base.hex32,
  root_txid      : base.hex32,
  vault_balance  : base.uint,
  vault_config   : config.nullable(),
  vault_ratio    : base.float.nullable(),
  vault_script   : base.hex.nullable(),
  vault_value    : base.ulong.nullable()
}) satisfies z.ZodType<VaultProfile>

export const history_profile = z.object({
  ...profile.shape,
  block_height : base.uint,
  block_stamp  : base.stamp
}) satisfies z.ZodType<VaultHistoryProfile>

export const cosign_witness = z.tuple([ base.hex64, base.hex64, base.hex, base.hex ])
export const liquid_witness = z.tuple([ base.hex32, base.hex64, base.hex, base.hex ])
