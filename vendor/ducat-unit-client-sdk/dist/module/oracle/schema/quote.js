import { z } from 'zod';
import base from '../../../schema/base.js';
const base_quote = z.object({
    event_origin: base.str.nullable(),
    event_price: base.num.nullable(),
    event_stamp: base.stamp.nullable(),
    event_type: base.str,
    latest_origin: base.str,
    latest_price: base.num,
    latest_stamp: base.stamp,
    quote_origin: base.str,
    quote_price: base.num,
    quote_stamp: base.stamp,
    req_id: base.hash32,
    req_sig: base.hex,
    srv_network: base.str,
    srv_pubkey: base.hex,
    thold_hash: base.hash20,
    thold_key: base.hash32.nullable(),
    thold_price: base.num
});
const active_quote = base_quote.extend({
    is_expired: z.literal(false),
    event_origin: z.null(),
    event_price: z.null(),
    event_stamp: z.null(),
    thold_key: z.null()
});
const expired_quote = base_quote.extend({
    is_expired: z.literal(true),
    event_origin: base.str,
    event_price: base.num,
    event_stamp: base.stamp,
    thold_key: base.hash32
});
const price_quote = z.discriminatedUnion('is_expired', [active_quote, expired_quote]);
export default { active_quote, expired_quote, price_quote };
