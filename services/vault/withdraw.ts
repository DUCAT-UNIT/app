/**
 * Vault Withdraw Operations
 */

import type {
  GuardianSocket,
  PriceQuote,
  VaultProfile,
  VaultWallet,
  VaultWithdrawCtx,
  WalletVaultWithdrawConfig,
  WalletVaultWithdrawRequest,
} from '@ducat-unit/client-sdk';
import { VAULT_CONFIG, BITCOIN_TX } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { MAX_QUOTE_AGE_SECONDS } from '../oracleService';
import { withVaultOperationLock } from './utils';
import { withVaultBuildTimeout } from './operationTimeout';
import {
  clearPendingVaultSigningOperation,
  setPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';
import { resolveVaultActionPriceQuote } from './priceQuote';

export interface CreateWithdrawReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
}

type CompatWithdrawCtx = VaultWithdrawCtx & {
  __base_config?: (overrides?: Record<string, unknown>) => Record<string, unknown>;
};

function forceNoTxFeeReserve(vaultCtx: VaultWithdrawCtx): void {
  const compatCtx = vaultCtx as CompatWithdrawCtx;
  if (typeof compatCtx.__base_config !== 'function') {
    return;
  }

  const buildBaseConfig = compatCtx.__base_config.bind(compatCtx);
  compatCtx.__base_config = (overrides = {}) => ({
    ...buildBaseConfig({ ...overrides, txfee_reserve: 0 }),
    txfee_reserve: 0,
  });
}

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
  // SECURITY: Serialize vault operations to prevent concurrent UTXO usage
  return withVaultOperationLock(async () => {
    logger.debug('[VaultOps] Creating withdraw request...');

    try {
      const { oracleQuote, vaultProfile } = options;

      // SECURITY: Re-validate oracle price freshness before building transaction.
      const quoteAgeSec = Math.floor(Date.now() / 1000) - oracleQuote.latest_stamp;
      if (quoteAgeSec > MAX_QUOTE_AGE_SECONDS) {
        throw new Error(
          `Oracle price is stale (${Math.floor(quoteAgeSec / 60)} min old). Please go back and refresh.`
        );
      }

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
      let vaultCtx: VaultWithdrawCtx = wallet.vault.withdraw.ctx(
        oracleQuote,
        vaultProfile,
        withdrawConfig
      );
      forceNoTxFeeReserve(vaultCtx);

      const requestOracleQuote = await resolveVaultActionPriceQuote({
        actionName: 'withdraw',
        vaultCtx,
        oracleQuote,
        fundUtxos: [],
      });
      if (requestOracleQuote !== oracleQuote) {
        vaultCtx = wallet.vault.withdraw.ctx(requestOracleQuote, vaultProfile, withdrawConfig);
        forceNoTxFeeReserve(vaultCtx);
      }

      let withdrawReq: WalletVaultWithdrawRequest;
      setPendingVaultSigningOperation({
        action: 'withdraw',
        ctx: vaultCtx,
      });
      try {
        withdrawReq = await withVaultBuildTimeout(
          wallet.vault.withdraw.req(vaultCtx),
          'Timed out building the withdraw transaction. Please try again.'
        );
      } finally {
        clearPendingVaultSigningOperation();
      }

      logger.debug('[VaultOps] Withdraw request created:', {
        vault_txid: withdrawReq.vault_txid,
      });

      return withdrawReq;
    } catch (error) {
      logger.error('[VaultOps] Failed to create withdraw request:', { error });
      throw error;
    }
  }, options.vaultProfile.vault_pk || '__default__'); // end withVaultOperationLock
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
    const submitStartedAt = Date.now();
    const guardSub = gclient.req.vault.withdraw(withdrawReq);
    logger.info('[VaultOps] Withdraw request submitted to guardian', {
      durationMs: Date.now() - submitStartedAt,
    });

    const guardRes = (await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + BITCOIN_TX.TX_TIMEOUT_BUFFER
    )) as { vault_txid: string };

    const vault_txid = guardRes.vault_txid;

    logger.info('[VaultOps] Withdraw guardian response ready', {
      durationMs: Date.now() - submitStartedAt,
      vault_txid,
    });

    return { vault_txid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[VaultOps] Failed to submit withdraw request:', {
      message: errorMessage,
    });
    throw error;
  }
}
