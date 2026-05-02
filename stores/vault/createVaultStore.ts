/**
 * createVaultStore Factory
 * Creates common state and actions for vault operation stores
 */

import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
} from '../../utils/vaultUtils';

/**
 * Helper to compute derived health values
 * Can be used in specific store hooks
 */
export function computeVaultHealth(
  currentBtcLocked: number,
  currentUnitBorrowed: number,
  bitcoinPrice: number | null
) {
  const healthFactor =
    !bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0
      ? 0
      : computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);

  const liquidationPrice =
    currentBtcLocked <= 0 || currentUnitBorrowed <= 0
      ? 0
      : computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);

  const healthStatus = getHealthStatus(healthFactor);

  return { healthFactor, liquidationPrice, healthStatus };
}

/**
 * Helper to compute new health values after an operation
 */
export function computeNewVaultHealth(
  newCollateral: number,
  newDebt: number,
  bitcoinPrice: number | null
) {
  const newHealthFactor =
    !bitcoinPrice || newCollateral <= 0 || newDebt <= 0
      ? 0
      : computeHealthFactor(newCollateral, bitcoinPrice, newDebt);

  const newLiquidationPrice =
    newCollateral <= 0 || newDebt <= 0
      ? 0
      : computeLiquidationPrice(newDebt, newCollateral);

  const newHealthStatus = getHealthStatus(newHealthFactor);

  return { newHealthFactor, newLiquidationPrice, newHealthStatus };
}
