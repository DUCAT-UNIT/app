/**
 * Vault Open Operations
 */

import type {
  GuardianSocket,
  UnitAccountResponse,
  VaultOpenCtx,
  VaultWallet,
  WalletVaultOpenConfig,
  WalletVaultOpenRequest,
} from '@ducat-unit/client-sdk';
import { VaultAPI } from '@ducat-unit/client-sdk';
import { TX, PSBT } from '@ducat-unit/client-sdk/util';
import { BITCOIN_TX, VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { withGuardianTimeout } from '../guardianService';
import { generateVaultName } from '../../utils/vaultUtils';
import { checkBatchAllowed, extractOpReturnFromTxHex, Utxo } from './utils';
import {
  clearPendingVaultSigningOperation,
  setPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';

export interface CreateVaultReqOptions {
  feeRate: number;
  isMaxDeposit: boolean;
  liquidationPrice: number;
  postOpenReserveSats?: number;
  utxos?: Utxo[];
}

const MAX_AUTO_ADJUST_OPEN_DEPOSIT_SATS = 50_000;

function isInsufficientSatsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /insufficient sats/i.test(message);
}

function createOpenCtx(
  wallet: VaultWallet,
  acctRes: UnitAccountResponse,
  oracleQuote: Awaited<ReturnType<typeof fetchPriceQuote>>,
  vaultConfig: WalletVaultOpenConfig
): VaultOpenCtx {
  return wallet.vault.open.ctx(acctRes.mint_account, oracleQuote, vaultConfig);
}

function getOpenChange(vaultCtx: VaultOpenCtx, utxos: Utxo[]): number {
  return VaultAPI.open.get_change(vaultCtx, utxos);
}

function assertOpenChange(vaultCtx: VaultOpenCtx, utxos: Utxo[]): void {
  const changeSats = getOpenChange(vaultCtx, utxos);

  if (changeSats < 0) {
    throw new Error(
      'Not enough BTC to cover the vault deposit and transaction fee. Try a slightly smaller deposit.'
    );
  }

  if (changeSats > 0 && changeSats <= BITCOIN_TX.DUST_LIMIT) {
    throw new Error('Vault deposit would leave dust change. Try a slightly smaller amount.');
  }
}

function isSameUtxoSet(first: Utxo[], second: Utxo[]): boolean {
  if (first.length !== second.length) return false;

  const key = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}:${utxo.value}`;
  const firstKeys = new Set(first.map(key));
  return second.every((utxo) => firstKeys.has(key(utxo)));
}

function resolveOpenContext(
  wallet: VaultWallet,
  acctRes: UnitAccountResponse,
  oracleQuote: Awaited<ReturnType<typeof fetchPriceQuote>>,
  vaultConfig: WalletVaultOpenConfig,
  utxos: Utxo[],
  isMaxDeposit: boolean,
  postOpenReserveSats: number
): VaultOpenCtx {
  let vaultCtx = createOpenCtx(wallet, acctRes, oracleQuote, vaultConfig);
  const changeSats = getOpenChange(vaultCtx, utxos);

  if (
    changeSats < postOpenReserveSats ||
    (changeSats > 0 && changeSats <= BITCOIN_TX.DUST_LIMIT)
  ) {
    const requestedAmount = vaultConfig.deposit_amount;
    const maxSafeDeposit = Math.floor(
      requestedAmount + changeSats - postOpenReserveSats
    );
    const adjustmentSats = Math.abs(requestedAmount - maxSafeDeposit);
    const canAutoAdjust =
      isMaxDeposit || adjustmentSats <= MAX_AUTO_ADJUST_OPEN_DEPOSIT_SATS;

    if (maxSafeDeposit > 0 && canAutoAdjust) {
      vaultConfig.deposit_amount = maxSafeDeposit;
      vaultCtx = createOpenCtx(wallet, acctRes, oracleQuote, vaultConfig);
      assertOpenChange(vaultCtx, utxos);
      logger.info('[VaultOps] Adjusted near-max vault open deposit to exact safe amount', {
        requestedAmount,
        adjustedAmount: maxSafeDeposit,
        adjustmentSats,
        previousChangeSats: changeSats,
        postOpenReserveSats,
        utxoCount: utxos.length,
      });
      return vaultCtx;
    }
  }

  assertOpenChange(vaultCtx, utxos);
  return vaultCtx;
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
    // Fetch oracle price quote (staleness enforced in service)
    const oracleQuote = await fetchPriceQuote(options.liquidationPrice);

    let vaultCtx = createOpenCtx(wallet, acctRes, oracleQuote, vaultConfig);

    // Get UTXOs for the transaction
    let utxos = options.utxos;
    if (!utxos) {
      const txQuote = wallet.vault.open.quote(vaultCtx);
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * options.feeRate;
      try {
        utxos = options.isMaxDeposit
          ? await wallet.fetch.sats_utxos()
          : await wallet.fetch.sats_utxos(costWithVins);
      } catch (error) {
        if (!isInsufficientSatsError(error)) {
          throw error;
        }
        utxos = await wallet.fetch.sats_utxos();
      }
    }

    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available for vault deposit');
    }

    try {
      vaultCtx = resolveOpenContext(
        wallet,
        acctRes,
        oracleQuote,
        vaultConfig,
        utxos,
        options.isMaxDeposit,
        options.postOpenReserveSats ?? 0
      );
    } catch (error) {
      if (options.utxos) {
        throw error;
      }

      const allUtxos = await wallet.fetch.sats_utxos();
      if (allUtxos.length === 0 || isSameUtxoSet(utxos, allUtxos)) {
        throw error;
      }

      vaultCtx = resolveOpenContext(
        wallet,
        acctRes,
        oracleQuote,
        vaultConfig,
        allUtxos,
        options.isMaxDeposit,
        options.postOpenReserveSats ?? 0
      );
      logger.debug('[VaultOps] Retried vault open with all BTC UTXOs', {
        previousUtxoCount: utxos.length,
        allUtxoCount: allUtxos.length,
        depositAmount: vaultConfig.deposit_amount,
        changeSats: getOpenChange(vaultCtx, allUtxos),
      });
      utxos = allUtxos;
    }

    // Check if batch signing is allowed (native segwit addresses)
    const isBatch = checkBatchAllowed(wallet);

    let vaultReq: WalletVaultOpenRequest;
    setPendingVaultSigningOperation({
      action: 'open',
      ctx: vaultCtx,
      satsUtxos: utxos,
    });
    try {
      vaultReq = await wallet.vault.open.req(vaultCtx, utxos, isBatch);
    } finally {
      clearPendingVaultSigningOperation();
    }

    logger.debug('[VaultOps] Vault request created');

    // SAFETY: Check OP_RETURN for runestone corruption before submitting
    const issueTxOpReturn = extractOpReturnFromTxHex(vaultReq.issue_txhex);
    if (issueTxOpReturn) {
      const isCorrupted = issueTxOpReturn.includes('6a5d00') && !issueTxOpReturn.includes('6a5d09');
      if (isCorrupted) {
        throw new Error('Vault issue transaction has corrupted runestone (OP_RETURN 6a5d00). Aborting to prevent fund loss.');
      }
    }

    if (__DEV__) {
      // Development-only structural diagnostics. Do not log raw tx/PSBT/witness material.
      logger.debug('[VaultOps] issue_txid from SDK:', { txid: vaultReq.issue_txid });
      logger.debug('[VaultOps] vault_txid from SDK:', { txid: vaultReq.vault_txid });

      try {
        if (vaultReq.issue_txhex && vaultReq.vault_txhex) {
          const recomputedIssueTxid = TX.get_txid(vaultReq.issue_txhex);
          const recomputedVaultTxid = TX.get_txid(vaultReq.vault_txhex);
          logger.debug('[VaultOps] issue_txid match:', { match: vaultReq.issue_txid === recomputedIssueTxid });
          logger.debug('[VaultOps] vault_txid match:', { match: vaultReq.vault_txid === recomputedVaultTxid });
        }
      } catch (txidError) {
        logger.warn('[VaultOps] Could not recompute txids:', { error: txidError instanceof Error ? txidError.message : String(txidError) });
      }

      logger.debug('[VaultOps] issue/vault txhex present:', {
        hasIssueTxhex: Boolean(vaultReq.issue_txhex),
        hasVaultTxhex: Boolean(vaultReq.vault_txhex),
      });

      const vaultTxOpReturn = extractOpReturnFromTxHex(vaultReq.vault_txhex);
      logger.debug('[VaultOps] OP_RETURN in issue_txhex from SDK:', { opReturn: issueTxOpReturn });
      logger.debug('[VaultOps] OP_RETURN in vault_txhex from SDK:', { opReturn: vaultTxOpReturn });

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

      if (vaultReq.sats_inputs && vaultReq.sats_inputs.length > 0) {
        logger.debug('[VaultOps] sats_inputs:', {
          count: vaultReq.sats_inputs.length,
          totalValue: vaultReq.sats_inputs.reduce(
            (sum: number, inp: { value?: number }) => sum + Number(inp.value || 0),
            0
          ),
          witnessLengths: vaultReq.sats_inputs.map(
            (inp: { witness?: unknown[] }) => inp.witness?.length ?? 0
          ),
        });
      }

      if (vaultReq.connect_input) {
        logger.debug('[VaultOps] connect_input:', {
          txid: vaultReq.connect_input.txid,
          vout: vaultReq.connect_input.vout,
          value: vaultReq.connect_input.value,
          witnessLength: vaultReq.connect_input.witness?.length,
        });
      }
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

  logger.debug('[VaultOps] issue_txid:', vaultReq.issue_txid);
  logger.debug('[VaultOps] vault_txid:', vaultReq.vault_txid);
  logger.debug('[VaultOps] sats_inputs count:', vaultReq.sats_inputs?.length);

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
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}
