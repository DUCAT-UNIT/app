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

export interface CreateWithdrawReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
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
      VAULT_CONFIG.TX_TIMEOUT + BITCOIN_TX.TX_TIMEOUT_BUFFER
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
