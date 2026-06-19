/**
 * Liquidation Calculations
 *
 * Core calculation logic ported from the web frontend.
 * Uses the @ducat-unit/client-sdk for liquidation economics
 * and wraps with vault selection + aggregation logic.
 */

import { VaultAPI } from '@ducat-unit/client-sdk';
import type { LiquidVaultProfile, PriceContract, ProtocolProfile, VaultProfile } from '@ducat-unit/client-sdk';
import { SIGCOUNT, TXSIZE } from '@ducat-unit/client-sdk/const';
import {
  get_effective_vsize,
  get_liquid_reserve_output_size,
  get_vault_liquidation_total_size,
  get_vault_return_size,
  get_vault_spend_witness_vsize,
} from '@ducat-unit/client-sdk/lib';
import {
  get_liquidation_quote,
  get_liquid_vault_profiles,
  get_partial_liquidation_quote,
} from '@ducat-unit/core/lib';
import type { VaultProfile as CoreVaultProfile } from '@ducat-unit/core';
import { logger } from '../../utils/logger';
import { fetchProtocolContract } from '../vaultWallet';
import {
  COIN_SIZE,
  DUST_BTC,
  MIN_COL_RATE,
  MIN_REPO_PORTION,
  REPO_PORTION_PRECISION,
  UNIT_TO_BTC_RATE,
  VIN_ALLOWANCE,
} from './constants';
import { formatValidatorResponse } from './fetchVaults';
import { roundNumber, roundNumberDown, satsToBtc } from './math';
import type {
  ValidatorLiquidatedVault,
  LiquidationVaultComputedData,
  LiquidVaultProfileWithMeta,
  ExtendedVaultProfile,
  LiquidationInvestStats,
  ClaimFromInvestResult,
  EstimatedYield,
  HealthAfterLiquidation,
  SelectionStats,
} from './types';

const ESTIMATED_REPO_GUARDIAN_COUNT = 1;
const ESTIMATED_REPO_ORACLE_COUNT = 1;
const ESTIMATED_REPO_UNIT_BALANCE = 1;
const ESTIMATED_REPO_RESERVE_BALANCE = 1;
const HEX_32_BYTE_PATTERN = /^[0-9a-f]{64}$/i;

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
  const legacyQuote = (profile as LiquidVaultProfile & {
    liquid_quote?: {
      sats_balance: number;
      taxable_sats: number;
      unit_balance: number;
      coin_price: number;
      subsidy_rate: number;
      deficit_sats: number;
      profit_margin: number;
    };
  }).liquid_quote;

  if (!legacyQuote) {
    const postTaxBtcInVault = profile.reward_sats / COIN_SIZE;
    const claimAmountBtc = profile.deficit_sats > 0 ? profile.deficit_sats / COIN_SIZE : 0;
    const unitSwapBtc = profile.liquid_price > 0
      ? (profile.claimed_unit / 100) / profile.liquid_price
      : 0;
    const profitBtc = Math.max(0, postTaxBtcInVault - unitSwapBtc);
    const profitMargin = claimAmountBtc > 0 ? profitBtc / claimAmountBtc : 0;

    return {
      postTaxBtcInVault,
      claimAmountBtc,
      profitBtc,
      profitPercent: Math.abs(roundNumber(profitMargin * 100)),
      profitPercentPrecised: Math.abs(roundNumber(profitMargin * 100)),
      liquidationTaxRebatePercent: roundNumber(profile.subsidy_rate * 100, 2),
    };
  }

  const {
    sats_balance,
    taxable_sats,
    unit_balance,
    coin_price,
    subsidy_rate,
    deficit_sats,
    profit_margin,
  } = legacyQuote;

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

function firstOraclePubkey(contract: ProtocolProfile): string {
  return contract.proto_members?.find((member) => member.group === 22)?.pubkey
    ?? contract.proto_members?.[0]?.pubkey
    ?? '';
}

function normalizeVaultActionLabel(action: string): VaultProfile['vault_action'] {
  const normalized = action.trim().toLowerCase();
  const map: Record<string, VaultProfile['vault_action']> = {
    o: 'open',
    b: 'borrow',
    r: 'repay',
    d: 'deposit',
    w: 'withdraw',
    l: 'repo',
    x: 'close',
    liquidation: 'repo',
    liquidate: 'liquidate',
    repo: 'repo',
    open: 'open',
    borrow: 'borrow',
    repay: 'repay',
    deposit: 'deposit',
    withdraw: 'withdraw',
    close: 'close',
  };
  return map[normalized] ?? 'open';
}

