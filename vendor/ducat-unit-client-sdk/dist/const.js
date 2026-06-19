import { OP_RETURN_CODE, SYMBOLS, TXMAP } from '@ducat-unit/core/const';
import SIGCOUNT from './const/sigcount.json' with { type: 'json' };
import TOPICS from './const/topics.json' with { type: 'json' };
import * as TXSIZE from './const/txsize.js';
TXMAP.repay ??= {
    acct_tx: { vin: { acct: TXMAP.UNIT_REPAY.VIN.UNIT } },
    vault_tx: { vin: { vault: TXMAP.VAULT_REPAY.VIN.VAULT, conn: TXMAP.VAULT_REPAY.VIN.CONN } }
};
TXMAP.repo ??= {
    vault_tx: { vin: { vault: TXMAP.VAULT_REPO.VIN.VAULT, conn: TXMAP.VAULT_REPO.VIN.VAULT } }
};
export { SIGCOUNT, TOPICS, TXMAP, TXSIZE };
export const SATS_PER_BTC = 100000000n;
export const BIGINT = { _0: BigInt(0), _MAX: BigInt(Number.MAX_SAFE_INTEGER) };
export const FLOAT_PRECISION = 4;
export const OUTPUT_CODES = [OP_RETURN_CODE, 0x00, 0x51];
export const COSIGN_CODES = [
    ...Object.values(SYMBOLS.CODE.VAULT),
    SYMBOLS.CODE.INPUT.CONNECT,
];
export const LIQUID_CODES = [
    SYMBOLS.CODE.INPUT.LIQUID,
];
export const SIGOPS_CODES = [...COSIGN_CODES, ...LIQUID_CODES];
export const TAPLEAF_VERSION = 0x51;
export const DEFAULT_POSTAGE = 1000;
export const DUST_LIMIT = 546;
export const FEERATE_TOLERANCE = 0.1;
export const NO_FUND_ACTIONS = [
    'close',
    'trim',
    'withdraw'
];
export const MAX_GUARD_COUNT = 3;
export const MAX_ORACLE_COUNT = 3;
export const PSBT_CONFIG = {
    allowUnknownOutputs: true,
    version: 3
};
export const SUB_TIMEOUT = 5000;
export const VAULT_VERSION = 1;
