import POSTMAP from './config/postmap.js';
import TOPICS from './config/topics.js';
import TXSIZE from './config/txsize.js';
import TXMAP from './config/txmap.json' with { type: 'json' };
const BLOCK_DURATION = 600;
const DEFAULT_POSTAGE = 10000;
const ACCOUNT_POSTAGE = 10004;
const DUST_LIMIT = 546;
const FETCH_IVAL = 50;
const FLOAT_PREC = 4;
const COIN_SIZE = 100_000_000;
const MIN_VAULT_BAL = 10_000;
const UNIT_RUNE_LBL = 'RTEST•UNIT•RUNE';
const UNSPENDABLE_KEY = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';
const VDATA_MIN_SIZE = 14;
const VDATA_MAX_SIZE = 38;
const VAULT_VERSION = 1;
const BIGINT = { _0: BigInt(0) };
export default {
    ...POSTMAP,
    ACCOUNT_POSTAGE,
    BIGINT,
    COIN_SIZE,
    FETCH_IVAL,
    FLOAT_PREC,
    BLOCK_DURATION,
    DEFAULT_POSTAGE,
    DUST_LIMIT,
    MIN_VAULT_BAL,
    TOPICS,
    TXMAP,
    UNIT_RUNE_LBL,
    UNSPENDABLE_KEY,
    VAULT_VERSION,
    VDATA_MAX_SIZE,
    VDATA_MIN_SIZE,
    TXSIZE
};