function legacyVaultToLatestProfile(
  vault: ExtendedVaultProfile,
  contract: ProtocolProfile
): VaultProfile {
  return {
    coin_id: `${vault.utxo.txid}:${vault.utxo.vout}`,
    client_pubkey: vault.vault_pk,
    contract_id: contract.contract_id,
    guard_members: [vault.guard_pk].filter(Boolean),
    guard_pubkey: vault.guard_pk,
    price_commits: vault.rdata.thold_hash ? [{
      base_price: vault.rdata.unit_price,
      oracle_pubkey: firstOraclePubkey(contract),
      oracle_sig: '',
      thold_hash: vault.rdata.thold_hash,
      thold_price: vault.rdata.thold_price,
    }] : [],
    price_stamp: vault.rdata.unit_stamp,
    root_txid: vault.utxo.txid,
    thold_price: vault.rdata.thold_price,
    unit_balance: vault.rdata.unit_balance,
    unit_price: vault.rdata.unit_price,
    vault_action: normalizeVaultActionLabel(vault.rdata.vault_action),
    vault_balance: vault.utxo.value,
    vault_config: null,
    vault_ratio: null,
    vault_script: vault.utxo.script,
    vault_value: vault.utxo.value,
    vault_version: 3,
  };
}

function getLatestVaultProfile(
  rawVault: ValidatorLiquidatedVault,
  extended: ExtendedVaultProfile,
  contract: ProtocolProfile
): VaultProfile {
  return rawVault.latest_profile ?? legacyVaultToLatestProfile(extended, contract);
}

function liquidationSortScore(profile: LiquidVaultProfileWithMeta): number {
  const legacyQuote = (profile as LiquidVaultProfileWithMeta & {
    liquid_quote?: { profit_margin?: number };
  }).liquid_quote;

  return legacyQuote?.profit_margin ?? profile.profitPercent;
}

function hasLatestProtoShape(contract: unknown): contract is ProtocolProfile {
  const proto = contract as Partial<ProtocolProfile> | null;
  return Boolean(
    proto
      && Array.isArray(proto.proto_members)
      && Array.isArray(proto.proto_terms)
      && typeof proto.contract_id === 'string'
  );
}

