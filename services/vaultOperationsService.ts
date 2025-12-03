/**
 * Vault Operations Service
 * Core vault creation operations ported from frontend
 */

import type {
  BaseUtxo,
  GuardianSocket,
  PriceQuote,
  UnitAccountResponse,
  VaultBorrowCtx,
  VaultDepositCtx,
  VaultPrevout,
  VaultProfile,
  VaultRepayCtx,
  VaultRepayResponse,
  VaultReturnData,
  VaultWallet,
  VaultWithdrawCtx,
  WalletVaultBorrowConfig,
  WalletVaultBorrowRequest,
  WalletVaultDepositConfig,
  WalletVaultDepositRequest,
  WalletVaultOpenConfig,
  WalletVaultOpenRequest,
  WalletVaultRepayConfig,
  WalletVaultRepayRequest,
  WalletVaultWithdrawConfig,
  WalletVaultWithdrawRequest,
} from '@ducat-unit/client-sdk';
import { TX, PSBT } from '@ducat-unit/client-sdk/util';
import { Buffer } from 'buffer';
import { VAULT_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import { fetchPriceQuote } from './oracleService';
import { withGuardianTimeout } from './guardianService';
import { generateVaultName } from '../utils/vaultUtils';
import { varIntSize } from '../utils/wallet/cryptoHelpers';

/**
 * Read a varint from buffer (local copy for this file)
 */
function readVarInt(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  const first = buffer[offset];
  if (first < 0xfd) {
    return { value: first, bytesRead: 1 };
  } else if (first === 0xfd) {
    return { value: buffer.readUInt16LE(offset + 1), bytesRead: 3 };
  } else if (first === 0xfe) {
    return { value: buffer.readUInt32LE(offset + 1), bytesRead: 5 };
  } else {
    throw new Error('64-bit varint not supported');
  }
}

/**
 * Extract OP_RETURN from raw transaction hex for debugging
 */
function extractOpReturnFromTxHex(txHex: string | undefined): string | null {
  if (!txHex) return null;
  try {
    const txBuffer = Buffer.from(txHex, 'hex');
    let offset = 0;
    offset += 4; // version

    // Check for witness marker
    const hasWitness = txBuffer[offset] === 0x00 && txBuffer[offset + 1] === 0x01;
    if (hasWitness) {
      offset += 2;
    }

    // Skip inputs
    const inputCount = readVarInt(txBuffer, offset);
    offset += varIntSize(inputCount.value);
    for (let i = 0; i < inputCount.value; i++) {
      offset += 32; // txid
      offset += 4;  // vout
      const scriptLen = readVarInt(txBuffer, offset);
      offset += varIntSize(scriptLen.value) + scriptLen.value;
      offset += 4;  // sequence
    }

    // Read outputs
    const outputCount = readVarInt(txBuffer, offset);
    offset += varIntSize(outputCount.value);

    for (let i = 0; i < outputCount.value; i++) {
      offset += 8; // value (8 bytes)
      const scriptLen = readVarInt(txBuffer, offset);
      offset += varIntSize(scriptLen.value);
      const scriptPubKey = txBuffer.slice(offset, offset + scriptLen.value);
      offset += scriptLen.value;

      // Check if OP_RETURN (starts with 0x6a)
      if (scriptPubKey[0] === 0x6a) {
        return scriptPubKey.toString('hex');
      }
    }
    return null;
  } catch (e) {
    return `error: ${e}`;
  }
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

export interface CreateVaultReqOptions {
  feeRate: number;
  isMaxDeposit: boolean;
  liquidationPrice: number;
  utxos?: Utxo[];
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  script: string;
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

/**
 * Checks if batch signing is allowed based on wallet address type
 * Batch signing is only allowed for native segwit (tb1q...) addresses
 */
function checkBatchAllowed(wallet: VaultWallet): boolean {
  try {
    const satsAddress = wallet.acct?.sats?.address || '';
    // Native segwit addresses start with tb1q (testnet) or bc1q (mainnet)
    return satsAddress.startsWith('tb1q') || satsAddress.startsWith('bc1q');
  } catch {
    return false;
  }
}

// ==========================================
// BORROW OPERATIONS
// ==========================================

/**
 * Normalizes master_id by adding 'i0' suffix if not present
 */
function normalizeMasterId(masterId: string): string {
  if (!masterId) return '';
  return masterId.includes('i') ? masterId : `${masterId}i0`;
}

/**
 * Maps vault action strings from API to SDK single character codes
 * API returns: "Open", "Borrow", "Repay", "Deposit", "Withdraw", "Liquidate", "Close"
 * SDK expects: "o", "b", "r", "d", "w", "l", "x"
 */
type VaultActionCode = 'o' | 'b' | 'r' | 'd' | 'w' | 'l' | 'x';

function normalizeVaultAction(action: string): VaultActionCode {
  const actionMap: Record<string, VaultActionCode> = {
    // Full names (from API)
    'Open': 'o',
    'Borrow': 'b',
    'Repay': 'r',
    'Deposit': 'd',
    'Withdraw': 'w',
    'Liquidate': 'l',
    'Close': 'x',
    // Lowercase versions
    'open': 'o',
    'borrow': 'b',
    'repay': 'r',
    'deposit': 'd',
    'withdraw': 'w',
    'liquidate': 'l',
    'close': 'x',
    // Already single char codes (passthrough)
    'o': 'o',
    'b': 'b',
    'r': 'r',
    'd': 'd',
    'w': 'w',
    'l': 'l',
    'x': 'x',
  };

  const normalized = actionMap[action];
  if (!normalized) {
    logger.warn('[VaultOps] Unknown vault action, defaulting to "o":', { action });
    return 'o';
  }
  return normalized;
}

/**
 * Creates VaultPrevout from vault history transaction
 * Used for constructing VaultProfile for borrow/repay operations
 */
export function computeVaultPrevoutFromTx(tx: {
  transaction_id?: string;
  utxo?: string;
  utxo_script?: string;
  liquidation_hash?: string;
  liquidation_threshold?: number;
  amount_borrowed: number;
  oracle_price: number;
  timestamp: number;
  action: string;
  vault_amount: number;
}): VaultPrevout | null {
  if (!tx.utxo || !tx.transaction_id) {
    logger.warn('[VaultOps] Cannot compute VaultPrevout: missing utxo or transaction_id');
    return null;
  }

  const rdata: VaultReturnData = {
    is_locked: false,
    thold_hash: tx.liquidation_hash || '',
    thold_price: tx.liquidation_threshold || 0,
    unit_balance: tx.amount_borrowed,
    unit_price: tx.oracle_price,
    unit_stamp: tx.timestamp,
    vault_action: normalizeVaultAction(tx.action),
  };

  const [, vout] = tx.utxo.split(':');
  const utxo: BaseUtxo = {
    value: tx.vault_amount,
    script: tx.utxo_script || '',
    txid: tx.transaction_id,
    vout: Number(vout) || 0,
  };

  return { rdata, utxo };
}

/**
 * Creates a borrow configuration object
 * @param borrowAmountUnit - UNIT amount to borrow (in UNIT, not cents)
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Borrow configuration
 */
export function createBorrowConfig(
  borrowAmountUnit: number,
  feeRate: number
): WalletVaultBorrowConfig {
  logger.debug('[VaultOps] Creating borrow config:', { borrowAmountUnit, feeRate });

  const config: WalletVaultBorrowConfig = {
    borrow_amount: Number((borrowAmountUnit * 100).toFixed(0)), // Convert to cents
    deposit_amount: 0, // No deposit when borrowing
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Borrow config created:', config);
  return config;
}

/**
 * Reserves UNIT amount from Guardian for borrow operation
 * @param gclient - Connected Guardian socket
 * @param borrowConfig - Borrow configuration
 * @param vaultPubkey - Vault public key (taproot)
 * @returns Unit account response with mint account info
 */
export async function guardianBorrowReserve(
  gclient: GuardianSocket,
  borrowConfig: WalletVaultBorrowConfig,
  vaultPubkey: string
): Promise<UnitAccountResponse> {
  logger.debug('[VaultOps] Reserving UNIT from guardian for borrow:', {
    amount: borrowConfig.borrow_amount,
    vaultPubkey,
  });

  const acctRes = await withGuardianTimeout(
    gclient.req.unit
      .reserve({
        unit_amount: borrowConfig.borrow_amount,
        vault_action: 'borrow',
        vault_pubkey: vaultPubkey,
      })
      .resolve(30_000)
  );

  logger.debug('[VaultOps] UNIT reserved for borrow:', acctRes);
  return acctRes as UnitAccountResponse;
}

export interface CreateBorrowReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  utxos?: Utxo[];
}

/**
 * Creates a vault borrow request with PSBT for signing
 * @param wallet - VaultWallet instance
 * @param borrowConfig - Borrow configuration
 * @param acctRes - Unit account response from guardian
 * @param options - Options including oracle quote and vault profile
 * @returns Vault borrow request with PSBT
 */
export async function createVaultReqBorrow(
  wallet: VaultWallet,
  borrowConfig: WalletVaultBorrowConfig,
  acctRes: UnitAccountResponse,
  options: CreateBorrowReqOptions
): Promise<WalletVaultBorrowRequest> {
  logger.debug('[VaultOps] Creating borrow request...');

  try {
    const { feeRate, oracleQuote, vaultProfile } = options;

    logger.debug('[VaultOps] Borrow context inputs:', {
      mintAccount: !!acctRes.mint_account,
      oracleQuote: !!oracleQuote,
      vaultProfile: {
        acct_id: vaultProfile.acct_id,
        guard_pk: vaultProfile.guard_pk?.substring(0, 20) + '...',
        master_id: vaultProfile.master_id,
        vault_pk: vaultProfile.vault_pk?.substring(0, 20) + '...',
        hasRdata: !!vaultProfile.rdata,
        hasUtxo: !!vaultProfile.utxo,
      },
    });

    // Create borrow context
    const vaultCtx: VaultBorrowCtx = wallet.vault.borrow.ctx(
      acctRes.mint_account,
      oracleQuote,
      vaultProfile,
      borrowConfig
    );

    // Get transaction quote
    const txQuote = wallet.vault.borrow.quote(vaultCtx);
    logger.debug('[VaultOps] Borrow tx quote:', {
      totalCost: txQuote.total_cost,
    });

    // Get UTXOs for the transaction
    let utxos = options.utxos;
    if (!utxos) {
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
      utxos = await wallet.fetch.sats_utxos(costWithVins);
    }

    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available for borrow transaction fees');
    }

    // Check if batch signing is allowed
    const isBatch = checkBatchAllowed(wallet);

    // Create the borrow request
    const borrowReq = await wallet.vault.borrow.req(vaultCtx, utxos, isBatch);

    logger.debug('[VaultOps] Borrow request created:', {
      issue_txid: borrowReq.issue_txid,
      vault_txid: borrowReq.vault_txid,
      sats_inputs_count: borrowReq.sats_inputs?.length,
    });

    return borrowReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create borrow request:', { error });
    throw error;
  }
}

/**
 * Submits signed borrow request to Guardian
 * @param gclient - Connected Guardian socket
 * @param borrowReq - Signed borrow request
 * @returns Transaction IDs (issue and vault)
 */
export async function guardianSendReqBorrow(
  gclient: GuardianSocket,
  borrowReq: WalletVaultBorrowRequest
): Promise<{ txid: string; vault_txid: string }> {
  logger.debug('[VaultOps] Submitting borrow request to guardian...');

  try {
    const guardSub = await gclient.req.vault.borrow(borrowReq);
    logger.debug('[VaultOps] Borrow request submitted, waiting for response...');

    // Small delay before resolving (as in frontend)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const guardRes = await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + 5000
    ) as { issue_txid: string; vault_txid: string };

    const txid = guardRes.issue_txid;
    const vault_txid = guardRes.vault_txid;

    logger.debug('[VaultOps] Borrow completed:', { txid, vault_txid });

    return { txid, vault_txid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[VaultOps] Failed to submit borrow request:', {
      message: errorMessage,
    });
    throw error;
  }
}

