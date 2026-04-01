/**
 * Vault Utilities
 * Helper functions for vault operations and calculations
 */

import { VaultAPI } from '@ducat-unit/client-sdk';
import type { VaultOpenConfig } from '@ducat-unit/client-sdk/vault';
import * as Crypto from 'expo-crypto';
import { VAULT_CONFIG } from './constants';

/**
 * Generates a random vault name/tag
 * Format: vault-{8 random hex chars}
 */
export function generateVaultName(): string {
  const randomBytes = Crypto.getRandomBytes(4);
  const hex = Buffer.from(randomBytes).toString('hex');
  return `vault-${hex}`;
}

/**
 * Calculates the estimated operation cost for opening a vault
 * @param feeRate - Fee rate in sat/vB
 * @param utxos - Optional UTXOs to calculate actual input size
 * @returns Total cost in satoshis
 */
export function getOpCostOpen(feeRate: number, utxos?: Utxo[]): number {
  const vinAllowanceSats = utxos
    ? calculateVinAllowance(utxos, feeRate)
    : VAULT_CONFIG.VIN_ALLOWANCE * feeRate;

  const txQuote = VaultAPI.open.get_quote({
    deposit_amount: 0,
    unit_postage: VAULT_CONFIG.UNIT_POSTAGE,
    token_postage: VAULT_CONFIG.TOKEN_POSTAGE,
    token_data: { rev: 0, tag: 'vault-name', ver: 1 },
    tx_feerate: feeRate,
  } as VaultOpenConfig);

  return txQuote.total_cost + vinAllowanceSats;
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  script?: string;
}

/**
 * Calculates the virtual bytes for input scripts
 */
function calculateVinAllowance(utxos: Utxo[], feeRate: number): number {
  // Simplified calculation - uses estimated sizes
  const vsize = utxos.reduce((acc, utxo) => {
    // Default to native segwit if script is unavailable
    const scriptType = utxo.script ? getScriptType(utxo.script) : 'p2w-pkh';
    return acc + getScriptSize(scriptType);
  }, 0);

  return vsize * feeRate;
}

type ScriptType = 'p2tr' | 'p2w-pkh' | 'p2sh' | 'p2pkh';

function getScriptType(script: string): ScriptType {
  // Simple heuristic based on script prefix
  if (script.startsWith('5120')) return 'p2tr'; // Taproot
  if (script.startsWith('0014')) return 'p2w-pkh'; // Native SegWit
  if (script.startsWith('a914')) return 'p2sh'; // P2SH
  return 'p2pkh'; // Legacy
}

function getScriptSize(scriptType: ScriptType): number {
  switch (scriptType) {
    case 'p2tr':
      return 57; // Taproot input size
    case 'p2w-pkh':
      return 68; // Native SegWit input size
    case 'p2sh':
      return 108; // P2SH input size
    case 'p2pkh':
      return 148; // Legacy input size
    default:
      return VAULT_CONFIG.VIN_ALLOWANCE;
  }
}

/**
 * Calculates the maximum UNIT that can be borrowed given BTC deposit
 * @param btc - BTC amount in BTC
 * @param bitcoinPrice - Current BTC price in USD
 * @returns Maximum borrowable UNIT, or null if invalid
 */
export function getMaxUnit(btc: number, bitcoinPrice: number | undefined): number | null {
  if (bitcoinPrice === undefined || btc <= 0) {
    return null;
  }
  // Subtract 1 UNIT to ensure health rounds to >= 160% after Math.floor in computeHealthFactor
  return Math.max(Number(((btc * bitcoinPrice) / VAULT_CONFIG.MIN_COL_RATE).toFixed(2)) - 1, 0);
}

/**
 * Calculates the maximum UNIT rounded to whole number
 */
export function getMaxUnitRounded(btc: number, bitcoinPrice: number | undefined): number | null {
  const maxBalance = getMaxUnit(btc, bitcoinPrice);
  return maxBalance !== null ? Math.floor(maxBalance) : null;
}

