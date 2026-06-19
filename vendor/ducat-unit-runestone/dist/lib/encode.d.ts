import { Buff } from '@vbyte/buff';
import type { RunestoneSpec } from '../types/index.js';
export declare function encodeRunestone(runestone: RunestoneSpec): {
    encodedRunestone: Buff;
    etchingCommitment?: Buff;
};
