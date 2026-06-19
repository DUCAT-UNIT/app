/**
 * @fileoverview runestone-ts/src/lib/typeguards.ts
 */

import type { Cenotaph, RunestoneSpec } from '../types/index.js';

/** Type guard for decoded artifact being a valid runestone (not cenotaph). */
export function isRunestone(artifact: RunestoneSpec | Cenotaph): artifact is RunestoneSpec {
  return !('flaws' in artifact);
}
