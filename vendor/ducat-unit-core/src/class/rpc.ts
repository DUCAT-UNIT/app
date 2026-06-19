/**
 * @fileoverview Bitcoin Core RPC client.
 *
 * Provides a general-purpose RPC client for Bitcoin Core with type-safe
 * methods for block crawling, transaction publishing, and UTXO operations.
 *
 * @module @ducat-unit/core/class/rpc
 */

import type {
  RpcResponse,
  RpcClientConfig,
  CoreBlockData,
  CoreTxData,
  TestMempoolResult,
  SubmitPackageResult,
  ScanTxOutsetResult,
  ListUnspentResult,
  MempoolInfo,
  SmartFeeEstimate,
  NetworkInfo,
  DecodedRawTransaction
} from '../types/rpc.js'

export type { RpcClientConfig }

/**
 * Bitcoin Core RPC client.
 *
 * Connects to Bitcoin Core via JSON-RPC over HTTP with Basic Auth.
 * All methods return native Bitcoin Core response types.
 *
 * @example
 * ```typescript
 * const client = new RpcClient({
 *   rpc_url: 'http://localhost:8332',
 *   rpc_user: 'rpcuser',
 *   rpc_pass: 'rpcpass'
 * })
 *
 * const height = await client.get_block_count()
 * const hash = await client.get_block_hash(height)
 * const block = await client.get_block(hash, 3)
 * ```
 */
/** Hosts for which plaintext http transport is acceptable. */
function is_loopback_host (hostname : string) : boolean {
  return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
      || hostname === '::1'
      || hostname.endsWith('.localhost')
}

/**
 * Reject an RPC URL that would leak Basic Auth credentials over the
 * wire (Codex #24). https is always allowed; plaintext http is allowed
 * only to a loopback host, or when the caller explicitly opts out via
 * `allow_insecure`.
 */
function assert_rpc_url_secure (rpc_url : string, allow_insecure : boolean) : void {
  let url : URL
  try {
    url = new URL(rpc_url)
  } catch {
    throw new Error(`RpcClient: invalid rpc_url '${rpc_url}'`)
  }
  if (url.protocol === 'https:') return
  if (url.protocol === 'http:') {
    if (is_loopback_host(url.hostname) || allow_insecure) return
    throw new Error(
      `RpcClient: refusing to send credentials over plaintext http to non-loopback host ` +
      `'${url.hostname}'. Use https, a loopback host, or set allow_insecure: true.`
    )
  }
  throw new Error(`RpcClient: unsupported rpc_url protocol '${url.protocol}'`)
}

export class RpcClient {
  private readonly _config: RpcClientConfig

  constructor(config: RpcClientConfig) {
    assert_rpc_url_secure(config.rpc_url, config.allow_insecure ?? false)
    this._config = config
  }

  /**
   * Execute a raw RPC call.
   *
   * @typeParam T - Expected response data type
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns RPC response with data or error
   */
  async call<T = unknown>(
    method : string,
    params : unknown[] = []
  ): Promise<RpcResponse<T>> {
    try {
      const { rpc_url, rpc_user, rpc_pass } = this._config
      const auth = Buffer.from(`${rpc_user}:${rpc_pass}`).toString('base64')

      const response = await fetch(rpc_url, {
        method  : 'POST',
        headers : {
          'Content-Type'  : 'application/json',
          'Authorization' : `Basic ${auth}`
        },
        body: JSON.stringify({
          jsonrpc : '1.0',
          id      : Date.now(),
          method,
          params
        })
      })

      if (!response.ok) {
        return {
          ok    : false,
          error : `RPC request failed: ${response.status} ${response.statusText}`
        }
      }

      const data = await response.json() as {
        result : T
        error  : { message: string; code: number } | null
      }

      if (data.error !== null) {
        return { ok: false, error: data.error.message }
      }

      return { ok: true, data: data.result }
    } catch (err) {
      const error = err as Error
      return { ok: false, error: error.message }
    }
  }

