// PATCHED: Use CommonJS require for React Native Metro bundler compatibility
// ESM import from CommonJS package doesn't resolve correctly in Metro
// See: patches/@ducat-unit+client-sdk+0.7.23.patch
const { encodeRunestone } = require('@ducat-unit/runestone');
const RUNE_ID_REGEX = /\d+:\d+/;
export function transfer_runes(rune_id, amount, output) {
    if (!RUNE_ID_REGEX.test(rune_id)) {
        throw new Error('invalid rune id: ' + rune_id);
    }
    const [block, idx] = rune_id.split(':');
    const runestone = encodeRunestone({
        edicts: [{
                id: { block: BigInt(block), tx: Number(idx) },
                amount: BigInt(amount),
                output
            }]
    });
    return runestone.encodedRunestone.toString('hex');
}