/**
 * Builds a VaultProfile from vault data
 * Used for borrow/repay/withdraw operations on existing vaults
 */
export function buildVaultProfile(
  vaultPubkey: string,
  vaultInfo: {
    creation_account: string;
    guard_pubkey: string;
    master_id: string;
  },
  vaultPrevout: VaultPrevout
): VaultProfile {
  return {
    acct_id: vaultInfo.creation_account,
    guard_pk: vaultInfo.guard_pubkey,
    master_id: normalizeMasterId(vaultInfo.master_id),
    vault_pk: vaultPubkey,
    rdata: vaultPrevout.rdata,
    utxo: vaultPrevout.utxo,
  };
}

// ==========================================
// DEPOSIT OPERATIONS
// ==========================================

/**
 * Creates a deposit configuration object
 * @param depositAmountSats - BTC amount to deposit in satoshis
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Deposit configuration
 */
export function createDepositConfig(
  depositAmountSats: number,
  feeRate: number
): WalletVaultDepositConfig {
  logger.debug('[VaultOps] Creating deposit config:', { depositAmountSats, feeRate });

  const config: WalletVaultDepositConfig = {
    deposit_amount: depositAmountSats,
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Deposit config created:', config);
  return config;
}

export interface CreateDepositReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  isMaxAmount?: boolean;
  utxos?: Utxo[];
}