/**
 * Computes the liquidation price threshold
 * @param unitInVault - Total UNIT in vault
 * @param btcInVault - Total BTC in vault
 * @returns Liquidation price in USD, or 0 if no debt/collateral (cannot be liquidated)
 */
export function computeLiquidationPrice(unitInVault: number, btcInVault: number): number {
  if (btcInVault === 0 || unitInVault === 0) return 0;
  const tholdPrice = (unitInVault * VAULT_CONFIG.LIQUIDATION_RATE) / btcInVault;
  return Math.floor(tholdPrice * 100) / 100;
}

/**
 * Computes the health factor percentage
 * @param btcInVault - BTC amount in vault
 * @param bitcoinPrice - Current BTC price in USD
 * @param unitInVault - UNIT amount in vault
 * @returns Health factor as percentage (e.g., 200 = 200%)
 */
export function computeHealthFactor(
  btcInVault: number,
  bitcoinPrice: number,
  unitInVault: number
): number {
  if (unitInVault === 0) return 0;
  // Use bigint math to avoid overflow for large positions while keeping original units.
  const scaledBtc = BigInt(Math.trunc(btcInVault * 1e8));       // sats
  const scaledPrice = BigInt(Math.trunc(bitcoinPrice * 1e2));   // cents
  const scaledUnit = BigInt(Math.trunc(unitInVault * 1e2));     // UNIT cents

  if (scaledUnit === 0n) return 0;

  // health = (btc * price / unit) * 100
  // We scaled btc by 1e8, price by 1e2, unit by 1e2.
  // Multiply by 100 then divide by 1e8 to remove btc scaling.
  const factorBig = (scaledBtc * scaledPrice * 100n) / (scaledUnit * 1_0000_0000n);
  const factor = Number(factorBig);
  // SECURITY: Use Math.floor to always show conservative (worse) health factor
  // Math.round could show 160% for 159.5%, hiding that vault is below minimum threshold
  return Number.isFinite(factor) ? Math.floor(factor) : 0;
}

/**
 * Gets health status based on health factor
 */
export type HealthStatus = 'healthy' | 'warning' | 'danger';

export function getHealthStatus(healthFactor: number): HealthStatus {
  if (healthFactor >= 200) return 'healthy';
  if (healthFactor >= 160) return 'warning';
  return 'danger';
}

/**
 * Gets the color for health status
 */
export function getHealthColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '#59AA8A'; // Green (semantic.success)
    case 'warning':
      return '#F5A623'; // Yellow/Orange (semantic.warning)
    case 'danger':
      return '#D04C68'; // Red (semantic.error)
  }
}

/**
 * Gets the color for a numeric health factor value.
 * Convenience wrapper that derives HealthStatus from the number first.
 * @param health - Health factor percentage (e.g. 160, 200, 250)
 * @returns Hex color string
 */
export function getHealthColorFromValue(health: number): string {
  return getHealthColor(getHealthStatus(health));
}

/**
 * Validates vault creation parameters
 */
export interface VaultValidation {
  isValid: boolean;
  errors: string[];
}

export function validateVaultParams(
  btcAmount: number,
  unitAmount: number,
  bitcoinPrice: number | undefined,
  availableBtc: number
): VaultValidation {
  const errors: string[] = [];

  if (btcAmount <= 0) {
    errors.push('BTC deposit amount must be greater than 0');
  }

  if (unitAmount <= 0) {
    errors.push('UNIT borrow amount must be greater than 0');
  }

  if (btcAmount > availableBtc) {
    errors.push('Insufficient BTC balance');
  }

  if (bitcoinPrice !== undefined && unitAmount > 0 && btcAmount > 0) {
    const healthFactor = computeHealthFactor(btcAmount, bitcoinPrice, unitAmount);
    if (healthFactor < 160) {
      errors.push('Health factor too low (minimum 160%)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
