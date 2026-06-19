import { Buff } from '@vbyte/buff';
import { Network } from './network.js';
import { u128, u32, u64 } from './integer/index.js';
export declare class Rune {
    readonly value: u128;
    static readonly STEPS: u128[];
    constructor(value: u128);
    static getMinimumAtHeight(chain: Network, height: u128): Rune;
    get reserved(): boolean;
    get commitment(): Buff;
    static getReserved(block: u64, tx: u32): Rune;
    toString(): string;
    static fromString(s: string): Rune;
}