/**
 * Creates a vault deposit request with PSBT for signing
 * Note: Deposit does NOT require UNIT reservation (unlike borrow)
 * @param wallet - VaultWallet instance
 * @param depositConfig - Deposit configuration
 * @param options - Options including oracle quote and vault profile
 * @returns Vault deposit request with PSBT
 */
export async function createVaultReqDeposit(
  wallet: VaultWallet,
  depositConfig: WalletVaultDepositConfig,
  options: CreateDepositReqOptions
): Promise<WalletVaultDepositRequest> {
  logger.debug('[VaultOps] Creating deposit request...');

  try {
    const { feeRate, oracleQuote, vaultProfile, isMaxAmount } = options;

    logger.debug('[VaultOps] Deposit context inputs:', {
      oracleQuote: !!oracleQuote,
      vaultProfile: {
        acct_id: vaultProfile.acct_id,
        guard_pk: vaultProfile.guard_pk?.substring(0, 20) + '...',
        master_id: vaultProfile.master_id,
        vault_pk: vaultProfile.vault_pk?.substring(0, 20) + '...',
        hasRdata: !!vaultProfile.rdata,
        hasUtxo: !!vaultProfile.utxo,
      },
      depositAmount: depositConfig.deposit_amount,
    });

    // Create deposit context
    const vaultCtx: VaultDepositCtx = wallet.vault.deposit.ctx(
      oracleQuote,
      vaultProfile,
      depositConfig
    );

    // Get UTXOs for the transaction
    let utxos = options.utxos;
    if (!isMaxAmount && !utxos) {
      const txQuote = wallet.vault.deposit.quote(vaultCtx);
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
      utxos = await wallet.fetch.sats_utxos(costWithVins);
    }

    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available for deposit transaction');
    }

    // Create the deposit request (deposit.req does not take isBatch parameter)
    const depositReq = await wallet.vault.deposit.req(vaultCtx, utxos);

    logger.debug('[VaultOps] Deposit request created:', {
      vault_txid: depositReq.vault_txid,
      sats_inputs_count: depositReq.sats_inputs?.length,
    });

    return depositReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create deposit request:', { error });
    throw error;
  }
}

