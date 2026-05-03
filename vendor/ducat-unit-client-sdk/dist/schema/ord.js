import base from '../schema/base.js';
const { str } = base;
const inscribe_id = str.regex(/^[a-fA-F0-9]{64}i[0-9]+$/);
const outpoint = str.regex(/^[a-fA-F0-9]{64}:[0-9]+$/);
const rune_id = str.regex(/^[0-9]+\:[0-9]+$/);
const satpoint = str.regex(/^[a-fA-F0-9]{64}:[0-9]+:[0-9]+$/);
export default {
    inscribe_id,
    outpoint,
    rune_id,
    satpoint
};
