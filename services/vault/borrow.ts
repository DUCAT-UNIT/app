/**
 * Vault Borrow Operations
 */

import type {
  GuardianSocket,
  PriceQuote,
  UnitAccountResponse,
  VaultBorrowCtx,
  VaultProfile,
  VaultWallet,
  WalletVaultBorrowConfig,
  WalletVaultBorrowRequest,
} from '@ducat-unit/client-sdk';
import { VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { checkBatchAllowed, Utxo } from './utils';

export interface CreateBorrowReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  utxos?: Utxo[];
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
