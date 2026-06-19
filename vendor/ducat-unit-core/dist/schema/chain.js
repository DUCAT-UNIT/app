import { z } from 'zod';
import { CHAIN_NETWORKS } from '../const.js';
import * as Base from './base.js';
export const address = z.union([Base.base58, Base.bech32]);
export const block_id = Base.str.regex(/^[0-9]+:[0-9]+$/);
export const outpoint = Base.str.regex(/^[a-fA-F0-9]{64}:[0-9]+$/);
export const scribe_id = Base.str.regex(/^[a-fA-F0-9]{64}i[0-9]+$/);
export const network = z.enum(CHAIN_NETWORKS);
