import { PATTERNS } from '../const.js';
import { assert_bip340_pubkey } from '../validate/assert.js';
const COSIGN_SCRIPT_REGEX = /^(20)(?<client_pubkey>[a-f0-9]{64})(ad20)(?<guard_pubkey>[a-f0-9]{64})(ac)/;
const LIQUID_SCRIPT_REGEX = /^(a914)(?<liquid_hash>[a-f0-9]{40})(8820)(?<guard_pubkey>[a-f0-9]{64})(ac)$/;
function validate_pubkey_format(hex, label) {
    if (/^0+$/.test(hex)) {
        throw new Error(`${label} is all zeros`);
    }
}
function is_inert_inscription_suffix(hex) {
    if (!/^0063/.test(hex))
        return false;
    const len = hex.length / 2;
    const byte = (i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    let p = 2;
    while (p < len) {
        const op = byte(p);
        if (op === 0x68) {
            return p === len - 1;
        }
        else if (op === 0x00) {
            p += 1;
        }
        else if (op >= 0x01 && op <= 0x4b) {
            p += 1 + op;
        }
        else if (op === 0x4c) {
            if (p + 1 >= len)
                return false;
            p += 2 + byte(p + 1);
        }
        else if (op === 0x4d) {
            if (p + 2 >= len)
                return false;
            p += 3 + (byte(p + 1) | (byte(p + 2) << 8));
        }
        else if (op === 0x4e) {
            if (p + 4 >= len)
                return false;
            p += 5 + (byte(p + 1) | (byte(p + 2) << 8) | (byte(p + 3) << 16) | (byte(p + 4) * 0x1000000));
        }
        else {
            return false;
        }
        if (p > len)
            return false;
    }
    return false;
}
export function parse_cosigner_script(script) {
    const match = script.match(COSIGN_SCRIPT_REGEX);
    if (!match?.groups) {
        throw new Error(`invalid vault cosigner script (${script.length / 2} bytes): ${script}`);
    }
    const { client_pubkey, guard_pubkey } = match.groups;
    const trailing = script.slice(match[0].length);
    if (trailing.length > 0 && !is_inert_inscription_suffix(trailing)) {
        throw new Error(`invalid vault cosigner script: trailing bytes are not an inert inscription envelope (${script.length / 2} bytes): ${script}`);
    }
    validate_pubkey_format(client_pubkey, 'client pubkey');
    validate_pubkey_format(guard_pubkey, 'guard pubkey');
    return { client_pubkey, guard_pubkey };
}
export function parse_liquidation_script(script) {
    const match = script.match(LIQUID_SCRIPT_REGEX);
    if (!match?.groups) {
        throw new Error(`invalid vault liquidation script (${script.length / 2} bytes): ${script}`);
    }
    const { guard_pubkey, liquid_hash } = match.groups;
    validate_pubkey_format(guard_pubkey, 'guard pubkey');
    if (/^0+$/.test(liquid_hash)) {
        throw new Error('liquid hash is all zeros');
    }
    return { guard_pubkey, liquid_hash };
}
export function parse_script_pubkeys(script) {
    const regex = new RegExp(PATTERNS.SCRIPT_PUBKEYS, 'gi');
    const matches = [...script.matchAll(regex)];
    const pubkeys = matches.map(match => match[1]);
    for (const pubkey of pubkeys) {
        assert_bip340_pubkey(pubkey);
    }
    return pubkeys;
}
