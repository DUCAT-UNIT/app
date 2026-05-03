import { Buff } from '@cmdcode/buff';
export declare namespace OrdUtil {
    function encode_inscribe_id(id: string): Buff;
    function decode_inscribe_id(hex: string): string;
    function parse_inscribe_id(inscription_id: string): [id: string, idx: number];
    function parse_rune_id(rune_id: string): [block: number, idx: number];
    function parse_outpoint(outpoint: string): [txid: string, vout: number];
    function parse_satpoint(satpoint: string): [txid: string, vout: number, sat: number];
    function assert_inscribe_id(id?: string): asserts id is string;
    function assert_rune_id(id?: string): asserts id is string;
    function assert_outpoint(outpoint?: string): asserts outpoint is string;
    function assert_satpoint(satpoint?: string): asserts satpoint is string;
}
