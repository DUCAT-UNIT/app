/**
 * Liquidation Calculations
 *
 * Core calculation logic ported from the web frontend.
 * Uses the @ducat-unit/client-sdk for liquidation economics
 * and wraps with vault selection + aggregation logic.
 */

import { VaultAPI } from '@ducat-unit/client-sdk';
import type { LiquidVaultProfile } from '@ducat-unit/client-sdk/vault';
// ProtocolProfile is exported from the main SDK module
type ProtocolProfile = Parameters<typeof VaultAPI.repo.liquidation.get_profile>[0];
import { logger } from '../../utils/logger';
import { fetchProtocolContract } from '../vaultWallet';
import { COIN_SIZE, DUST_BTC, MIN_COL_RATE, UNIT_TO_BTC_RATE, VIN_ALLOWANCE } from './constants';
import { formatValidatorResponse } from './fetchVaults';
import { roundNumber, roundNumberDown, satsToBtc } from './math';
import type {
  ValidatorLiquidatedVault,
  LiquidationVaultComputedData,
  LiquidVaultProfileWithMeta,
  LiquidationInvestStats,
  ClaimFromInvestResult,
  EstimatedYield,
  HealthAfterLiquidation,
  SelectionStats,
} from './types';

// ============================================================
// Health Factor
// ============================================================

/**
 * Calculate vault health factor (collateral ratio × 100).
 * Formula: (btcInVault × btcPrice / unitDebt) × 100
 */
export function getHealthValue(btcPrice: number, btcInVault: number, unitDebt: number): number {
  if (roundNumber(btcInVault, 6) <= 0 || unitDebt <= 0) return NaN;
  return Number(((btcInVault * btcPrice / unitDebt) * 100).toFixed(0));
}

/**
 * Calculate available collateral for liquidation.
 * Formula: btcInVault - (MIN_COL_RATE × unitDebt / btcPrice)
 */
export function getAvailableCollateralBtc(
  btcPrice: number | undefined,
  btcInVault: number,
  unitDebt: number
): number {
  if (!btcPrice || !btcInVault) return 0;
  const available = btcInVault - (MIN_COL_RATE * unitDebt) / btcPrice;
  return available > 0 ? Number(available.toFixed(8)) : 0;
}

// ============================================================
// Core Metadata Computation
// ============================================================

/**
 * Compute liquidation metadata from an SDK LiquidVaultProfile.
 *
 * Profit formula:
 *   profitBtc = |((sats_balance - taxable_sats) / COIN_SIZE × coin_price - unit_balance / 100) / coin_price
 *               + (subsidy_rate × sats_balance) / COIN_SIZE|
 */
export function computeLiqMeta(profile: LiquidVaultProfile): Omit<LiquidationVaultComputedData, 'vaultId' | 'unit' | 'btcInVault' | 'unitSwapBtc'> {
  const {
    sats_balance,
    taxable_sats,
    unit_balance,
    coin_price,
    subsidy_rate,
    deficit_sats,
    profit_margin,
  } = profile.liquid_quote;

  const profitBtc =
    (((sats_balance - taxable_sats) / COIN_SIZE) * coin_price - unit_balance / 100) / coin_price +
    (subsidy_rate * sats_balance) / COIN_SIZE;

  return {
    postTaxBtcInVault: (sats_balance - taxable_sats) / COIN_SIZE,
    claimAmountBtc: deficit_sats > 0 ? deficit_sats / COIN_SIZE : 0,
    profitBtc: Math.abs(profitBtc),
    profitPercent: Math.abs(roundNumber(profit_margin * 100)),
    profitPercentPrecised: Math.abs(roundNumber(profit_margin * 100)),
    liquidationTaxRebatePercent: roundNumber(subsidy_rate * 100, 2),
  };
}

// ============================================================
// Partial Vault Recomputation
// ============================================================

/**
 * Re-compute a partial vault profile with its repo_portion applied.
 * Used when a vault is only partially claimed (last vault in a selection).
 */
export async function recomputePartialVaultProfile(
  claimedPartial: LiquidVaultProfileWithMeta,
  btcPrice: number,
): Promise<LiquidVaultProfileWithMeta> {
  const portion = Number(
    (claimedPartial.claimAmountPartial! / claimedPartial.claimAmountBtc).toFixed(4),
  );
  const contract = await fetchProtocolContract();
  const partialProfile = VaultAPI.repo.liquidation.get_profile(
    contract,
    claimedPartial as Parameters<typeof VaultAPI.repo.liquidation.get_profile>[1],
    claimedPartial.thold_key,
    btcPrice,
    portion,
  );
  const partialMeta = computeLiqMeta(partialProfile);
  return { ...claimedPartial, ...partialProfile, ...partialMeta } as LiquidVaultProfileWithMeta;
}

