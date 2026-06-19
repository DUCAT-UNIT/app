import type { RunestoneTx } from '../runestone.js';
import type { Cenotaph, RunestoneSpec } from '../types/index.js';
export declare function tryDecodeRunestone(tx: RunestoneTx): RunestoneSpec | Cenotaph | null;
