/**
 * Vault Deposit Operations
 */

import {
  VaultAPI,
  type GuardianSocket,
  type PriceQuote,
  type VaultDepositCtx,
  type VaultProfile,
  type VaultWallet,
  type WalletVaultDepositConfig,
  type WalletVaultDepositRequest,
} from '@ducat-unit/client-sdk';
import { VAULT_CONFIG, BITCOIN_TX } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { withGuardianTimeout } from '../guardianService';
import { MAX_QUOTE_AGE_SECONDS } from '../oracleService';
import { Utxo, withVaultOperationLock } from './utils';
import { withVaultBuildTimeout } from './operationTimeout';
import {
  clearPendingVaultSigningOperation,
  setPendingVaultSigningOperation,
} from '../vaultWallet/signingContext';

export interface CreateDepositReqOptions {
  feeRate: number;
  oracleQuote: PriceQuote;
  vaultProfile: VaultProfile;
  isMaxAmount?: boolean;
  utxos?: Utxo[];
}

const MAX_AUTO_ADJUST_DEPOSIT_SATS = 50_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isInsufficientSatsError(error: unknown): boolean {
  return /insufficient sats/i.test(errorMessage(error));
}

function getDepositChange(vaultCtx: VaultDepositCtx, utxos: Utxo[]): number {
  return VaultAPI.deposit.get_change(vaultCtx, utxos);
}

function createDepositCtx(
  wallet: VaultWallet,
  oracleQuote: PriceQuote,
  vaultProfile: VaultProfile,
  depositConfig: WalletVaultDepositConfig
): VaultDepositCtx {
  return wallet.vault.deposit.ctx(oracleQuote, vaultProfile, depositConfig);
}

function assertDepositChange(vaultCtx: VaultDepositCtx, utxos: Utxo[]): void {
  const changeSats = getDepositChange(vaultCtx, utxos);

  if (changeSats < 0) {
    throw new Error(
      'Not enough BTC to cover the deposit and vault transaction fee. Try a slightly smaller amount.'
    );
  }

  if (changeSats > 0 && changeSats <= BITCOIN_TX.DUST_LIMIT) {
    throw new Error('Deposit would leave dust change. Try a slightly smaller amount.');
  }
}

