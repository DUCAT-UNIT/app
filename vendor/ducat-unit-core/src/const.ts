/**
 * @fileoverview Core protocol constants and imported static maps.
 */

import PATTERNS from './const/patterns.json' with { type: 'json' }
import SIGCOUNT from './const/sigcount.json' with { type: 'json' }
import SYMBOLS  from './const/symbols.json'  with { type: 'json' }
import TXMAP    from './const/txmap.json'    with { type: 'json' }

export { PATTERNS, SIGCOUNT, SYMBOLS, TXMAP }

// The supported networks for the protocol.
export const CHAIN_NETWORKS = [ 'main', 'testnet3', 'testnet4', 'mutiny', 'regtest', 'signet', 'alpha-mainnet' ] as const

// The precision to use for floating point calculations.
export const FLOAT_PRECISION = 4

// The number of satoshis within a single bitcoin.
export const SATS_PER_BTC = 100_000_000

// The version of the control block.
export const CBLOCK_VERSION = 'c'

// The default change reserve for the protocol.
export const MIN_COIN_RESERVE = 1000

// The default unit postage for the protocol.
export const MIN_COIN_POSTAGE = 1000

// The dust limit for the protocol.
export const DUST_LIMIT = 546

// The magic bytes for the inscription protocol.
export const INSCRIPTION_MAGIC = '036f7264'

// The domain for the protocol.
export const PROTOCOL_DOMAIN = 'ducat'

// The opcode for the op_return data.
export const OP_RETURN_CODE = 0x6a

// The type codes for the op_return data.
export const OP_RETURN_TYPE = {
  VAULT  : 0x58,
  RUNE   : 0x5d
} as const

// The provably unspendable public key to use as the script internal key.
export const UNSPENDABLE_KEY = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0'

// The size of the price commit data.
// oracle_id(1) + base_price(4) + thold_price(4) + thold_hash(20) + oracle_sig(64) = 93
export const PRICE_COMMIT_SIZE = 93

// The maximum number of guardian signers allowed for a vault.
export const VAULT_MAX_GUARD_COUNT = 3

// The maximum number of oracle signers allowed for a vault.
export const VAULT_MAX_ORACLE_COUNT = 3

// The version of the sequence field.
export const VAULT_SEQUENCE_VERSION = 1

// The version of the vault return data.
export const VAULT_RETURN_VERSION = 1

// The opcode for the vault return data.
export const VAULT_RETURN_CODE = 'OP_8'

// Array bounds for schema validation
export const ANCHOR_TERMS_MAX   = 100
export const PROTO_ASSETS_MAX   = 100
export const PROTO_MEMBERS_MAX  = 100
export const PROTO_TERMS_MAX    = 100
export const PROTO_LITERAL_MAX  = 100
export const WITNESS_STACK_MAX  = 500
