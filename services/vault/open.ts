/**
 * Vault Open Operations
 */

import type {
  GuardianSocket,
  UnitAccountResponse,
  VaultWallet,
  WalletVaultOpenConfig,
  WalletVaultOpenRequest,
} from '@ducat-unit/client-sdk';
import { TX, PSBT } from '@ducat-unit/client-sdk/util';
import { VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { withGuardianTimeout } from '../guardianService';
import { generateVaultName } from '../../utils/vaultUtils';
import { checkBatchAllowed, extractOpReturnFromTxHex, Utxo } from './utils';

export interface CreateVaultReqOptions {
  feeRate: number;
  isMaxDeposit: boolean;
  liquidationPrice: number;
  utxos?: Utxo[];
}

/**
 * Creates a vault configuration object
 * @param unit - UNIT amount to borrow (in UNIT, not cents)
 * @param btc - BTC amount to deposit (in BTC, not sats)
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Vault configuration for opening
 */
export function createVaultConfig(
  unit: number,
  btc: number,
  feeRate: number
): WalletVaultOpenConfig {
  const vaultName = generateVaultName();

  logger.debug('[VaultOps] Creating vault config:', { unit, btc, feeRate, vaultName });

  const config: WalletVaultOpenConfig = {
    borrow_amount: Number((unit * 100).toFixed(0)), // Convert to cents
    deposit_amount: Number((btc * 100_000_000).toFixed(0)), // Convert to sats
    vault_label: vaultName,
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Vault config created:', config);
  return config;
}

/**
 * Reserves UNIT amount from Guardian for vault opening
 * @param gclient - Connected Guardian socket
 * @param vaultConfig - Vault configuration
 * @param vaultPubkey - Vault public key (taproot)
 * @returns Unit account response with mint account info
 */
export async function guardianOpenVaultReserve(
  gclient: GuardianSocket,
  vaultConfig: WalletVaultOpenConfig,
  vaultPubkey: string
): Promise<UnitAccountResponse> {
  logger.debug('[VaultOps] Reserving UNIT from guardian:', {
    amount: vaultConfig.borrow_amount,
    vaultPubkey,
  });

  const acctRes = await withGuardianTimeout(
    gclient.req.unit
      .reserve({
        unit_amount: vaultConfig.borrow_amount,
        vault_action: 'open',
        vault_pubkey: vaultPubkey,
      })
      .resolve(30_000)
  );

  logger.debug('[VaultOps] UNIT reserved:', acctRes);
  return acctRes as UnitAccountResponse;
}

/**
 * Creates a vault open request with PSBT for signing
 * @param wallet - VaultWallet instance
 * @param vaultConfig - Vault configuration
 * @param acctRes - Unit account response from guardian
 * @param options - Additional options including liquidation price
 * @returns Vault open request with PSBT
 */
export async function createVaultReqOpen(
  wallet: VaultWallet,
  vaultConfig: WalletVaultOpenConfig,
  acctRes: UnitAccountResponse,
  options: CreateVaultReqOptions
): Promise<WalletVaultOpenRequest> {
  logger.debug('[VaultOps] Creating vault request...');

  try {
    // Fetch oracle price quote
    const oracleQuote = await fetchPriceQuote(options.liquidationPrice);

    // Create vault context
    const vaultCtx = wallet.vault.open.ctx(
      acctRes.mint_account,
      oracleQuote,
      vaultConfig
    );

    // Get UTXOs for the transaction
    let utxos = options.utxos;
    if (!options.isMaxDeposit && !utxos) {
      const txQuote = wallet.vault.open.quote(vaultCtx);
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * options.feeRate;
      utxos = await wallet.fetch.sats_utxos(costWithVins);
    }

    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available for vault deposit');
    }

    // Check if batch signing is allowed (native segwit addresses)
    const isBatch = checkBatchAllowed(wallet);

    // Create the vault request
    const vaultReq = await wallet.vault.open.req(vaultCtx, utxos, isBatch);

    // Log the vault request details for debugging
    logger.debug('[VaultOps] Vault request created');
    logger.debug('[VaultOps] issue_txid from SDK:', { txid: vaultReq.issue_txid });
    logger.debug('[VaultOps] vault_txid from SDK:', { txid: vaultReq.vault_txid });

    // Recompute txids ourselves to verify
    try {
      if (vaultReq.issue_txhex && vaultReq.vault_txhex) {
        const recomputedIssueTxid = TX.get_txid(vaultReq.issue_txhex);
        const recomputedVaultTxid = TX.get_txid(vaultReq.vault_txhex);
        logger.debug('[VaultOps] Recomputed issue_txid:', { txid: recomputedIssueTxid });
        logger.debug('[VaultOps] Recomputed vault_txid:', { txid: recomputedVaultTxid });
        logger.debug('[VaultOps] issue_txid match:', { match: vaultReq.issue_txid === recomputedIssueTxid });
        logger.debug('[VaultOps] vault_txid match:', { match: vaultReq.vault_txid === recomputedVaultTxid });
      }
    } catch (txidError) {
      logger.warn('[VaultOps] Could not recompute txids:', { error: txidError instanceof Error ? txidError.message : String(txidError) });
    }

    // Log raw tx hex (truncated for readability)
    logger.debug('[VaultOps] issue_txhex (first 200 chars):', { rawtx: vaultReq.issue_txhex?.substring(0, 200) });
    logger.debug('[VaultOps] vault_txhex (first 200 chars):', { rawtx: vaultReq.vault_txhex?.substring(0, 200) });

    // ===== DEBUG: Check OP_RETURN in the txhex returned by SDK =====
    const issueTxOpReturn = extractOpReturnFromTxHex(vaultReq.issue_txhex);
    const vaultTxOpReturn = extractOpReturnFromTxHex(vaultReq.vault_txhex);
    logger.debug('[VaultOps] OP_RETURN in issue_txhex from SDK:', { opReturn: issueTxOpReturn });
    logger.debug('[VaultOps] OP_RETURN in vault_txhex from SDK:', { opReturn: vaultTxOpReturn });

    // Check if OP_RETURN is proper runestone (should be 6a5d09... not 6a5d00)
    if (issueTxOpReturn) {
      const isCorrupted = issueTxOpReturn.includes('6a5d00') && !issueTxOpReturn.includes('6a5d09');
      logger.debug('[VaultOps] issue_txhex OP_RETURN appears corrupted:', { isCorrupted });
    }
    // ===== END DEBUG =====

    // Log issue PSBT details
    if (vaultReq.issue_psbt) {
      try {
        const issuePdata = PSBT.decode(vaultReq.issue_psbt);
        logger.debug('[VaultOps] Issue PSBT inputs:', { count: issuePdata.inputsLength });
        for (let i = 0; i < issuePdata.inputsLength; i++) {
          const inp = issuePdata.getInput(i);
          logger.debug(`[VaultOps] Issue PSBT input ${i}:`, {
            hasFinalWitness: !!inp.finalScriptWitness,
            witnessLength: inp.finalScriptWitness?.length,
            hasPartialSig: !!inp.partialSig,
            partialSigLength: inp.partialSig?.length,
          });
        }
      } catch (psbtError) {
        logger.warn('[VaultOps] Could not decode issue_psbt:', { error: psbtError instanceof Error ? psbtError.message : String(psbtError) });
      }
    }

    // Log vault PSBT details
    if (vaultReq.vault_psbt) {
      try {
        const vaultPdata = PSBT.decode(vaultReq.vault_psbt);
        logger.debug('[VaultOps] Vault PSBT inputs:', { count: vaultPdata.inputsLength });
        for (let i = 0; i < vaultPdata.inputsLength; i++) {
          const inp = vaultPdata.getInput(i);
          logger.debug(`[VaultOps] Vault PSBT input ${i}:`, {
            hasFinalWitness: !!inp.finalScriptWitness,
            witnessLength: inp.finalScriptWitness?.length,
            hasTapScriptSig: !!inp.tapScriptSig,
            tapScriptSigLength: inp.tapScriptSig?.length,
            hasTapLeafScript: !!inp.tapLeafScript,
          });
        }
      } catch (psbtError) {
        logger.warn('[VaultOps] Could not decode vault_psbt:', { error: psbtError instanceof Error ? psbtError.message : String(psbtError) });
      }
    }

    // Log sats_inputs for debugging signature data
    if (vaultReq.sats_inputs && vaultReq.sats_inputs.length > 0) {
      logger.debug('[VaultOps] sats_inputs:', JSON.stringify(vaultReq.sats_inputs.map(inp => ({
        txid: inp.txid,
        vout: inp.vout,
        value: inp.value,
        witnessLength: inp.witness?.length,
        witness: inp.witness,
      }))));
    }

    // Log connect_input for debugging script-path signature
    if (vaultReq.connect_input) {
      logger.debug('[VaultOps] connect_input:', JSON.stringify({
        txid: vaultReq.connect_input.txid,
        vout: vaultReq.connect_input.vout,
        value: vaultReq.connect_input.value,
        witnessLength: vaultReq.connect_input.witness?.length,
        witness: vaultReq.connect_input.witness,
      }));
    }

    return vaultReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create vault request:', { error });
    throw error;
  }
}

/**
 * Submits signed vault request to Guardian
 * @param gclient - Connected Guardian socket
 * @param vaultReq - Signed vault request
 * @returns Transaction ID
 */
export async function guardianSendReqOpen(
  gclient: GuardianSocket,
  vaultReq: WalletVaultOpenRequest
): Promise<string> {
  logger.debug('[VaultOps] Submitting vault request to guardian...');

  // Log the full request being sent (as JSON for easy copy-paste)
  logger.debug('[VaultOps] === FULL VAULT REQUEST (JSON) ===');
  try {
    // Log full request as JSON (may be large)
    const requestJson = JSON.stringify(vaultReq, null, 2);
    // Split into chunks if too large for single log
    const chunkSize = 4000;
    for (let i = 0; i < requestJson.length; i += chunkSize) {
      logger.debug(`[VaultOps] Request JSON chunk ${Math.floor(i / chunkSize) + 1}:`, requestJson.substring(i, i + chunkSize));
    }
  } catch (e) {
    logger.debug('[VaultOps] Could not stringify full request');
  }
  logger.debug('[VaultOps] === KEY FIELDS ===');
  logger.debug('[VaultOps] issue_txid:', vaultReq.issue_txid);
  logger.debug('[VaultOps] vault_txid:', vaultReq.vault_txid);
  logger.debug('[VaultOps] sats_inputs count:', vaultReq.sats_inputs?.length);
  logger.debug('[VaultOps] === END VAULT REQUEST ===');

  try {
    const guardSub = await gclient.req.vault.open(vaultReq);
    logger.debug('[VaultOps] Request submitted, waiting for response...');

    const guardRes = await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + 5000 // Add 5s buffer
    ) as { issue_txid: string };

    const txid = guardRes.issue_txid;
    logger.debug('[VaultOps] Vault created, txid:', { txid });

    return txid;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[VaultOps] Failed to submit vault request:', {
      message: errorMessage,
      stack: errorStack,
      rawError: JSON.stringify(error, Object.getOwnPropertyNames(error || {}))
    });
    throw error;
  }
}