function isSameUtxoSet(first: Utxo[], second: Utxo[]): boolean {
  if (first.length !== second.length) return false;

  const key = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}:${utxo.value}`;
  const firstKeys = new Set(first.map(key));
  return second.every((utxo) => firstKeys.has(key(utxo)));
}

function resolveDepositContext(
  wallet: VaultWallet,
  oracleQuote: PriceQuote,
  vaultProfile: VaultProfile,
  depositConfig: WalletVaultDepositConfig,
  utxos: Utxo[],
  isMaxAmount: boolean | undefined
): VaultDepositCtx {
  let vaultCtx = createDepositCtx(wallet, oracleQuote, vaultProfile, depositConfig);
  const changeSats = getDepositChange(vaultCtx, utxos);

  if (changeSats < 0 || (changeSats > 0 && changeSats <= BITCOIN_TX.DUST_LIMIT)) {
    const requestedAmount = depositConfig.deposit_amount;
    const zeroDepositCtx = createDepositCtx(wallet, oracleQuote, vaultProfile, {
      ...depositConfig,
      deposit_amount: 0,
    });
    const maxSafeDeposit = Math.floor(getDepositChange(zeroDepositCtx, utxos));
    const adjustmentSats = Math.abs(requestedAmount - maxSafeDeposit);
    const canAutoAdjust =
      Boolean(isMaxAmount) || adjustmentSats <= MAX_AUTO_ADJUST_DEPOSIT_SATS;

    if (maxSafeDeposit > 0 && canAutoAdjust) {
      depositConfig.deposit_amount = maxSafeDeposit;
      vaultCtx = createDepositCtx(wallet, oracleQuote, vaultProfile, depositConfig);
      assertDepositChange(vaultCtx, utxos);
      logger.info('[VaultOps] Adjusted near-max deposit to exact safe amount', {
        requestedAmount,
        adjustedAmount: maxSafeDeposit,
        adjustmentSats,
        previousChangeSats: changeSats,
        utxoCount: utxos.length,
      });
      return vaultCtx;
    }
  }

  assertDepositChange(vaultCtx, utxos);
  return vaultCtx;
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
  // SECURITY: Serialize vault operations to prevent concurrent UTXO usage
  return withVaultOperationLock(async () => {
    logger.debug('[VaultOps] Creating deposit request...');

    try {
      const { feeRate, oracleQuote, vaultProfile } = options;

      // SECURITY: Re-validate oracle price freshness before building transaction.
      const quoteAgeSec = Math.floor(Date.now() / 1000) - oracleQuote.latest_stamp;
      if (quoteAgeSec > MAX_QUOTE_AGE_SECONDS) {
        throw new Error(
          `Oracle price is stale (${Math.floor(quoteAgeSec / 60)} min old). Please go back and refresh.`
        );
      }

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

      let vaultCtx = createDepositCtx(wallet, oracleQuote, vaultProfile, depositConfig);

      // Get UTXOs for the transaction
      let utxos = options.utxos;
      if (!utxos) {
        const txQuote = wallet.vault.deposit.quote(vaultCtx);
        const costWithVins = txQuote.total_cost + VAULT_CONFIG.VIN_ALLOWANCE * feeRate;
        try {
          utxos = await withVaultBuildTimeout(
            wallet.fetch.sats_utxos(costWithVins),
            'Timed out fetching BTC UTXOs for deposit. Please try again.'
          );
        } catch (error) {
          if (!isInsufficientSatsError(error)) {
            throw error;
          }

          const allUtxos = await withVaultBuildTimeout(
            wallet.fetch.sats_utxos(),
            'Timed out fetching BTC UTXOs for max deposit. Please try again.'
          );

          if (allUtxos.length === 0) {
            throw new Error('No UTXOs available for deposit transaction');
          }

          vaultCtx = resolveDepositContext(
            wallet,
            oracleQuote,
            vaultProfile,
            depositConfig,
            allUtxos,
            options.isMaxAmount
          );
          logger.debug('[VaultOps] Falling back to all BTC UTXOs for near-max deposit', {
            utxoCount: allUtxos.length,
            depositAmount: depositConfig.deposit_amount,
            changeSats: getDepositChange(vaultCtx, allUtxos),
          });
          utxos = allUtxos;
        }
      }

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available for deposit transaction');
      }

      try {
        vaultCtx = resolveDepositContext(
          wallet,
          oracleQuote,
          vaultProfile,
          depositConfig,
          utxos,
          options.isMaxAmount
        );
      } catch (error) {
        if (options.utxos) {
          throw error;
        }

        const allUtxos = await withVaultBuildTimeout(
          wallet.fetch.sats_utxos(),
          'Timed out fetching BTC UTXOs for max deposit. Please try again.'
        );

        if (allUtxos.length === 0 || isSameUtxoSet(utxos, allUtxos)) {
          throw error;
        }

        vaultCtx = resolveDepositContext(
          wallet,
          oracleQuote,
          vaultProfile,
          depositConfig,
          allUtxos,
          options.isMaxAmount
        );
        logger.debug('[VaultOps] Retried deposit with all BTC UTXOs', {
          previousUtxoCount: utxos.length,
          allUtxoCount: allUtxos.length,
          depositAmount: depositConfig.deposit_amount,
          changeSats: getDepositChange(vaultCtx, allUtxos),
        });
        utxos = allUtxos;
      }

      let depositReq: WalletVaultDepositRequest;
      setPendingVaultSigningOperation({
        action: 'deposit',
        ctx: vaultCtx,
        satsUtxos: utxos,
      });
      try {
        depositReq = await withVaultBuildTimeout(
          wallet.vault.deposit.req(vaultCtx, utxos),
          'Timed out building the deposit transaction. Please try again.'
        );
      } finally {
        clearPendingVaultSigningOperation();
      }

      logger.debug('[VaultOps] Deposit request created:', {
        vault_txid: depositReq.vault_txid,
        sats_inputs_count: depositReq.sats_inputs?.length,
      });

      return depositReq;
    } catch (error) {
      logger.error('[VaultOps] Failed to create deposit request:', { error });
      throw error;
    }
  }, options.vaultProfile.vault_pk || '__default__'); // end withVaultOperationLock
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
  logger.debug('[VaultOps] Submitting deposit request to guardian...', {
    vault_txid: depositReq.vault_txid,
    sats_inputs_count: depositReq.sats_inputs?.length,
  });

  try {
    const submitStartedAt = Date.now();
    const guardSub = gclient.req.vault.deposit(depositReq);
    logger.info('[VaultOps] Deposit request submitted to guardian', {
      durationMs: Date.now() - submitStartedAt,
    });

    const guardRes = (await withGuardianTimeout(
      guardSub.resolve(VAULT_CONFIG.TX_TIMEOUT),
      VAULT_CONFIG.TX_TIMEOUT + BITCOIN_TX.TX_TIMEOUT_BUFFER
    )) as { vault_txid: string };

    const vault_txid = guardRes.vault_txid;

    logger.info('[VaultOps] Deposit guardian response ready', {
      durationMs: Date.now() - submitStartedAt,
      vault_txid,
    });

    return { vault_txid };
  } catch (error) {
    let guardianErrorMessage: string;
    if (error instanceof Error) {
      guardianErrorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Guardian errors may be objects with various properties
      guardianErrorMessage = JSON.stringify(error);
    } else {
      guardianErrorMessage = String(error);
    }
    logger.error('[VaultOps] Failed to submit deposit request:', {
      message: guardianErrorMessage,
      errorType: typeof error,
      errorKeys: typeof error === 'object' && error !== null ? Object.keys(error) : [],
    });
    throw new Error(`Failed to submit deposit request: ${guardianErrorMessage}`);
  }
}
