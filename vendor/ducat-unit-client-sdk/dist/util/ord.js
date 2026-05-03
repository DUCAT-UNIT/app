import { Buff } from '@cmdcode/buff';
import { Assert } from './validate.js';
export var OrdUtil;
(function (OrdUtil) {
    function encode_inscribe_id(id) {
        assert_inscribe_id(id);
        const [txid, vout] = id.split('i');
        const index = Number(vout);
        const buffer = [Buff.hex(txid).reverse()];
        if (index > 0) {
            buffer.push(Buff.num(index, 1));
        }
        return Buff.join(buffer);
    }
    OrdUtil.encode_inscribe_id = encode_inscribe_id;
    function decode_inscribe_id(hex) {
        const stream = Buff.hex(hex).stream;
        let index = 0;
        Assert.ok(stream.size <= 33, 'encoded inscription id is greater than 33 bytes');
        if (stream.size === 33) {
            index = stream.read(1).num;
        }
        const txid = stream.read(32).reverse();
        return `${txid}i${index}`;
    }
    OrdUtil.decode_inscribe_id = decode_inscribe_id;
    function parse_inscribe_id(inscription_id) {
        assert_inscribe_id(inscription_id);
        const items = inscription_id.split('i');
        Assert.is_hash(items[0]);
        Assert.is_number(items[1]);
        return [items[0], items[1]];
    }
    OrdUtil.parse_inscribe_id = parse_inscribe_id;
    function parse_rune_id(rune_id) {
        assert_rune_id(rune_id);
        const items = rune_id.split(':').map(e => Number(e));
        items.forEach(num => Assert.is_number(num));
        return [items[0], items[1]];
    }
    OrdUtil.parse_rune_id = parse_rune_id;
    function parse_outpoint(outpoint) {
        assert_outpoint(outpoint);
        const arr = outpoint.split(':');
        return [arr[0], Number(arr[1])];
    }
    OrdUtil.parse_outpoint = parse_outpoint;
    function parse_satpoint(satpoint) {
        const arr = satpoint.split(':');
        return [arr[0], Number(arr[1]), Number(arr[2])];
    }
    OrdUtil.parse_satpoint = parse_satpoint;
    function assert_inscribe_id(id) {
        if (typeof id === 'undefined') {
            throw new Error('inscription id is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}i[0-9]+$/.test(id);
        if (!is_valid)
            throw new Error('invalid inscription id: ' + id);
    }
    OrdUtil.assert_inscribe_id = assert_inscribe_id;
    function assert_rune_id(id) {
        if (typeof id === 'undefined') {
            throw new Error('rune id is undefined');
        }
        const is_valid = /^[0-9]+\:[0-9]+$/.test(id);
        if (!is_valid)
            throw new Error('invalid rune id: ' + id);
    }
    OrdUtil.assert_rune_id = assert_rune_id;
    function assert_outpoint(outpoint) {
        if (typeof outpoint === 'undefined') {
            throw new Error('outpoint is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}:[0-9]+$/.test(outpoint);
        if (!is_valid)
            throw new Error('invalid outpoint: ' + outpoint);
    }
    OrdUtil.assert_outpoint = assert_outpoint;
    function assert_satpoint(satpoint) {
        if (typeof satpoint === 'undefined') {
            throw new Error('satpoint id is undefined');
        }
        const is_valid = /^[a-fA-F0-9]{64}:[0-9]+:[0-9]+$/.test(satpoint);
        if (!is_valid)
            throw new Error('invalid sat point: ' + satpoint);
    }
    OrdUtil.assert_satpoint = assert_satpoint;
})(OrdUtil || (OrdUtil = {}));
