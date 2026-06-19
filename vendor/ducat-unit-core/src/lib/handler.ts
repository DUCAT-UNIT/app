/**
 * @fileoverview Guardian-side vault request signing handlers.
 */

import { SYMBOLS, TXMAP } from '../const.js'

import * as PSBT          from '../psbt/index.js'
import { extract_psbt_tx } from '../psbt/index.js'

import type { GuardianSigner } from '../class/cosigner.js'

import type {
  VaultBorrowRequest,
  VaultBorrowResponse,
  VaultDepositRequest,
  VaultCloseRequest,
  VaultOpenRequest,
  VaultOpenResponse,
  VaultRepayRequest,
  VaultRepayResponse,
  VaultRepoRequest,
  VaultBaseResponse,
  VaultWithdrawRequest,
  VaultTrimRequest
} from '../types/index.js'

/** Build request-signing handlers for each vault action. */
export function sign_vault_request_api (guard : GuardianSigner) {
  // Preserve one entry point for all guardian signing call sites.
  return {
    vault_open     : sign_vault_open_request_api(guard),
    vault_borrow   : sign_vault_borrow_request_api(guard),
    vault_deposit  : sign_vault_deposit_request_api(guard),
    vault_close    : sign_vault_close_request_api(guard),
    vault_repay    : sign_vault_repay_request_api(guard),
    vault_withdraw : sign_vault_withdraw_request_api(guard),
    vault_repo     : sign_vault_repo_request_api(guard),
    vault_trim     : sign_vault_trim_request_api(guard)
  }
}

/** Sign vault-open request PSBTs and return extracted transaction payloads. */
function sign_vault_open_request_api (guardian : GuardianSigner) {
  return (request : VaultOpenRequest) : VaultOpenResponse => {
    // Define the indexes for our transaction input/output types.
    const ISSUE_UNIT_VIN = TXMAP.UNIT_ISSUE.VIN.RESRV
    const CONN_VAULT_VIN = TXMAP.VAULT_OPEN.VIN.CONN
    const XFER_UNIT_VIN  = TXMAP.VAULT_OPEN.VIN.UNIT
    // Unpack the request.
    let { issue_psbt, vault_psbt } = request
    // Sign the transactions with the guardian.
    issue_psbt = guardian.sign.input.spend(issue_psbt,  ISSUE_UNIT_VIN)
    vault_psbt = guardian.sign.input.spend(vault_psbt,  XFER_UNIT_VIN)
    vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN)
    // Decode the PSBTs.
    const [ issue_txid, issue_tx ] = extract_psbt_tx(issue_psbt)
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated PSBTs.
    return { issue_txid, issue_tx, vault_txid, vault_tx }
  }
}

/** Sign vault-borrow request PSBTs and return extracted transaction payloads. */
function sign_vault_borrow_request_api (guardian : GuardianSigner) {
  return (request : VaultBorrowRequest) : VaultBorrowResponse => {
    // Define the indexes for our transaction input/output types.
    const ISSUE_UNIT_VIN = TXMAP.UNIT_ISSUE.VIN.RESRV
    const XFER_UNIT_VIN  = TXMAP.VAULT_BORROW.VIN.UNIT
    const SPND_VAULT_VIN = TXMAP.VAULT_BORROW.VIN.VAULT
    const CONN_VAULT_VIN = TXMAP.VAULT_BORROW.VIN.CONN
    // Unpack the request.
    let { issue_psbt, vault_psbt } = request
    // Sign the transactions with the guardian.
    issue_psbt = guardian.sign.input.spend(issue_psbt,  ISSUE_UNIT_VIN)
    vault_psbt = guardian.sign.input.spend(vault_psbt,  XFER_UNIT_VIN)
    vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN)
    vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN)
    // Decode the PSBTs.
    const [ issue_txid, issue_tx ] = extract_psbt_tx(issue_psbt)
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated PSBTs.
    return { issue_txid, issue_tx, vault_txid, vault_tx }
  }
}

/** Sign vault-deposit request PSBT and return extracted transaction payload. */
function sign_vault_deposit_request_api (guardian : GuardianSigner) {
  return (request : VaultDepositRequest) : VaultBaseResponse => {
    // Define the indexes for our transaction input/output types.
    const SPND_VAULT_VIN = TXMAP.VAULT_DEPOSIT.VIN.VAULT
    // Unpack the request.
    let { vault_psbt } = request
    // Sign the transaction with the guardian.
    vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN)
    // Decode the PSBT.
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated PSBT.
    return { vault_txid, vault_tx }
  }
}

