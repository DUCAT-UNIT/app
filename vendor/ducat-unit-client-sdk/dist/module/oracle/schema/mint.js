import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
import tx from '../../../schema/tx.js';
const { bech32, num, str } = base;
const acct_profile = z.object({
    acct_id: ord.inscribe_id,
    balance: base.num,
    issued: base.num,
    utxo: tx.utxo
});
const mint_profile = z.object({
    address: bech32,
    divisor: num,
    issued: num,
    label: str,
    mint_id: ord.inscribe_id,
    rune_id: ord.rune_id,
    symbol: str,
    utxo: tx.utxo
});
export default {
    acct_profile,
    mint_profile
};
