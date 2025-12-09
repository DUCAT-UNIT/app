/**
 * Vault Repay Operations
 */

import type {
  GuardianSocket,
  PriceQuote,
  UnitAccountResponse,
  VaultProfile,
  VaultRepayCtx,
  VaultRepayResponse,
  VaultWallet,
  WalletVaultRepayConfig,
  WalletVaultRepayRequest,
} from '@ducat-unit/client-sdk';
import { VAULT_CONFIG, BITCOIN_TX } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { checkBatchAllowed, Utxo } from './utils';

export interface CreateRepayReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  utxos?: Utxo[];
}

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
      VAULT_CONFIG.TX_TIMEOUT + BITCOIN_TX.TX_TIMEOUT_BUFFER
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
