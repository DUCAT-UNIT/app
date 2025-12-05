/**
 * Vault Deposit Operations
 */

import type {
  GuardianSocket,
  PriceQuote,
  VaultDepositCtx,
  VaultProfile,
  VaultWallet,
  WalletVaultDepositConfig,
  WalletVaultDepositRequest,
} from '@ducat-unit/client-sdk';
import { VAULT_CONFIG } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { Utxo } from './utils';

export interface CreateDepositReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  isMaxAmount?: boolean;
  utxos?: Utxo[];
}

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
