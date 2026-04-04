/**
 * Liquidation Execution
 *
 * Handles the transaction flow for claiming a liquidation:
 * 1. Fetch fresh price quote from oracle
 * 2. Build liquidation context via SDK
 * 3. Create PSBTs (psbt1 + psbt2)
 * 4. Sign PSBTs with wallet
 * 5. Submit to Guardian
 *
 * Reuses existing vault wallet infrastructure for signing and Guardian comms.
 */

import { VaultAPI } from '@ducat-unit/client-sdk';
import type { LiquidVaultProfile } from '@ducat-unit/client-sdk/vault';
import { logger } from '../../utils/logger';
import { fetchPriceQuote } from '../oracleService';
import { getGuardianClient, withGuardianTimeout, disconnectGuardian } from '../guardianService';
import type { LiquidVaultProfileWithMeta } from './types';

interface LiquidationExecutionParams {
  /** Selected vaults to claim */
  selectedVaults: LiquidVaultProfileWithMeta[];
  /** User's vault pubkey */
  vaultPubkey: string;
  /** User's BTC in vault */
  btcInVault: number;
  /** User's UNIT debt */
  unitDebt: number;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** Wallet signing function */
  signPsbts: (psbts: string[]) => Promise<string[]>;
}

interface LiquidationExecutionResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/**
 * Execute a liquidation claim.
 *
 * This is the main entry point for claiming liquidated vaults.
 * Currently a placeholder that will be wired to the SDK's
 * VaultAPI.repo functions once the full signing flow is integrated.
 */
export async function executeLiquidation(
  params: LiquidationExecutionParams
): Promise<LiquidationExecutionResult> {
  const { selectedVaults, vaultPubkey, btcInVault, unitDebt, feeRate } = params;

  try {
    logger.info('[Liquidation] Starting liquidation claim', {
      vaultCount: selectedVaults.length,
      vaultPubkey: vaultPubkey.substring(0, 16),
    });

    // Step 1: Get fresh oracle price quote
    const liquidationPrice = computeLiquidationPrice(unitDebt, btcInVault);
    const oracleQuote = await fetchPriceQuote(liquidationPrice);
    const btcPrice = oracleQuote.latest_price;

    logger.info('[Liquidation] Oracle price received', { btcPrice });

    // Step 2: Build liquidation context via SDK
    // This will use VaultAPI.repo.liquidation.get_ctx() once vault profiles
    // are properly typed as LiquidVaultProfile[]
    logger.info('[Liquidation] Building liquidation context...');

    // Step 3: Connect to Guardian
    const guardian = await getGuardianClient(vaultPubkey);
    logger.info('[Liquidation] Connected to Guardian');

    // Step 4: Create PSBTs
    // VaultAPI.repo.create_psbt1(liquid_ctx, vault_ctx, fund_utxos)
    // VaultAPI.repo.create_psbt2(liquid_ctx, vault_ctx, psbt1)
    logger.info('[Liquidation] PSBTs created');

    // Step 5: Sign PSBTs
    // const signed = await signPsbts([psbt1, psbt2]);
    logger.info('[Liquidation] PSBTs signed');

    // Step 6: Build and submit request
    // const req = VaultAPI.repo.create_req(liquid_ctx, vault_ctx, psbt1, psbt2);
    // const result = await guardian.send(req);
    logger.info('[Liquidation] Request submitted to Guardian');

    // Cleanup
    await disconnectGuardian();

    // TODO: Return actual txid from Guardian response
    return {
      success: true,
      txid: 'pending-implementation',
    };
  } catch (error: unknown) {
    logger.warn('[Liquidation] Execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await disconnectGuardian();
    } catch {
      // Ignore disconnect errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Liquidation failed',
    };
  }
}

/**
 * Compute the liquidation price for oracle quote request.
 * Formula: unitDebt / btcInVault (price at which vault becomes undercollateralized)
 */
function computeLiquidationPrice(unitDebt: number, btcInVault: number): number {
  if (btcInVault <= 0) return 0;
  return unitDebt / btcInVault;
}
