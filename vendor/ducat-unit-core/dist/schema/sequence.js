import { z } from 'zod';
import * as Base from './base.js';
export const type = z.enum(['number', 'timelock', 'metadata', 'null']);
export const nullified = z.object({
    type: z.literal('null')
});
export const number = z.object({
    type: z.literal('number'),
    value: Base.uint
});
export const timelock = z.object({
    format: z.enum(['height', 'stamp']),
    type: z.literal('timelock'),
    value: Base.uint
});
export const metadata = z.object({
    code: Base.short,
    type: z.literal('metadata'),
    version: Base.char
});
export const data = z.discriminatedUnion('type', [
    nullified,
    number,
    timelock,
    metadata
]);
