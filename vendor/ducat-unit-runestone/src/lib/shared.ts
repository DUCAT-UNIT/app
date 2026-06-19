/**
 * @fileoverview runestone-ts/src/lib/shared.ts
 */

import { Flaw as FlawEnum } from '../flaw.js';
import { u128, u32, u64, u8 } from '../integer/index.js';
import type { Flaw } from '../types/index.js';

/** Map internal flaw enum value to wire/string representation. */
export function getFlawString(flaw: FlawEnum): Flaw {
  switch (flaw) {
    case FlawEnum.EDICT_OUTPUT:
      return 'edict_output';
    case FlawEnum.EDICT_RUNE_ID:
      return 'edict_rune_id';
    case FlawEnum.INVALID_SCRIPT:
      return 'invalid_script';
    case FlawEnum.OPCODE:
      return 'opcode';
    case FlawEnum.SUPPLY_OVERFLOW:
      return 'supply_overflow';
    case FlawEnum.TRAILING_INTEGERS:
      return 'trailing_integers';
    case FlawEnum.TRUNCATED_FIELD:
      return 'truncated_field';
    case FlawEnum.UNRECOGNIZED_EVEN_TAG:
      return 'unrecognized_even_tag';
    case FlawEnum.UNRECOGNIZED_FLAG:
      return 'unrecognized_flag';
    case FlawEnum.VARINT:
      return 'varint';
  }
}

/** Convert number to bounded `u8` value with overflow guard. */
export function u8Strict(n: number): u8 {
  const bigN = BigInt(n);
  if (bigN < 0n || bigN > u8.MAX) {
    throw Error('u8 overflow');
  }
  return u8(bigN);
}

/** Convert number to bounded `u32` value with overflow guard. */
export function u32Strict(n: number): u32 {
  const bigN = BigInt(n);
  if (bigN < 0n || bigN > u32.MAX) {
    throw Error('u32 overflow');
  }
  return u32(bigN);
}

/** Convert bigint to bounded `u64` value with overflow guard. */
export function u64Strict(n: bigint): u64 {
  const bigN = BigInt(n);
  if (bigN < 0n || bigN > u64.MAX) {
    throw Error('u64 overflow');
  }
  return u64(bigN);
}

/** Convert bigint to bounded `u128` value with overflow guard. */
export function u128Strict(n: bigint): u128 {
  const bigN = BigInt(n);
  if (bigN < 0n || bigN > u128.MAX) {
    throw Error('u128 overflow');
  }
  return u128(bigN);
}
