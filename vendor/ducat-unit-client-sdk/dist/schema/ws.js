import { z } from 'zod';
import { base } from '@ducat-unit/core/schema';
export const data = z.union([z.record(base.str, base.json), z.array(base.json), base.str]);
export const topic = z.string().regex(/^[a-zA-Z0-9_/]+$/);
export const type = z.union([
    z.literal('request'),
    z.literal('reject'),
    z.literal('result'),
    z.literal('info'),
    z.literal('status')
]);
export const identifier = base.hex.refine((e) => e.length === 32);
export const envelope = z.tuple([type, identifier, topic, data, z.number().optional()]);
