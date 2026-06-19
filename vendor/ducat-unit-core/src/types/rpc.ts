/**
 * @fileoverview Bitcoin Core RPC types.
 *
 * Types for Bitcoin Core JSON-RPC responses including blocks,
 * transactions, mempool, UTXO, and network data.
 *
 * @module @ducat-unit/core/types/rpc
 */

// ─────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────

/**
 * Successful RPC response.
 */
export interface RpcDataResponse<T> {
  ok     : true
  data   : T
  error ?: string
}

/**
 * Failed RPC response.
 */
export interface RpcErrorResponse {
  ok    : false
  data ?: undefined
  error : string
}

/**
 * RPC response wrapper - either success with data or failure with error.
 */
export type RpcResponse<T = unknown> = RpcDataResponse<T> | RpcErrorResponse

/**
 * Configuration for RPC client connection.
 */
export interface RpcClientConfig {
  rpc_url  : string
  rpc_user : string
  rpc_pass : string
  /**
   * Opt out of the transport-security guard (Codex #24). When false
   * (default), the client refuses to send Basic Auth credentials over
   * plaintext `http://` to a non-loopback host. Set true only for
   * deployments where the http hop is already protected (e.g. an SSH
   * tunnel or a trusted private network).
   */
  allow_insecure? : boolean
}

// ─────────────────────────────────────────────────────────────────
// Block Types
// ─────────────────────────────────────────────────────────────────

/**
 * Script public key from Bitcoin Core.
 */
export interface CoreScriptPubKey {
  asm      : string
  desc     : string
  hex      : string
  type     : string
  address ?: string
}

/**
 * Script signature from Bitcoin Core.
 */
export interface CoreScriptSig {
  asm : string
  hex : string
}

/**
 * Transaction prevout from Bitcoin Core (verbosity 3).
 */
export interface CoreTxPrevout {
  generated    : boolean
  height       : number
  value        : number
  scriptPubKey : CoreScriptPubKey
}

/**
 * Coinbase transaction input.
 */
export interface CoreTxCoinbase {
  coinbase     : string
  sequence     : number
  txinwitness ?: string[]
}

/**
 * Regular transaction input.
 */
export interface CoreTxInput {
  coinbase    ?: undefined
  txid         : string
  vout         : number
  scriptSig    : CoreScriptSig
  sequence     : number
  txinwitness ?: string[]
  prevout      : CoreTxPrevout | null
}

/**
 * Transaction output.
 */
export interface CoreTxOutput {
  value        : number
  n            : number
  scriptPubKey : CoreScriptPubKey
}

/**
 * Transaction data from Bitcoin Core (verbosity >= 2).
 */
export interface CoreTxData {
  txid          : string
  hash          : string
  version       : number
  size          : number
  vsize         : number
  weight        : number
  locktime      : number
  hex          ?: string
  vin           : (CoreTxCoinbase | CoreTxInput)[]
  vout          : CoreTxOutput[]
  blockhash    ?: string
  confirmations?: number
  time         ?: number
  blocktime    ?: number
}

/**
 * Block data from Bitcoin Core.
 *
 * Generic parameter T controls the transaction representation:
 * - `string` for verbosity 1 (txid only)
 * - `CoreTxData` for verbosity 2/3 (full tx data)
 */
export interface CoreBlockData<T = CoreTxData> {
  hash              : string
  confirmations     : number
  height            : number
  version           : number
  versionHex        : string
  merkleroot        : string
  time              : number
  mediantime        : number
  nonce             : number
  bits              : string
  difficulty        : number
  chainwork         : string
  nTx               : number
  previousblockhash : string
  nextblockhash    ?: string
  strippedsize      : number
  size              : number
  weight            : number
  tx                : T[]
}

// ─────────────────────────────────────────────────────────────────
// Mempool Types
// ─────────────────────────────────────────────────────────────────

/**
 * Fee information for accepted transactions.
 */
export interface TxFeeInfo {
  base             : number
  effective_feerate: number
  ancestor        ?: number
  descendant      ?: number
}

