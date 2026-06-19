/**
 * @fileoverview runestone-ts/src/tag.ts
 */

import { Buff } from '@vbyte/buff';
import { None, Option, Some } from './monads.js';
import { u128 } from './integer/index.js';
import { FixedArray } from './utils.js';

export enum Tag {
  BODY = 0,
  FLAGS = 2,
  RUNE = 4,

  PREMINE = 6,
  CAP = 8,
  AMOUNT = 10,
  HEIGHT_START = 12,
  HEIGHT_END = 14,
  OFFSET_START = 16,
  OFFSET_END = 18,
  MINT = 20,
  POINTER = 22,
  CENOTAPH = 126,

  DIVISIBILITY = 1,
  SPACERS = 3,
  SYMBOL = 5,
  NOP = 127,
}

export namespace Tag {
  export function take<N extends number, T extends {}>(
    tag: Tag,
    fields: Map<u128, u128[]>,
    n: N,
    withFn: (values: FixedArray<u128, N>) => Option<T>
  ): Option<T> {
    const field = fields.get(u128(tag));
    if (field === undefined) {
      return None;
    }

    const values: u128[] = [];
    for (const i of [...Array(n).keys()]) {
      if (field[i] === undefined) {
        return None;
      }
      values[i] = field[i];
    }

    const optionValue = withFn(values as FixedArray<u128, N>);
    if (optionValue.isNone()) {
      return None;
    }

    field.splice(0, n);

    if (field.length === 0) {
      fields.delete(u128(tag));
    }

    return Some(optionValue.unwrap());
  }

  export function encode(tag: Tag, values: u128[]): Buff {
    return Buff.join(
      values.flatMap((value) => [u128.encodeVarInt(u128(tag)), u128.encodeVarInt(value)])
    );
  }

  export function encodeOptionInt(tag: Tag, value: Option<number | bigint>) {
    return value.map((value) => Tag.encode(tag, [u128(value)])).unwrapOr(Buff.from([]));
  }
}