/**
 * Submits signed deposit request to Guardian
 * Note: Deposit returns only vault_txid (no issue_txid since no UNIT minted)
 * @param gclient - Connected Guardian socket
 * @param depositReq - Signed deposit request
 * @returns Vault transaction ID
 */
export async function guardianSendReqDeposit(
  gclient: GuardianSocket,
  depositReq: WalletVaultDepositRequest
): Promise<{ vault_txid: string }> {
  logger.debug('[VaultOps] Submitting deposit request to guardian...');

  try {
    const guardSub = await gclient.req.vault.deposit(depositReq);
    logger.debug('[VaultOps] Deposit request submitted, waiting for response...');

    // Small delay before resolving (as in frontend)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const guardRes = await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + 5000
    ) as { vault_txid: string };

    const vault_txid = guardRes.vault_txid;

    logger.debug('[VaultOps] Deposit completed:', { vault_txid });

    return { vault_txid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[VaultOps] Failed to submit deposit request:', {
      message: errorMessage,
    });
    throw error;
  }
}

// ==========================================
// REPAY OPERATIONS
// ==========================================

/**
 * Creates a repay configuration object
 * @param repayAmountUnit - UNIT amount to repay (in UNIT, not cents)
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Repay configuration
 */
export function createRepayConfig(
  repayAmountUnit: number,
  feeRate: number
): WalletVaultRepayConfig {
  logger.debug('[VaultOps] Creating repay config:', { repayAmountUnit, feeRate });

  const config: WalletVaultRepayConfig = {
    deposit_amount: 0, // No deposit when repaying
    repay_amount: Number((repayAmountUnit * 100).toFixed(0)), // Convert to cents
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Repay config created:', config);
  return config;
}

/**
 * Reserves UNIT amount from Guardian for repay operation
 * @param gclient - Connected Guardian socket
 * @param repayConfig - Repay configuration
 * @param vaultPubkey - Vault public key (taproot)
 * @returns Unit account response with mint account info
 */
export async function guardianRepayReserve(
  gclient: GuardianSocket,
  repayConfig: WalletVaultRepayConfig,
  vaultPubkey: string
): Promise<UnitAccountResponse> {
  logger.debug('[VaultOps] Reserving UNIT from guardian for repay:', {
    amount: repayConfig.repay_amount,
    vaultPubkey,
  });

  const acctRes = await withGuardianTimeout(
    gclient.req.unit
      .reserve({
        unit_amount: repayConfig.repay_amount,
        vault_action: 'repay',
        vault_pubkey: vaultPubkey,
      })
      .resolve(30_000)
  );

  logger.debug('[VaultOps] UNIT reserved for repay:', acctRes);
  return acctRes as UnitAccountResponse;
}

export interface CreateRepayReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  utxos?: Utxo[];
}

