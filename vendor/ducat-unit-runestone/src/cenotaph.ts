/**
 * @fileoverview runestone-ts/src/cenotaph.ts
 */

import { Flaw } from './flaw.js';
import { None, Option } from './monads.js';
import { Rune } from './rune.js';
import { RuneId } from './runeid.js';

export class Cenotaph {
  readonly type = 'cenotaph';

  constructor(
    readonly flaws: Flaw[],
    readonly etching: Option<Rune> = None,
    readonly mint: Option<RuneId> = None
  ) {}
}
