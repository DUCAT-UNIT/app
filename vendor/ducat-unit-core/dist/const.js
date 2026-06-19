import PATTERNS from './const/patterns.json' with { type: 'json' };
import SIGCOUNT from './const/sigcount.json' with { type: 'json' };
import SYMBOLS from './const/symbols.json' with { type: 'json' };
import TXMAP from './const/txmap.json' with { type: 'json' };
export { PATTERNS, SIGCOUNT, SYMBOLS, TXMAP };
export const CHAIN_NETWORKS = ['main', 'testnet3', 'testnet4', 'mutiny', 'regtest', 'signet', 'alpha-mainnet'];
export const FLOAT_PRECISION = 4;
export const SATS_PER_BTC = 100_000_000;
export const CBLOCK_VERSION = 'c';
export const MIN_COIN_RESERVE = 1000;
export const MIN_COIN_POSTAGE = 1000;
export const DUST_LIMIT = 546;
export const INSCRIPTION_MAGIC = '036f7264';
export const PROTOCOL_DOMAIN = 'ducat';
export const OP_RETURN_CODE = 0x6a;
export const OP_RETURN_TYPE = {
    VAULT: 0x58,
    RUNE: 0x5d
};
export const UNSPENDABLE_KEY = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';
export const PRICE_COMMIT_SIZE = 93;
export const VAULT_MAX_GUARD_COUNT = 3;
export const VAULT_MAX_ORACLE_COUNT = 3;
export const VAULT_SEQUENCE_VERSION = 1;
export const VAULT_RETURN_VERSION = 1;
export const VAULT_RETURN_CODE = 'OP_8';
export const ANCHOR_TERMS_MAX = 100;
export const PROTO_ASSETS_MAX = 100;
export const PROTO_MEMBERS_MAX = 100;
export const PROTO_TERMS_MAX = 100;
export const PROTO_LITERAL_MAX = 100;
export const WITNESS_STACK_MAX = 500;