/**
 * Creates a vault repay request with PSBT for signing
 * @param wallet - VaultWallet instance
 * @param repayConfig - Repay configuration
 * @param acctRes - Unit account response from guardian
 * @param options - Options including oracle quote and vault profile
 * @returns Vault repay request with PSBT
 */
export async function createVaultReqRepay(
  wallet: VaultWallet,
  repayConfig: WalletVaultRepayConfig,
  acctRes: UnitAccountResponse,
  options: CreateRepayReqOptions
): Promise<WalletVaultRepayRequest> {
  logger.debug('[VaultOps] Creating repay request...');

  try {
    const { feeRate, oracleQuote, vaultProfile } = options;

    logger.debug('[VaultOps] Repay context inputs:', {
      mintAccount: !!acctRes.mint_account,
      oracleQuote: !!oracleQuote,
      vaultProfile: {
        acct_id: vaultProfile.acct_id,
        guard_pk: vaultProfile.guard_pk?.substring(0, 20) + '...',
        master_id: vaultProfile.master_id,
        vault_pk: vaultProfile.vault_pk?.substring(0, 20) + '...',
        hasRdata: !!vaultProfile.rdata,
        hasUtxo: !!vaultProfile.utxo,
      },
      repayAmount: repayConfig.repay_amount,
    });

    // Create repay context
    const vaultCtx: VaultRepayCtx = wallet.vault.repay.ctx(
      acctRes.mint_account,
      oracleQuote,
      vaultProfile,
      repayConfig
    );

    // Get transaction quote
    const txQuote = wallet.vault.repay.quote(vaultCtx);
    logger.debug('[VaultOps] Repay tx quote:', {
      totalCost: txQuote.total_cost,
    });

    // Get sats UTXOs for transaction fees
    let satsUtxos = options.utxos;
    if (!satsUtxos) {
      const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
      satsUtxos = await wallet.fetch.sats_utxos(costWithVins);
    }

    if (!satsUtxos || satsUtxos.length === 0) {
      throw new Error('No sats UTXOs available for repay transaction fees');
    }

    // Get UNIT UTXOs for burning (required for repay)
    const unitUtxos = await wallet.fetch.rune_utxos(
      VAULT_CONFIG.RUNE_LABEL,
      vaultCtx.repay_amount
    );

    if (!unitUtxos || unitUtxos.length === 0) {
      throw new Error('No UNIT UTXOs available to repay. Make sure you have enough UNIT tokens.');
    }

    logger.debug('[VaultOps] UTXOs for repay:', {
      satsUtxosCount: satsUtxos.length,
      unitUtxosCount: unitUtxos.length,
    });

    // Check if batch signing is allowed
    const isBatch = checkBatchAllowed(wallet);

    // Create the repay request
    const repayReq = await wallet.vault.repay.req(vaultCtx, satsUtxos, unitUtxos, isBatch);

    logger.debug('[VaultOps] Repay request created:', {
      sats_inputs_count: repayReq.sats_inputs?.length,
    });

    return repayReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create repay request:', { error });
    throw error;
  }
}

/**
 * Submits signed repay request to Guardian
 * @param gclient - Connected Guardian socket
 * @param repayReq - Signed repay request
 * @returns Transaction IDs (issue and vault)
 */
