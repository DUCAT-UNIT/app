import { Buff } from '@vbyte/buff';
import { script } from './script.js';
export declare namespace Instruction {
    function isNumber(instruction: script.Instruction): instruction is number;
    function isBuffer(instruction: script.Instruction): instruction is Buff;
}
type GrowToSize<T, N extends number, A extends T[]> = A['length'] extends N ? A : GrowToSize<T, N, [...A, T]>;
export type FixedArray<T, N extends number> = GrowToSize<T, N, []>;
export {};