// ============================================================
// Build Liquidation Profiles
// ============================================================

/**
 * Process raw validator vault data into fully computed liquidation profiles.
 * Calls the SDK's get_liquid_profile for each vault, then computes metadata.
 * Returns sorted by profit margin (descending), capped at 300.
 */
export function computeLiquidVaultProfiles(
  rawVaults: ValidatorLiquidatedVault[],
  btcPrice: number,
  contract: ProtocolProfile
): LiquidVaultProfileWithMeta[] {
  const extendedProfiles = formatValidatorResponse(rawVaults);
  const results: LiquidVaultProfileWithMeta[] = [];

  for (const v of extendedProfiles) {
    const collateralRatio = getHealthValue(btcPrice, v.btcInVault - 0.0001, v.unit) / 100;

    if (collateralRatio <= 0) continue;

    try {
      const liquidProfile = VaultAPI.repo.liquidation.get_profile(
        contract,
        v as unknown as Parameters<typeof VaultAPI.repo.liquidation.get_profile>[1],
        v.thold_key,
        btcPrice
      );

      const meta = computeLiqMeta(liquidProfile);
      const unitSwapBtc = v.unit / btcPrice;

      if (meta.profitBtc > 0 && meta.claimAmountBtc >= 0) {
        results.push({
          ...v,
          ...liquidProfile,
          ...meta,
          unitSwapBtc,
        } as LiquidVaultProfileWithMeta);
      }
    } catch (error: unknown) {
      logger.debug('[Liquidation] Failed to compute profile for vault', {
        vaultId: v.vaultId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results
    .sort((a, b) => b.liquid_quote.profit_margin - a.liquid_quote.profit_margin)
    .slice(0, 300);
}

// ============================================================
// Vault Selection Algorithm
// ============================================================

/**
 * Select vaults up to a target claim amount.
 * Last vault may be partially claimed.
 */
export function selectItemsForAmount(
  data: LiquidVaultProfileWithMeta[],
  amount: number
): LiquidVaultProfileWithMeta[] {
  if (amount <= 0) return [];

  const result: LiquidVaultProfileWithMeta[] = [];
  let sum = 0;

  for (const item of data) {
    if (result.at(-1)?.claimAmountPartial) break;
    if (sum >= amount) break;

    const sumWithItem = sum + item.claimAmountBtc;

    if (sumWithItem > amount) {
      const claimAmountDiff = sumWithItem - amount;
      result.push({
        ...item,
        claimAmountDiff,
        claimAmountPartial: item.claimAmountBtc - claimAmountDiff,
      });
      break;
    }

    result.push({ ...item });
    sum = sumWithItem;
  }

  return result;
}

// ============================================================
// Investment Calculations
// ============================================================

/**
 * Calculate maximum investable amount given available resources.
 */
export function getMaxInvest(
  isAutoSwap: boolean,
  availableCollateralBtc: number,
  walletSats: number,
  btcPrice: number | undefined,
  feeRate: number,
  liquidationData: LiquidVaultProfileWithMeta[],
  investCap?: number
): LiquidationInvestStats {
  if (!btcPrice || walletSats <= 0 || liquidationData.length === 0) {
    return { maxInvestBtc: 0, maxClaimAmountBtc: 0, maxSwapBtc: 0, maxSwapUnit: 0, maxVaultCount: 0, lastPortionRate: 1 };
  }

  let collateralRemaining = Math.max(0, availableCollateralBtc);
  const walletBtc = satsToBtc(walletSats);
  let walletCostBtc = 0;
  let feesBtc = 0;
  let maxInvestBtc = 0;
  let maxClaimAmountBtc = 0;
  let maxSwapBtc = 0;
  let maxSwapUnit = 0;
  let vaultCount = 0;
  let lastPortionRate = 1;

  for (const vaultProfile of liquidationData) {
    if (investCap && maxClaimAmountBtc >= investCap) break;

    vaultCount++;
    const opcost = getOpCostRepo(feeRate, vaultCount);
    feesBtc = satsToBtc(opcost);
    const walletBtcAvailable = walletBtc - feesBtc - walletCostBtc;
    if (walletBtcAvailable <= DUST_BTC) {
      vaultCount--;
      feesBtc = vaultCount > 0 ? satsToBtc(getOpCostRepo(feeRate, vaultCount)) : 0;
      break;
    }

    const { claimAmountBtc, unit } = vaultProfile;
    if (claimAmountBtc <= 0) continue;

    const capRemaining = investCap ? Math.max(0, investCap - maxClaimAmountBtc) : claimAmountBtc;
    const maxClaimForVault = Math.min(claimAmountBtc, capRemaining);
    const requiredSwapBtc = isAutoSwap ? (unit / btcPrice) * UNIT_TO_BTC_RATE : 0;
    const swapPerClaimBtc = requiredSwapBtc / claimAmountBtc;

    const walletCostForClaim = (claimBtc: number): number => {
      const walletDepositBtc = Math.max(0, claimBtc - collateralRemaining);
      return walletDepositBtc + claimBtc * swapPerClaimBtc;
    };

    let claimPortion = maxClaimForVault;
    if (walletCostForClaim(claimPortion) > walletBtcAvailable) {
      const collateralOnlySwapCost = collateralRemaining * swapPerClaimBtc;
      if (walletBtcAvailable <= collateralOnlySwapCost) {
        claimPortion = swapPerClaimBtc > 0
          ? walletBtcAvailable / swapPerClaimBtc
          : Math.min(maxClaimForVault, collateralRemaining);
      } else {
        claimPortion = (walletBtcAvailable + collateralRemaining) / (1 + swapPerClaimBtc);
      }
    }

    claimPortion = Math.min(maxClaimForVault, Math.max(0, roundNumberDown(claimPortion)));
    if (claimPortion <= DUST_BTC) {
      vaultCount--;
      feesBtc = vaultCount > 0 ? satsToBtc(getOpCostRepo(feeRate, vaultCount)) : 0;
      break;
    }

    const portionRate = claimPortion / claimAmountBtc;
    const swapPortion = roundNumberDown(portionRate * requiredSwapBtc, 8);
    const unitPortion = portionRate * unit;
    const collateralUsed = Math.min(collateralRemaining, claimPortion);
    const walletDepositBtc = claimPortion - collateralUsed;

    collateralRemaining -= collateralUsed;
    walletCostBtc += walletDepositBtc + swapPortion;
    maxClaimAmountBtc += claimPortion;
    maxSwapBtc += swapPortion;
    maxSwapUnit += unitPortion;
    lastPortionRate = portionRate;

    // The liquidation slider selects claim BTC. Swap and fee costs are shown on review.
    maxInvestBtc = maxClaimAmountBtc;
  }

  return {
    maxInvestBtc: Number(maxInvestBtc.toFixed(8)),
    maxClaimAmountBtc: Number(maxClaimAmountBtc.toFixed(8)),
    maxSwapBtc: Number(maxSwapBtc.toFixed(8)),
    maxSwapUnit: Number(maxSwapUnit.toFixed(2)),
    maxVaultCount: vaultCount,
    lastPortionRate: Number(lastPortionRate.toFixed(4)),
  };
}

/**
 * Map an investment amount to claim/swap distribution across vaults.
 */
export function computeClaimFromInvest(
  isAutoSwap: boolean,
  investAmount: number,
  liquidationData: LiquidVaultProfileWithMeta[],
  feeRate: number
): ClaimFromInvestResult {
  let claimAmountBtcSelected = 0;
  let investRemaining = investAmount;
  let opcost = 0;
  let vaultCount = 0;

  for (const vaultProfile of liquidationData) {
    if (investRemaining <= DUST_BTC) break;

    vaultCount++;
    opcost = getOpCostRepo(feeRate, vaultCount);
    const investAfterFees = investRemaining - satsToBtc(opcost);

    const { claimAmountBtc, unitSwapBtc } = vaultProfile;
    const swapRequired = isAutoSwap ? unitSwapBtc : 0;
    const investRequired = claimAmountBtc + swapRequired;

    if (investAfterFees > investRequired) {
      claimAmountBtcSelected += claimAmountBtc;
      investRemaining -= investRequired;
    } else {
      const claimPortionRate = claimAmountBtc / (claimAmountBtc + swapRequired);
      claimAmountBtcSelected += investAfterFees * claimPortionRate;
      investRemaining = 0;
    }
  }

  return {
    claimAmountBtcSelected,
    swapAmountBtcSelected: investAmount - claimAmountBtcSelected,
    feeSats: opcost,
    vaultCount,
  };
}

/**
 * Calculate transaction fee for a repo operation.
 */
export function getOpCostRepo(feeRate: number, vaultCount: number): number {
  if (vaultCount === 0) return 0;

  const vinAllowanceSats = VIN_ALLOWANCE * feeRate;

  try {
    const txQuote = VaultAPI.repo.get_tx_quote(
      { deposit_amount: 0, tx_feerate: feeRate } as Parameters<typeof VaultAPI.repo.get_tx_quote>[0],
      vaultCount
    );
    return txQuote.total_cost + vinAllowanceSats;
  } catch {
    // Fallback: estimate ~250 vbytes per vault at feeRate
    return (250 * vaultCount * feeRate) + vinAllowanceSats;
  }
}

// ============================================================
// Aggregation Functions
// ============================================================

/** Total claim BTC across selected vaults */
export function getTotalClaimBtc(data: LiquidVaultProfileWithMeta[]): number {
  return data.reduce((acc, item) => acc + (item.claimAmountPartial || item.claimAmountBtc), 0);
}

/** Total estimated profit across selected vaults (handles partial) */
export function getTotalEstimatedProfit(data: LiquidVaultProfileWithMeta[]): number {
  return data.reduce((acc, item) => {
    if (item.claimAmountPartial) {
      const part = item.claimAmountPartial / item.claimAmountBtc;
      return acc + item.profitBtc * part;
    }
    return acc + item.profitBtc;
  }, 0);
}

/** Total claimed debt units (handles partial) */
export function getClaimedDebtUnits(data: LiquidVaultProfileWithMeta[]): number {
  return data.reduce((acc, item) => {
    if (item.claimAmountPartial) {
      const part = item.claimAmountPartial / item.claimAmountBtc;
      return acc + item.unit * part;
    }
    return acc + item.unit;
  }, 0);
}

/** Weighted average profit percentage */
export function getEstimatedProfitAveragePercent(data: LiquidVaultProfileWithMeta[]): number {
  if (!data?.length) return 0;

  const { weightedSum, weightTotal } = data.reduce(
    (acc, item) => {
      const weight = Number(item.claimAmountPartial || item.claimAmountBtc) || 0;
      const percent = Number(item.profitPercent) || 0;
      acc.weightedSum += percent * weight;
      acc.weightTotal += weight;
      return acc;
    },
    { weightedSum: 0, weightTotal: 0 }
  );

  const avg = weightedSum / weightTotal;
  return Number.isFinite(avg) ? avg : 0;
}

/** Combined yield (profit BTC + average %) */
export function getEstimatedYield(selected: LiquidVaultProfileWithMeta[]): EstimatedYield {
  return {
    btc: getTotalEstimatedProfit(selected),
    percent: getEstimatedProfitAveragePercent(selected),
  };
}

/** Selection stats for health-after-liquidation */
export function getSelectionStats(claimed: LiquidVaultProfileWithMeta[]): SelectionStats {
  return claimed.reduce(
    (acc, item) => {
      const portion = item.claimAmountPartial
        ? item.claimAmountPartial / item.claimAmountBtc
        : 1;
      acc.totalClaimBtc += item.claimAmountPartial || item.claimAmountBtc;
      acc.totalClaimedBtc += item.postTaxBtcInVault * portion;
      acc.totalClaimedUnit += item.unit * portion;
      return acc;
    },
    { totalClaimBtc: 0, totalClaimedBtc: 0, totalClaimedUnit: 0 }
  );
}

// ============================================================
// Post-Liquidation Health Prediction
// ============================================================

/**
 * Predict vault health after performing a liquidation.
 */
export function getHealthAfterLiquidation(params: {
  btcPrice: number;
  btcInVault: number;
  unitInVault: number;
  claimedVaults: LiquidVaultProfileWithMeta[];
}): HealthAfterLiquidation {
  const { btcPrice, btcInVault, unitInVault, claimedVaults } = params;
  const { totalClaimBtc, totalClaimedBtc, totalClaimedUnit } = getSelectionStats(claimedVaults);

  const finalDepositAmount = totalClaimedBtc + totalClaimBtc;
  const finalVaultCollateral = btcInVault + finalDepositAmount;
  const finalUnitDebt = unitInVault + totalClaimedUnit;
  const finalAssetValueBtc = finalVaultCollateral - finalUnitDebt / btcPrice;
  const rawHealth = getHealthValue(btcPrice, finalVaultCollateral, finalUnitDebt);

  return {
    finalDepositAmount,
    finalVaultCollateral,
    finalUnitDebt,
    finalHealthValue: rawHealth < 160 ? 160 : rawHealth,
    finalAssetValueBtc,
  };
}
