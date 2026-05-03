import { z } from 'zod';
import base from './base.js';
const { hex, json, str } = base;
const data = z.union([z.record(json), z.array(json), str]);
const topic = z.string().regex(/^[a-zA-Z0-9_\/]+$/);
const type = z.union([
    z.literal('req'),
    z.literal('res'),
    z.literal('info'),
    z.literal('rej')
]);
const identifier = hex.refine((e) => e.length === 32);
const envelope = z.tuple([type, identifier, topic, data]);
export default { data, envelope, identifier, topic, type };
