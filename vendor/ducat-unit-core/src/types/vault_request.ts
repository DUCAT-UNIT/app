/**
 * @fileoverview Vault action request message shapes. These are the client -> guardian
 * wire contracts for each vault action; the guardian signer reads them
 * to produce signed transaction payloads.
 */

import type { ChainNetwork }    from './chain.js'
import type {
  VaultAction,
  VaultConfigData
} from './vault.js'

export interface SighashEntry {
  idx     : number
  sighash : string
  sigflag : number
}

export interface VaultBaseRequest {
  borrow_amount?   : number
  deposit_amount?  : number
  chain_network    : ChainNetwork
  change_amount?   : number
  client_pubkey    : string
  contract_id      : string
  guard_members    : string[]
  guard_pubkey     : string
  recap_amount?    : number
  repay_amount?    : number
  root_txid?       : string
  sighashes?       : SighashEntry[]
  vault_action     : VaultAction
  vault_config?    : VaultConfigData
  withdraw_amount? : number
}

export interface VaultOpenRequest extends VaultBaseRequest {
  borrow_amount  : number
  deposit_amount : number
  issue_psbt     : string
  issue_txid     : string
  vault_psbt     : string
  vault_txid     : string
}

export interface VaultBorrowRequest extends VaultBaseRequest {
  borrow_amount : number
  issue_psbt    : string
  issue_txid    : string
  vault_psbt    : string
  vault_txid    : string
}

export interface VaultRepayRequest extends VaultBaseRequest {
  burn_psbt    : string
  burn_txid    : string
  repay_amount : number
  vault_psbt   : string
  vault_txid   : string
}

export interface VaultRepoRequest extends VaultBaseRequest {
  vault_psbt : string
  vault_txid : string
}

export interface VaultTrimRequest extends VaultBaseRequest {
  vault_psbt : string
  vault_txid : string
}

export interface VaultDepositRequest extends VaultBaseRequest {
  deposit_amount : number
  vault_psbt     : string
  vault_txid     : string
}

export interface VaultWithdrawRequest extends VaultBaseRequest {
  withdraw_amount : number
  vault_psbt      : string
  vault_txid      : string
}

export interface VaultCloseRequest extends VaultBaseRequest {
  vault_psbt : string
  vault_txid : string
}