/**
 * Result for a single transaction in testmempoolaccept.
 */
export interface TestMempoolResult {
  txid           : string
  wtxid          : string
  allowed        : boolean
  vsize         ?: number
  fees          ?: TxFeeInfo
  reject_reason ?: string
}

/**
 * Result for a single transaction in submitpackage.
 */
export interface TxPackageResult {
  txid   : string
  wtxid  : string
  vsize  : number
  fees   : TxFeeInfo
  error ?: string
}

/**
 * Response from submitpackage RPC call.
 */
export interface SubmitPackageResult {
  package_msg            : string
  tx_results             : Record<string, TxPackageResult>
  replaced_transactions ?: string[]
}

// ─────────────────────────────────────────────────────────────────
// UTXO Types
// ─────────────────────────────────────────────────────────────────

/**
 * A single UTXO from scantxoutset.
 */
export interface ScannedUtxo {
  txid         : string
  vout         : number
  scriptPubKey : string
  desc         : string
  amount       : number
  coinbase     : boolean
  height       : number
}

/**
 * Response from scantxoutset RPC call.
 */
export interface ScanTxOutsetResult {
  success      : boolean
  txouts       : number
  height       : number
  bestblock    : string
  unspents     : ScannedUtxo[]
  total_amount : number
}

/**
 * A single UTXO from listunspent (wallet RPC).
 */
export interface ListUnspentResult {
  txid          : string
  vout          : number
  address       : string
  label        ?: string
  scriptPubKey  : string
  amount        : number
  confirmations : number
  spendable     : boolean
  solvable      : boolean
  desc         ?: string
  parent_descs ?: string[]
  safe          : boolean
}

// ─────────────────────────────────────────────────────────────────
// Network Types
// ─────────────────────────────────────────────────────────────────

/**
 * Response from getmempoolinfo RPC call.
 */
export interface MempoolInfo {
  loaded                : boolean
  size                  : number
  bytes                 : number
  usage                 : number
  total_fee             : number
  maxmempool            : number
  mempoolminfee         : number
  minrelaytxfee         : number
  incrementalrelayfee   : number
  unbroadcastcount      : number
  fullrbf               : boolean
}

/**
 * Response from estimatesmartfee RPC call.
 */
export interface SmartFeeEstimate {
  feerate  : number
  errors  ?: string[]
  blocks   : number
}

/**
 * Network info from getnetworkinfo.
 */
export interface NetworkInfo {
  version            : number
  subversion         : string
  protocolversion    : number
  localservices      : string
  localservicesnames : string[]
  localrelay         : boolean
  timeoffset         : number
  networkactive      : boolean
  connections        : number
  connections_in     : number
  connections_out    : number
  networks           : NetworkInterface[]
  relayfee           : number
  incrementalfee     : number
  localaddresses     : LocalAddress[]
  warnings           : string
}

/**
 * Network interface info.
 */
export interface NetworkInterface {
  name                       : string
  limited                    : boolean
  reachable                  : boolean
  proxy                      : string
  proxy_randomize_credentials: boolean
}

/**
 * Local address info.
 */
export interface LocalAddress {
  address : string
  port    : number
  score   : number
}

/**
 * Response from decoderawtransaction RPC call.
 */
export interface DecodedRawTransaction {
  txid     : string
  hash     : string
  version  : number
  size     : number
  vsize    : number
  weight   : number
  locktime : number
  vin      : DecodedTxInput[]
  vout     : DecodedTxOutput[]
}

/**
 * Decoded transaction input.
 */
export interface DecodedTxInput {
  txid         : string
  vout         : number
  scriptSig    : { asm: string; hex: string }
  txinwitness ?: string[]
  sequence     : number
}

/**
 * Decoded transaction output.
 */
export interface DecodedTxOutput {
  value        : number
  n            : number
  scriptPubKey : {
    asm     : string
    desc    : string
    hex     : string
    type    : string
    address?: string
  }
}