export async function guardianSendReqRepay(
  gclient: GuardianSocket,
  repayReq: WalletVaultRepayRequest
): Promise<{ txid: string; vault_txid: string }> {
  logger.debug('[VaultOps] Submitting repay request to guardian...');

  try {
    const guardSub = await gclient.req.vault.repay(repayReq);
    logger.debug('[VaultOps] Repay request submitted, waiting for response...');

    // Small delay before resolving (as in frontend)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const guardRes = await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + 5000
    ) as VaultRepayResponse;

    const txid = guardRes.repay_txid;
    const vault_txid = guardRes.vault_txid;

    logger.debug('[VaultOps] Repay completed:', { txid, vault_txid });

    return { txid, vault_txid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[VaultOps] Failed to submit repay request:', {
      message: errorMessage,
    });
    throw error;
  }
}

// ==========================================
// WITHDRAW OPERATIONS
// ==========================================

/**
 * Creates a withdraw configuration object
 * @param withdrawAmountSats - BTC amount to withdraw in satoshis
 * @param feeRate - Transaction fee rate in sat/vB
 * @returns Withdraw configuration
 */
export function createWithdrawConfig(
  withdrawAmountSats: number,
  feeRate: number
): WalletVaultWithdrawConfig {
  logger.debug('[VaultOps] Creating withdraw config:', { withdrawAmountSats, feeRate });

  const config: WalletVaultWithdrawConfig = {
    change_amount: withdrawAmountSats,
    tx_feerate: feeRate,
  };

  logger.debug('[VaultOps] Withdraw config created:', config);
  return config;
}

export interface CreateWithdrawReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
}

/**
 * Creates a vault withdraw request with PSBT for signing
 * Note: Withdraw does NOT require UNIT reservation (like deposit)
 * @param wallet - VaultWallet instance
 * @param withdrawConfig - Withdraw configuration
 * @param options - Options including oracle quote and vault profile
 * @returns Vault withdraw request with PSBT
 */
export async function createVaultReqWithdraw(
  wallet: VaultWallet,
  withdrawConfig: WalletVaultWithdrawConfig,
  options: CreateWithdrawReqOptions
): Promise<WalletVaultWithdrawRequest> {
  logger.debug('[VaultOps] Creating withdraw request...');

  try {
    const { oracleQuote, vaultProfile } = options;

    logger.debug('[VaultOps] Withdraw context inputs:', {
      oracleQuote: !!oracleQuote,
      vaultProfile: {
        acct_id: vaultProfile.acct_id,
        guard_pk: vaultProfile.guard_pk?.substring(0, 20) + '...',
        master_id: vaultProfile.master_id,
        vault_pk: vaultProfile.vault_pk?.substring(0, 20) + '...',
        hasRdata: !!vaultProfile.rdata,
        hasUtxo: !!vaultProfile.utxo,
      },
      withdrawAmount: withdrawConfig.change_amount,
    });

    // Create withdraw context
    const vaultCtx: VaultWithdrawCtx = wallet.vault.withdraw.ctx(
      oracleQuote,
      vaultProfile,
      withdrawConfig
    );

    // Create the withdraw request (simpler than other ops - no UTXOs needed)
    const withdrawReq = await wallet.vault.withdraw.req(vaultCtx);

    logger.debug('[VaultOps] Withdraw request created:', {
      vault_txid: withdrawReq.vault_txid,
    });

    return withdrawReq;
  } catch (error) {
    logger.error('[VaultOps] Failed to create withdraw request:', { error });
    throw error;
  }
}

/**
 * Submits signed withdraw request to Guardian
 * Note: Withdraw returns only vault_txid (no issue_txid since no UNIT involved)
 * @param gclient - Connected Guardian socket
 * @param withdrawReq - Signed withdraw request
 * @returns Vault transaction ID
 */
export async function guardianSendReqWithdraw(
  gclient: GuardianSocket,
  withdrawReq: WalletVaultWithdrawRequest
): Promise<{ vault_txid: string }> {
  logger.debug('[VaultOps] Submitting withdraw request to guardian...');

  try {
    const guardSub = await gclient.req.vault.withdraw(withdrawReq);
    logger.debug('[VaultOps] Withdraw request submitted, waiting for response...');

    // Small delay before resolving (as in frontend)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const guardRes = await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + 5000
    ) as { vault_txid: string };

    const vault_txid = guardRes.vault_txid;

    logger.debug('[VaultOps] Withdraw completed:', { vault_txid });

    return { vault_txid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[VaultOps] Failed to submit withdraw request:', {
      message: errorMessage,
    });
    throw error;
  }
}