function computeLegacyLiquidVaultProfiles(
  rawVaults: ValidatorLiquidatedVault[],
  btcPrice: number,
  contract: unknown
): LiquidVaultProfileWithMeta[] {
  const extendedProfiles = formatValidatorResponse(rawVaults);
  const results: LiquidVaultProfileWithMeta[] = [];

  for (const v of extendedProfiles) {
    const collateralRatio = getHealthValue(btcPrice, v.btcInVault - 0.0001, v.unit) / 100;

    if (collateralRatio <= 0) continue;

    try {
      const liquidProfile = VaultAPI.repo.liquidation.get_profile(
        contract,
        v,
        v.thold_key,
        btcPrice
      ) as LiquidVaultProfile;

      const meta = computeLiqMeta(liquidProfile);
      const unitSwapBtc = v.unit / btcPrice;

      if (meta.profitBtc > 0 && meta.claimAmountBtc > DUST_BTC) {
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
    .sort((a, b) => liquidationSortScore(b) - liquidationSortScore(a))
    .slice(0, 300);
}

// ============================================================
// Partial Vault Recomputation
// ============================================================

function floorToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.floor((value + Number.EPSILON * 100) * factor) / factor;
}

export function getPartialRepoPortion(
  partialClaimBtc: number | undefined,
  fullClaimBtc: number
): number {
  if (!partialClaimBtc || fullClaimBtc <= 0) {
    return 1;
  }

  const portion = floorToPrecision(partialClaimBtc / fullClaimBtc, REPO_PORTION_PRECISION);
  return Math.min(1, Math.max(0, portion));
}

function normalizePartialClaimForRepo(
  partialClaimBtc: number,
  fullClaimBtc: number
): { claimAmountBtc: number; repoPortion: number } | null {
  if (partialClaimBtc <= DUST_BTC + Number.EPSILON * 100 || fullClaimBtc <= 0) {
    return null;
  }

  const repoPortion = getPartialRepoPortion(partialClaimBtc, fullClaimBtc);
  if (repoPortion < MIN_REPO_PORTION || repoPortion >= 1) {
    return null;
  }

  return {
    claimAmountBtc: Number((fullClaimBtc * repoPortion).toFixed(8)),
    repoPortion,
  };
}

function getLiquidationProfilePrice(
  profile: LiquidVaultProfileWithMeta,
  fallbackBtcPrice: number
): number {
  const profilePrice = Number((profile as LiquidVaultProfile).liquid_price);
  return Number.isFinite(profilePrice) && profilePrice > 0
    ? profilePrice
    : fallbackBtcPrice;
}

/**
 * Re-compute a partial vault profile with its repo_portion applied.
 * Used when a vault is only partially claimed (last vault in a selection).
 */
export async function recomputePartialVaultProfile(
  claimedPartial: LiquidVaultProfileWithMeta,
  btcPrice: number,
): Promise<LiquidVaultProfileWithMeta> {
  const normalized = normalizePartialClaimForRepo(
    claimedPartial.claimAmountPartial ?? 0,
    claimedPartial.claimAmountBtc
  );
  if (!normalized) {
    throw new Error('Partial liquidation amount is below the minimum protocol claim size');
  }

  const liquidationPrice = getLiquidationProfilePrice(claimedPartial, btcPrice);
  const contract = await fetchProtocolContract();
  const legacyQuote = (claimedPartial as LiquidVaultProfileWithMeta & {
    liquid_quote?: unknown;
  }).liquid_quote;
  if (legacyQuote) {
    const partialProfile = VaultAPI.repo.liquidation.get_profile(
      contract,
      claimedPartial,
      claimedPartial.thold_key,
      liquidationPrice,
      normalized.repoPortion
    ) as LiquidVaultProfile;
    const partialMeta = computeLiqMeta(partialProfile);
    const partialUnit = ((partialProfile as LiquidVaultProfile & {
      liquid_quote?: { unit_balance?: number };
    }).liquid_quote?.unit_balance ?? partialProfile.claimed_unit ?? 0) / 100;

    return {
      ...claimedPartial,
      ...partialProfile,
      ...partialMeta,
      unit: partialUnit,
      unitSwapBtc: liquidationPrice > 0 ? partialUnit / liquidationPrice : 0,
      claimAmountPartial: partialMeta.claimAmountBtc,
      claimAmountDiff: Number(
        Math.max(0, claimedPartial.claimAmountBtc - partialMeta.claimAmountBtc).toFixed(8)
      ),
    } as LiquidVaultProfileWithMeta;
  }

  const partialQuote = get_partial_liquidation_quote(
    contract,
    claimedPartial as Required<Pick<LiquidVaultProfile, 'claimed_sats' | 'claimed_unit' | 'deficit_ratio' | 'deficit_sats' | 'reserve_rate' | 'reserve_sats' | 'reward_ratio' | 'reward_sats' | 'subsidy_multi' | 'subsidy_rate'>>,
    Math.ceil(normalized.claimAmountBtc * COIN_SIZE),
    liquidationPrice
  );
  const partialProfile: LiquidVaultProfile = {
    ...claimedPartial,
    ...partialQuote,
  };
  const partialMeta = computeLiqMeta(partialProfile);
  const partialUnit = partialProfile.claimed_unit / 100;

  return {
    ...claimedPartial,
    ...partialProfile,
    ...partialMeta,
    unit: partialUnit,
    unitSwapBtc: liquidationPrice > 0 ? partialUnit / liquidationPrice : 0,
    claimAmountPartial: partialMeta.claimAmountBtc,
    claimAmountDiff: Number(
      Math.max(0, claimedPartial.claimAmountBtc - partialMeta.claimAmountBtc).toFixed(8)
    ),
  } as LiquidVaultProfileWithMeta;
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
  contract: ProtocolProfile | unknown,
  breachContracts: PriceContract[] = []
): LiquidVaultProfileWithMeta[] {
  if (!hasLatestProtoShape(contract)) {
    return computeLegacyLiquidVaultProfiles(rawVaults, btcPrice, contract);
  }

  const proto = contract as ProtocolProfile;
  const extendedProfiles = formatValidatorResponse(rawVaults);
  const results: LiquidVaultProfileWithMeta[] = [];
  const latestProfiles = extendedProfiles.map((extended, index) =>
    getLatestVaultProfile(rawVaults[index] as ValidatorLiquidatedVault, extended, proto)
  );
  const breachedContracts = breachContracts.filter((contract): contract is PriceContract & { thold_key: string } =>
    typeof contract.thold_key === 'string' && contract.thold_key.length > 0
  );
  const liquidProfiles = get_liquid_vault_profiles({
    breach_contracts: breachedContracts,
    liquid_price: btcPrice,
    proto_profile: proto,
  }, latestProfiles as CoreVaultProfile[]);
  const liquidByRoot = new Map(liquidProfiles.map((profile) => [profile.root_txid, profile]));
  let missingLiquidKeyCount = 0;

  for (const [index, v] of extendedProfiles.entries()) {
    const collateralRatio = getHealthValue(btcPrice, v.btcInVault - 0.0001, v.unit) / 100;

    if (collateralRatio <= 0) continue;

    try {
      const latestProfile = latestProfiles[index];
      if (typeof latestProfile.root_txid !== 'string' || latestProfile.root_txid.length === 0) {
        missingLiquidKeyCount += 1;
        continue;
      }
      const liquidProfile = liquidByRoot.get(latestProfile.root_txid);
      if (!liquidProfile || !HEX_32_BYTE_PATTERN.test(liquidProfile.liquid_key)) {
        missingLiquidKeyCount += 1;
        continue;
      }

      const meta = computeLiqMeta(liquidProfile);
      const unit = liquidProfile.claimed_unit / 100;
      const unitSwapBtc = unit / btcPrice;

      if (meta.profitBtc > 0 && meta.claimAmountBtc > DUST_BTC) {
        results.push({
          ...v,
          ...liquidProfile,
          ...meta,
          thold_key: liquidProfile.liquid_key,
          unit,
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

  if (missingLiquidKeyCount > 0) {
    logger.debug('[Liquidation] Skipped vaults without revealed liquid key', {
      count: missingLiquidKeyCount,
      breachedContractCount: breachedContracts.length,
    });
  }

  return results
    .sort((a, b) => liquidationSortScore(b) - liquidationSortScore(a))
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
    if (item.claimAmountBtc <= DUST_BTC) continue;

    const sumWithItem = sum + item.claimAmountBtc;

    if (sumWithItem > amount) {
      const partialClaim = item.claimAmountBtc - (sumWithItem - amount);
      const normalized = normalizePartialClaimForRepo(partialClaim, item.claimAmountBtc);
      if (!normalized) {
        break;
      }
      const claimAmountDiff = item.claimAmountBtc - normalized.claimAmountBtc;
      result.push({
        ...item,
        claimAmountDiff,
        claimAmountPartial: normalized.claimAmountBtc,
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

    const { claimAmountBtc, unit } = vaultProfile;
    if (claimAmountBtc <= DUST_BTC) continue;

    const capRemaining = investCap ? Math.max(0, investCap - maxClaimAmountBtc) : claimAmountBtc;
    const maxClaimForVault = Math.min(claimAmountBtc, capRemaining);
    if (maxClaimForVault <= DUST_BTC) break;

    vaultCount++;
    const opcost = getOpCostRepo(feeRate, vaultCount);
    feesBtc = satsToBtc(opcost);
    const walletBtcAvailable = walletBtc - feesBtc - walletCostBtc;
    if (walletBtcAvailable <= DUST_BTC) {
      vaultCount--;
      feesBtc = vaultCount > 0 ? satsToBtc(getOpCostRepo(feeRate, vaultCount)) : 0;
      break;
    }

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
  const txVsize =
    TXSIZE.VAULT_UPDATE_TX_BASE_SIZE
    + get_vault_spend_witness_vsize(ESTIMATED_REPO_GUARDIAN_COUNT, ESTIMATED_REPO_ORACLE_COUNT)
    + get_vault_liquidation_total_size(
      ESTIMATED_REPO_GUARDIAN_COUNT,
      ESTIMATED_REPO_ORACLE_COUNT,
      vaultCount
    )
    + get_liquid_reserve_output_size(ESTIMATED_REPO_RESERVE_BALANCE)
    + get_vault_return_size(
      ESTIMATED_REPO_GUARDIAN_COUNT,
      ESTIMATED_REPO_ORACLE_COUNT,
      ESTIMATED_REPO_UNIT_BALANCE
    );
  const txFeeSats = Math.ceil(
    get_effective_vsize({
      tx_vsize: txVsize,
      sigops_count: SIGCOUNT.VAULT_REPO + vaultCount,
    }) * feeRate
  );

  return txFeeSats + vinAllowanceSats;
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
    finalHealthValue: rawHealth,
    finalAssetValueBtc,
  };
}