/** Sign vault-repay request PSBTs and return extracted transaction payloads. */
function sign_vault_repay_request_api (guardian : GuardianSigner) {
  return (request : VaultRepayRequest) : VaultRepayResponse => {
    // Define the indexes for our transaction input/output types.
    const SPND_VAULT_VIN = TXMAP.VAULT_REPAY.VIN.VAULT
    const CONN_VAULT_VIN = TXMAP.VAULT_REPAY.VIN.CONN
    // Unpack the request.
    let { burn_psbt, vault_psbt } = request
    // Sign the transaction with the guardian.
    vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN)
    vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN)
    // Decode the PSBTs.
    const [ burn_txid, burn_tx   ] = extract_psbt_tx(burn_psbt)
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated PSBTs.
    return { burn_txid, burn_tx, vault_txid, vault_tx }
  }
}

/** Sign vault-withdraw request PSBT and return extracted transaction payload. */
function sign_vault_withdraw_request_api (guardian : GuardianSigner) {
  return (request : VaultWithdrawRequest) : VaultBaseResponse => {
    // Define the indexes for our transaction input/output types.
    const SPND_VAULT_VIN = TXMAP.VAULT_WITHDRAW.VIN.VAULT
    // Unpack the request.
    let { vault_psbt } = request
    // Sign the transaction with the guardian.
    vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN)
    // Decode the PSBT.
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated PSBT.
    return { vault_txid, vault_tx }
  }
}

/** Sign vault-close request PSBT and return extracted transaction payload. */
function sign_vault_close_request_api (guardian : GuardianSigner) {
  return (request : VaultCloseRequest) : VaultBaseResponse => {
    const SPND_VAULT_VIN = TXMAP.VAULT_CLOSE.VIN.VAULT
    let { vault_psbt } = request
    vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN)
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    return { vault_txid, vault_tx }
  }
}

/** Sign vault-repo liquidation PSBT and return extracted transaction payload. */
function sign_vault_repo_request_api (guardian : GuardianSigner) {
  return (request : VaultRepoRequest) : VaultBaseResponse => {
    // Sign the repo PSBT.
    const vault_psbt = sign_liquid_psbt(guardian, request.vault_psbt)
    // Extract the transaction IDs and data.
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated transaction response data.
    return { vault_txid, vault_tx }
  }
}

/** Sign vault-trim liquidation PSBT and return extracted transaction payload. */
function sign_vault_trim_request_api (guardian : GuardianSigner) {
  return (request : VaultTrimRequest) : VaultBaseResponse => {
    // Sign the repo PSBT.
    const vault_psbt = sign_liquid_psbt(guardian, request.vault_psbt)
    // Extract the transaction IDs and data.
    const [ vault_txid, vault_tx ] = extract_psbt_tx(vault_psbt)
    // Return the updated transaction response data.
    return { vault_txid, vault_tx }
  }
}

/** Sign all eligible inputs in liquidation PSBT based on metadata sequence codes. */
function sign_liquid_psbt (guardian : GuardianSigner, vault_psbt : string) {
  // Parse the liquid PSBT.
  const pdata = PSBT.parse_psbt(vault_psbt)
  // For each input in the liquid PSBT:
  for (let idx = 0; idx < pdata.inputsLength; idx++) {
    // Fetch the input sequence data.
    const sdata = PSBT.get_psbt_input_sequence(pdata, idx)
    // Skip if the input sequence data is not a metadata input.
    if (!sdata || sdata.type !== 'metadata') continue
    // Metadata sequence code decides which guardian signing primitive applies.
    // Sign based on the input code type.
    switch (sdata.code) {
      case SYMBOLS.CODE.VAULT.REPO:
      case SYMBOLS.CODE.VAULT.TRIM:
        vault_psbt = guardian.sign.input.cosign(vault_psbt, idx)
        break
      case SYMBOLS.CODE.INPUT.LIQUID:
        vault_psbt = guardian.sign.input.liquidate(vault_psbt, idx)
        break
    }
  }
  // Return the signed PSBT.
  return vault_psbt
}