  /**
   * Execute an RPC call, throwing on error.
   *
   * @typeParam T - Expected response data type
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns Response data
   * @throws {Error} When RPC call fails
   */
  private async _call<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await this.call<T>(method, params)
    if (!res.ok) throw new Error(res.error)
    return res.data
  }

  // ─────────────────────────────────────────────────────────────────
  // Block Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get the current block count (chain height).
   *
   * @returns Current blockchain height
   */
  async get_block_count(): Promise<number> {
    return this._call<number>('getblockcount')
  }

  /**
   * Get block hash by height.
   *
   * @param height - Block height
   * @returns Block hash
   */
  async get_block_hash(height: number): Promise<string> {
    return this._call<string>('getblockhash', [height])
  }

  /**
   * Get block data by hash.
   *
   * @param hash - Block hash
   * @param verbosity - Response detail level:
   *   - 0: Raw hex block
   *   - 1: Block with txid list
   *   - 2: Block with decoded tx
   *   - 3: Block with decoded tx and prevout (default)
   * @returns Block data (type depends on verbosity)
   */
  async get_block(hash: string, verbosity: 0): Promise<string>
  async get_block(hash: string, verbosity: 1): Promise<CoreBlockData<string>>
  async get_block(hash: string, verbosity?: 2 | 3): Promise<CoreBlockData<CoreTxData>>
  async get_block(
    hash      : string,
    verbosity : 0 | 1 | 2 | 3 = 3
  ): Promise<string | CoreBlockData<string> | CoreBlockData<CoreTxData>> {
    return this._call('getblock', [hash, verbosity])
  }

  // ─────────────────────────────────────────────────────────────────
  // Transaction Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get raw transaction data.
   *
   * @param txid - Transaction ID
   * @param verbose - If true, return decoded transaction
   * @returns Raw hex string or decoded transaction
   */
  async get_raw_transaction(txid: string, verbose: false): Promise<string>
  async get_raw_transaction(txid: string, verbose?: true): Promise<CoreTxData>
  async get_raw_transaction(
    txid    : string,
    verbose : boolean = true
  ): Promise<string | CoreTxData> {
    return this._call('getrawtransaction', [txid, verbose])
  }

  /**
   * Broadcast a raw transaction.
   *
   * @param hex - Raw transaction hex
   * @returns Transaction ID
   */
  async send_raw_transaction(hex: string): Promise<string> {
    return this._call<string>('sendrawtransaction', [hex])
  }

  // ─────────────────────────────────────────────────────────────────
  // Package/Mempool Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Test whether transactions would be accepted to mempool.
   *
   * @param rawtxs - Array of raw transaction hex strings
   * @returns Acceptance results for each transaction
   */
  async test_mempool_accept(rawtxs: string[]): Promise<TestMempoolResult[]> {
    return this._call<TestMempoolResult[]>('testmempoolaccept', [rawtxs])
  }

  /**
   * Submit a package of transactions.
   *
   * Useful for CPFP (child-pays-for-parent) scenarios where
   * transactions have dependencies.
   *
   * @param rawtxs - Array of raw transaction hex strings
   * @returns Package submission result
   */
  async submit_package(rawtxs: string[]): Promise<SubmitPackageResult> {
    return this._call<SubmitPackageResult>('submitpackage', [rawtxs])
  }

  // ─────────────────────────────────────────────────────────────────
  // UTXO Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Scan the UTXO set for matching outputs.
   *
   * @param action - Scan action: 'start', 'abort', or 'status'
   * @param scanobjects - Descriptors to scan for (e.g., ['addr(bc1q...)'])
   * @returns Scan results with matching UTXOs
   */
  async scan_tx_outset(
    action      : 'start' | 'abort' | 'status',
    scanobjects : string[]
  ): Promise<ScanTxOutsetResult> {
    return this._call<ScanTxOutsetResult>('scantxoutset', [action, scanobjects])
  }

  /**
   * List unspent outputs from wallet.
   *
   * Note: This is a wallet RPC and requires a loaded wallet.
   *
   * @param minconf - Minimum confirmations (default: 1)
   * @param maxconf - Maximum confirmations (default: 9999999)
   * @param addresses - Filter by addresses (optional)
   * @returns List of unspent outputs
   */
  async list_unspent(
    minconf   : number = 1,
    maxconf   : number = 9999999,
    addresses : string[] = []
  ): Promise<ListUnspentResult[]> {
    return this._call<ListUnspentResult[]>('listunspent', [
      minconf,
      maxconf,
      addresses
    ])
  }

  // ─────────────────────────────────────────────────────────────────
  // Network/Mempool Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get mempool information.
   *
   * Returns details about the active state of the mempool.
   *
   * @returns Mempool statistics
   */
  async get_mempool_info(): Promise<MempoolInfo> {
    return this._call<MempoolInfo>('getmempoolinfo')
  }

  /**
   * Get network information.
   *
   * Returns information about the node's connection to the network.
   *
   * @returns Network statistics and connection info
   */
  async get_network_info(): Promise<NetworkInfo> {
    return this._call<NetworkInfo>('getnetworkinfo')
  }

  /**
   * Estimate fee rate for confirmation within target blocks.
   *
   * @param conf_target - Number of blocks for confirmation target
   * @param estimate_mode - Fee estimate mode: 'unset', 'economical', or 'conservative'
   * @returns Fee rate estimate in BTC/kvB
   */
  async estimate_smart_fee(
    conf_target   : number,
    estimate_mode : 'unset' | 'economical' | 'conservative' = 'conservative'
  ): Promise<SmartFeeEstimate> {
    return this._call<SmartFeeEstimate>('estimatesmartfee', [
      conf_target,
      estimate_mode.toUpperCase()
    ])
  }

  /**
   * Decode a raw transaction hex string.
   *
   * Returns a JSON object representing the transaction.
   *
   * @param hex - Raw transaction hex string
   * @returns Decoded transaction data
   */
  async decode_raw_transaction(hex: string): Promise<DecodedRawTransaction> {
    return this._call<DecodedRawTransaction>('decoderawtransaction', [hex])
  }
}
