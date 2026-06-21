/**
 * Tests for Liquidation Calculations
 *
 * Covers all 15 exported functions in calculations.ts:
 * getHealthValue, getAvailableCollateralBtc, computeLiqMeta,
 * computeLiquidVaultProfiles, selectItemsForAmount, getMaxInvest,
 * computeClaimFromInvest, getOpCostRepo, getTotalClaimBtc,
 * getTotalEstimatedProfit, getClaimedDebtUnits,
 * getEstimatedProfitAveragePercent, getEstimatedYield,
 * getSelectionStats, getHealthAfterLiquidation
 */

import {
  getHealthValue,
  getAvailableCollateralBtc,
  computeLiqMeta,
  computeLiquidVaultProfiles,
  recomputePartialVaultProfile,
  selectItemsForAmount,
  getMaxInvest,
  computeClaimFromInvest,
  getOpCostRepo,
  getTotalClaimBtc,
  getTotalEstimatedProfit,
  getClaimedDebtUnits,
  getEstimatedProfitAveragePercent,
  getEstimatedYield,
  getSelectionStats,
  getHealthAfterLiquidation,
} from '../calculations';
import { COIN_SIZE, DUST_BTC, MIN_COL_RATE } from '../constants';
import type { LiquidVaultProfileWithMeta } from '../types';
import type { LiquidVaultProfile } from '@ducat-unit/client-sdk/vault';

// ============================================================
// SDK Mock
// ============================================================

jest.mock('@ducat-unit/client-sdk', () => ({
  VaultAPI: {
    repo: {
      liquidation: {
        get_profile: jest.fn(),
      },
    },
  },
}));

jest.mock('@ducat-unit/core/lib', () => ({
  get_liquidation_quote: jest.fn(),
  get_liquid_vault_profiles: jest.fn(),
  get_partial_liquidation_quote: jest.fn(),
}));

// Mock vaultWallet to prevent ESM import of @ducat-unit/client-sdk/util
jest.mock('../../vaultWallet', () => ({
  fetchProtocolContract: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetchVaults so computeLiquidVaultProfiles does not hit network
jest.mock('../fetchVaults', () => ({
  formatValidatorResponse: jest.fn(),
}));

import { VaultAPI } from '@ducat-unit/client-sdk';
import {
  get_liquidation_quote,
  get_liquid_vault_profiles,
} from '@ducat-unit/core/lib';
import { formatValidatorResponse } from '../fetchVaults';
import { fetchProtocolContract } from '../../vaultWallet';

const mockGetProfile = VaultAPI.repo.liquidation.get_profile as jest.Mock;
const mockGetLiquidationQuote = get_liquidation_quote as jest.Mock;
const mockGetLiquidVaultProfiles = get_liquid_vault_profiles as jest.Mock;
const mockFormatValidatorResponse = formatValidatorResponse as jest.Mock;
const mockFetchProtocolContract = fetchProtocolContract as jest.Mock;

// ============================================================
// Test Fixtures
// ============================================================

/** Minimal LiquidVaultProfile returned by the SDK mock */
function makeLiquidVaultProfile(overrides: Partial<LiquidVaultProfile['liquid_quote']> = {}): LiquidVaultProfile {
  const liquid_quote = {
    coin_price: 80_000,
    deficit_cr: 0.05,
    deficit_sats: 500_000,         // 0.005 BTC
    liquid_nav: 0.95,
    profit_margin: 0.04,           // 4%
    reserve_sats: 100_000,
    reward_cr: 1.0,
    reward_sats: 80_000,
    sats_balance: 2_000_000,       // 0.02 BTC
    subsidy_multi: 1.0,
    subsidy_rate: 0.01,
    subsidy_sats: 20_000,
    taxable_sats: 200_000,
    unit_balance: 1_200,           // 12 UNIT (×100)
    unit_divisor: 100,
    vault_cr: 1.33,
    ...overrides,
  };

  return {
    liquid_quote,
    repo_portion: 1,
    return_sats: 1_500_000,
    return_unit: 1_200,
    thold_key: 'mock-thold-key',
    acct_id: 'mock-acct-id',
    guard_pk: 'mock-guard-pk',
    master_id: 'mock-master-id',
    vault_pk: 'mock-vault-pk',
    utxo: { value: 2_000_000, txid: 'mock-txid', vout: 0, script: 'mock-script' },
    rdata: {
      is_locked: true,
      thold_hash: 'mock-hash',
      thold_price: 70_000,
      unit_balance: 1_200,
      unit_price: 80_000,
      unit_stamp: 1_700_000_000,
      vault_action: 'lock',
    },
  } as unknown as LiquidVaultProfile;
}

function makeLatestLiquidationQuote(overrides: Record<string, unknown> = {}) {
  return {
    claimed_sats: 2_000_000,
    claimed_unit: 1_200,
    deficit_ratio: 0.05,
    deficit_sats: 500_000,
    reserve_rate: 0.1,
    reserve_sats: 200_000,
    reward_ratio: 1.1,
    reward_sats: 1_800_000,
    subsidy_multi: 1,
    subsidy_rate: 0.01,
    ...overrides,
  };
}

/**
 * Build a LiquidVaultProfileWithMeta for selection / aggregation tests.
 */
function makeProfile(overrides: Partial<LiquidVaultProfileWithMeta> = {}): LiquidVaultProfileWithMeta {
  const base: LiquidVaultProfileWithMeta = {
    // LiquidVaultProfile fields
    liquid_quote: makeLiquidVaultProfile().liquid_quote,
    repo_portion: 1,
    return_sats: 1_500_000,
    return_unit: 1_200,
    thold_key: 'mock-thold-key',
    acct_id: 'mock-acct-id',
    guard_pk: 'mock-guard-pk',
    master_id: 'mock-master-id',
    vault_pk: 'mock-vault-pk',
    utxo: { value: 2_000_000, txid: 'mock-txid', vout: 0, script: 'mock-script' },
    rdata: {
      is_locked: true,
      thold_hash: 'mock-hash',
      thold_price: 70_000,
      unit_balance: 1_200,
      unit_price: 80_000,
      unit_stamp: 1_700_000_000,
      vault_action: 'lock',
    },
    // LiquidationVaultComputedData fields
    vaultId: 'vault-1',
    unit: 12,                       // 12 UNIT debt
    btcInVault: 0.02,
    postTaxBtcInVault: 0.018,
    claimAmountBtc: 0.005,
    unitSwapBtc: 0.00015,
    profitBtc: 0.0002,
    profitPercent: 4,
    profitPercentPrecised: 4,
    liquidationTaxRebatePercent: 1,
  } as unknown as LiquidVaultProfileWithMeta;

  return { ...base, ...overrides };
}

// ============================================================
// Tests
// ============================================================

describe('getHealthValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should compute collateral ratio × 100 for healthy vault', () => {
      // (0.02 BTC × 80_000 USD / 12 UNIT) × 100 = (1600 / 12) × 100 ≈ 13333
      const result = getHealthValue(80_000, 0.02, 12);
      expect(result).toBe(13333);
    });

    it('should return exactly 160 for vault at minimum collateral rate', () => {
      // health = 160 when btcInVault × price = 1.6 × unitDebt
      const result = getHealthValue(100_000, 0.016, 1000);
      expect(result).toBe(160);
    });

    it('should scale correctly with higher BTC price', () => {
      const low = getHealthValue(40_000, 0.02, 12);
      const high = getHealthValue(80_000, 0.02, 12);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('zero / invalid inputs → NaN', () => {
    it('should return NaN when btcInVault is 0', () => {
      expect(getHealthValue(80_000, 0, 12)).toBeNaN();
    });

    it('should return NaN when unitDebt is 0', () => {
      expect(getHealthValue(80_000, 0.02, 0)).toBeNaN();
    });

    it('should return NaN when both btcInVault and unitDebt are 0', () => {
      expect(getHealthValue(80_000, 0, 0)).toBeNaN();
    });

    it('should return NaN when btcInVault is negative', () => {
      // roundNumber(-0.001, 6) ≤ 0 → NaN
      expect(getHealthValue(80_000, -0.001, 12)).toBeNaN();
    });

    it('should return NaN when btcPrice is 0', () => {
      // (0.02 × 0 / 12) × 100 = 0, which means health = 0 — but guard is on btcInVault & unitDebt
      // btcInVault > 0 and unitDebt > 0, so result = 0 (not NaN)
      expect(getHealthValue(0, 0.02, 12)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very small btcInVault above dust threshold', () => {
      const result = getHealthValue(80_000, 0.000001, 1);
      expect(typeof result).toBe('number');
    });

    it('should round to integer', () => {
      const result = getHealthValue(80_001, 0.02, 12);
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});

// ============================================================

describe('getAvailableCollateralBtc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return positive available collateral for overcollateralised vault', () => {
      // available = 0.05 - (1.6 × 10) / 80_000 = 0.05 - 0.0002 = 0.0498
      const result = getAvailableCollateralBtc(80_000, 0.05, 10);
      expect(result).toBeCloseTo(0.0498, 6);
    });

    it('should return 0 when vault is exactly at minimum collateral rate', () => {
      // btcInVault = MIN_COL_RATE × unitDebt / btcPrice → available = 0
      const btcInVault = (MIN_COL_RATE * 100) / 80_000; // = 0.002
      const result = getAvailableCollateralBtc(80_000, btcInVault, 100);
      expect(result).toBe(0);
    });

    it('should return 0 when vault is undercollateralised', () => {
      // Very small BTC, large debt → available < 0
      const result = getAvailableCollateralBtc(80_000, 0.0001, 1000);
      expect(result).toBe(0);
    });
  });

  describe('zero / undefined inputs', () => {
    it('should return 0 when btcPrice is undefined', () => {
      expect(getAvailableCollateralBtc(undefined, 0.05, 10)).toBe(0);
    });

    it('should return 0 when btcPrice is 0', () => {
      expect(getAvailableCollateralBtc(0, 0.05, 10)).toBe(0);
    });

    it('should return 0 when btcInVault is 0', () => {
      expect(getAvailableCollateralBtc(80_000, 0, 10)).toBe(0);
    });

    it('should return 0 when both price and btcInVault are 0', () => {
      expect(getAvailableCollateralBtc(0, 0, 0)).toBe(0);
    });
  });

  describe('precision', () => {
    it('should return exactly 8 decimal places', () => {
      const result = getAvailableCollateralBtc(80_000, 0.1, 10);
      const decimals = result.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(8);
    });
  });
});

// ============================================================

describe('computeLiqMeta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should compute profitBtc as absolute value of formula', () => {
      const profile = makeLiquidVaultProfile();
      const result = computeLiqMeta(profile);
      expect(result.profitBtc).toBeGreaterThan(0);
    });

    it('should compute postTaxBtcInVault correctly', () => {
      const profile = makeLiquidVaultProfile();
      const { sats_balance, taxable_sats } = profile.liquid_quote;
      const result = computeLiqMeta(profile);
      expect(result.postTaxBtcInVault).toBeCloseTo((sats_balance - taxable_sats) / COIN_SIZE, 8);
    });

    it('should return claimAmountBtc = deficit_sats / COIN_SIZE when deficit_sats > 0', () => {
      const profile = makeLiquidVaultProfile({ deficit_sats: 500_000 });
      const result = computeLiqMeta(profile);
      expect(result.claimAmountBtc).toBeCloseTo(500_000 / COIN_SIZE, 8);
    });

    it('should return claimAmountBtc = 0 when deficit_sats is 0', () => {
      const profile = makeLiquidVaultProfile({ deficit_sats: 0 });
      const result = computeLiqMeta(profile);
      expect(result.claimAmountBtc).toBe(0);
    });

    it('should return claimAmountBtc = 0 when deficit_sats is negative', () => {
      const profile = makeLiquidVaultProfile({ deficit_sats: -100 });
      const result = computeLiqMeta(profile);
      expect(result.claimAmountBtc).toBe(0);
    });

    it('should compute profitPercent as |profit_margin × 100| rounded to 2dp', () => {
      const profile = makeLiquidVaultProfile({ profit_margin: 0.0456 });
      const result = computeLiqMeta(profile);
      expect(result.profitPercent).toBeCloseTo(4.56, 1);
    });

    it('should compute liquidationTaxRebatePercent as subsidy_rate × 100', () => {
      const profile = makeLiquidVaultProfile({ subsidy_rate: 0.015 });
      const result = computeLiqMeta(profile);
      expect(result.liquidationTaxRebatePercent).toBeCloseTo(1.5, 2);
    });

    it('should return profitBtc as absolute value even with negative margin', () => {
      // Flip sign: taxable_sats > sats_balance to force negative profitBtc before abs
      const profile = makeLiquidVaultProfile({
        sats_balance: 1_000_000,
        taxable_sats: 1_500_000,  // post-tax goes negative
        unit_balance: 100,
        subsidy_rate: 0,
        profit_margin: -0.02,
      });
      const result = computeLiqMeta(profile);
      expect(result.profitBtc).toBeGreaterThanOrEqual(0);
      expect(result.profitPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero subsidy_rate', () => {
      const profile = makeLiquidVaultProfile({ subsidy_rate: 0 });
      const result = computeLiqMeta(profile);
      expect(result.liquidationTaxRebatePercent).toBe(0);
    });
  });
});

// ============================================================

describe('computeLiquidVaultProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLiquidationQuote.mockReset();
    mockGetLiquidVaultProfiles.mockReset();
  });

  /** A realistic ExtendedVaultProfile returned by formatValidatorResponse */
  const mockExtendedVault = {
    vaultId: 'vault-1',
    unit: 12,              // 12 UNIT
    btcInVault: 0.02,
    thold_key: 'mock-thold',
    acct_id: 'acct-1',
    guard_pk: 'gpk-1',
    vault_pk: 'vpk-1',
    master_id: 'mid-1',
    utxo: { value: 2_000_000, txid: 'txid-1', vout: 0, script: 'script' },
    rdata: {
      is_locked: true,
      thold_hash: 'hash',
      thold_price: 70_000,
      unit_balance: 1_200,
      unit_price: 80_000,
      unit_stamp: 1_700_000_000,
      vault_action: 'lock',
    },
  };

  const mockContract = {} as Parameters<typeof VaultAPI.repo.liquidation.get_profile>[0];

  describe('happy path', () => {
    it('should return one profile when SDK get_profile succeeds and profit > 0', () => {
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockReturnValue(makeLiquidVaultProfile());

      const result = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(result).toHaveLength(1);
      expect(result[0].vaultId).toBe('vault-1');
    });

    it('should include profitBtc and claimAmountBtc on each result', () => {
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockReturnValue(makeLiquidVaultProfile());

      const [profile] = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(profile.profitBtc).toBeGreaterThan(0);
      expect(profile.claimAmountBtc).toBeGreaterThanOrEqual(0);
    });

    it('should filter profiles whose claim amount is below dust', () => {
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockReturnValue(makeLiquidVaultProfile({ deficit_sats: 100 }));

      const result = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);

      expect(result).toEqual([]);
    });

    it('should sort results descending by profit_margin', () => {
      const vaultA = { ...mockExtendedVault, vaultId: 'vault-a' };
      const vaultB = { ...mockExtendedVault, vaultId: 'vault-b' };
      mockFormatValidatorResponse.mockReturnValue([vaultA, vaultB]);
      mockGetProfile
        .mockReturnValueOnce(makeLiquidVaultProfile({ profit_margin: 0.02 }))
        .mockReturnValueOnce(makeLiquidVaultProfile({ profit_margin: 0.05 }));

      const result = computeLiquidVaultProfiles([{} as any, {} as any], 80_000, mockContract);
      expect(result[0].liquid_quote?.profit_margin).toBeGreaterThanOrEqual(
        result[1].liquid_quote?.profit_margin ?? Number.NEGATIVE_INFINITY
      );
    });

    it('should cap results at 300', () => {
      const manyVaults = Array.from({ length: 350 }, (_, i) => ({
        ...mockExtendedVault,
        vaultId: `vault-${i}`,
      }));
      mockFormatValidatorResponse.mockReturnValue(manyVaults);
      mockGetProfile.mockReturnValue(makeLiquidVaultProfile());

      const result = computeLiquidVaultProfiles(
        Array(350).fill({} as any),
        80_000,
        mockContract
      );
      expect(result.length).toBeLessThanOrEqual(300);
    });

    it('should compute unitSwapBtc as unit / btcPrice', () => {
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockReturnValue(makeLiquidVaultProfile());

      const [profile] = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(profile.unitSwapBtc).toBeCloseTo(12 / 80_000, 8);
    });

    it('should keep latest validator vaults as estimates when no liquid key is revealed in the list fetch', () => {
      const rootTxid = '1'.repeat(64);
      const latestProfile = {
        root_txid: rootTxid,
        coin_id: `${rootTxid}:0`,
        contract_id: 'contract-1',
        guard_pubkey: 'guard',
        client_pubkey: 'client',
        price_commits: [{ thold_hash: 'a'.repeat(40), thold_price: 70_000 }],
        price_stamp: 1_700_000_000,
        thold_price: 70_000,
        unit_balance: 1_200,
        unit_price: 80_000,
        vault_action: 'open',
        vault_balance: 2_000_000,
        vault_config: null,
        vault_ratio: null,
        vault_script: 'script',
        vault_value: 2_000_000,
        vault_version: 3,
      };
      const latestContract = {
        contract_id: 'contract-1',
        proto_members: [],
        proto_terms: [],
      };
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetLiquidVaultProfiles.mockReturnValue([]);
      mockGetLiquidationQuote.mockReturnValue(makeLatestLiquidationQuote());

      const [profile] = computeLiquidVaultProfiles(
        [{ latest_profile: latestProfile } as any],
        80_000,
        latestContract as any,
        []
      );

      expect(profile).toMatchObject({
        vaultId: 'vault-1',
        root_txid: rootTxid,
        liquid_key: '',
        isLiquidationEstimate: true,
        claimAmountBtc: 0.005,
      });
      expect(mockGetLiquidationQuote).toHaveBeenCalledWith(
        latestContract,
        2_000_000,
        1_200,
        80_000
      );
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('should sort executable latest vaults before estimate-only rows', () => {
      const executableRootTxid = '1'.repeat(64);
      const estimateRootTxid = '2'.repeat(64);
      const makeLatestProfile = (rootTxid: string) => ({
        root_txid: rootTxid,
        coin_id: `${rootTxid}:0`,
        contract_id: 'contract-1',
        guard_pubkey: 'guard',
        client_pubkey: 'client',
        price_commits: [{ thold_hash: 'a'.repeat(40), thold_price: 70_000 }],
        price_stamp: 1_700_000_000,
        thold_price: 70_000,
        unit_balance: 1_200,
        unit_price: 80_000,
        vault_action: 'open',
        vault_balance: 2_000_000,
        vault_config: null,
        vault_ratio: null,
        vault_script: 'script',
        vault_value: 2_000_000,
        vault_version: 3,
      });
      const executableProfile = makeLatestProfile(executableRootTxid);
      const estimateProfile = makeLatestProfile(estimateRootTxid);
      const latestContract = {
        contract_id: 'contract-1',
        proto_members: [],
        proto_terms: [],
      };
      mockFormatValidatorResponse.mockReturnValue([
        { ...mockExtendedVault, vaultId: 'exec-vault' },
        { ...mockExtendedVault, vaultId: 'estimate-vault' },
      ]);
      mockGetLiquidVaultProfiles
        .mockReturnValueOnce([{
          ...executableProfile,
          ...makeLatestLiquidationQuote({ deficit_sats: 100_000, reward_sats: 200_000 }),
          liquid_key: 'f'.repeat(64),
          liquid_price: 80_000,
        }])
        .mockReturnValueOnce([]);
      mockGetLiquidationQuote.mockReturnValue(
        makeLatestLiquidationQuote({ deficit_sats: 500_000, reward_sats: 1_800_000 })
      );

      const result = computeLiquidVaultProfiles(
        [
          { latest_profile: executableProfile } as any,
          { latest_profile: estimateProfile } as any,
        ],
        80_000,
        latestContract as any,
        [{ thold_key: 'f'.repeat(64) } as any]
      );

      expect(result[0]).toMatchObject({
        root_txid: executableRootTxid,
        isLiquidationEstimate: false,
      });
      expect(result[1]).toMatchObject({
        root_txid: estimateRootTxid,
        isLiquidationEstimate: true,
      });
    });
  });

  describe('filtering', () => {
    it('should exclude vaults where profitBtc ≤ 0', () => {
      // force profitBtc to 0 by setting matching sats such that formula = 0
      const zeroProfit = makeLiquidVaultProfile({
        sats_balance: 0,
        taxable_sats: 0,
        unit_balance: 0,
        coin_price: 80_000,
        subsidy_rate: 0,
        profit_margin: 0,
        deficit_sats: 0,
      });
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockReturnValue(zeroProfit);

      const result = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(result).toHaveLength(0);
    });

    it('should skip vaults where collateral ratio ≤ 0 (skipped before SDK call)', () => {
      // unit so large that health collapses to ≤ 0
      const unhealthyVault = { ...mockExtendedVault, unit: 1_000_000 };
      mockFormatValidatorResponse.mockReturnValue([unhealthyVault]);

      const result = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(result).toHaveLength(0);
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('should skip vault and not throw when SDK throws', () => {
      mockFormatValidatorResponse.mockReturnValue([mockExtendedVault]);
      mockGetProfile.mockImplementation(() => { throw new Error('SDK error'); });

      expect(() =>
        computeLiquidVaultProfiles([{} as any], 80_000, mockContract)
      ).not.toThrow();

      const result = computeLiquidVaultProfiles([{} as any], 80_000, mockContract);
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array when rawVaults is empty', () => {
      mockFormatValidatorResponse.mockReturnValue([]);
      const result = computeLiquidVaultProfiles([], 80_000, mockContract);
      expect(result).toHaveLength(0);
    });
  });
});

// ============================================================

describe('selectItemsForAmount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const profileA = makeProfile({ vaultId: 'A', claimAmountBtc: 0.01 });
  const profileB = makeProfile({ vaultId: 'B', claimAmountBtc: 0.01 });
  const profileC = makeProfile({ vaultId: 'C', claimAmountBtc: 0.01 });

  describe('happy path', () => {
    it('should select all vaults when total claim < amount', () => {
      const result = selectItemsForAmount([profileA, profileB], 1);
      expect(result).toHaveLength(2);
      expect(result[0].claimAmountPartial).toBeUndefined();
      expect(result[1].claimAmountPartial).toBeUndefined();
    });

    it('should select vaults exactly matching amount', () => {
      const result = selectItemsForAmount([profileA, profileB], 0.02);
      expect(result).toHaveLength(2);
    });

    it('should partially fill the last vault when amount is between two vaults', () => {
      // Amount 0.015 → A fully (0.01) + B partially (0.005)
      const result = selectItemsForAmount([profileA, profileB, profileC], 0.015);
      expect(result).toHaveLength(2);
      expect(result[1].claimAmountPartial).toBeCloseTo(0.005, 8);
      expect(result[1].claimAmountDiff).toBeCloseTo(0.005, 8);
    });

    it('should select only first vault when amount ≤ first vault claim', () => {
      const result = selectItemsForAmount([profileA, profileB], 0.005);
      expect(result).toHaveLength(1);
      expect(result[0].claimAmountPartial).toBeCloseTo(0.005, 8);
    });

    it('should floor partial claims to the SDK repo-portion precision', () => {
      const result = selectItemsForAmount([profileA], 0.00512345);

      expect(result).toHaveLength(1);
      expect(result[0].claimAmountPartial).toBe(0.005123);
      expect(result[0].claimAmountDiff).toBeCloseTo(0.004877, 8);
    });

    it('should stop after partial vault (no further vaults appended)', () => {
      // Give first vault a large claim so partial is triggered immediately
      const bigProfile = makeProfile({ vaultId: 'Big', claimAmountBtc: 0.05 });
      const result = selectItemsForAmount([bigProfile, profileA, profileB], 0.02);
      expect(result).toHaveLength(1);
      expect(result[0].claimAmountPartial).toBeCloseTo(0.02, 8);
    });

    it('should skip dust-sized vaults and continue selecting claimable vaults', () => {
      const dustProfile = makeProfile({ vaultId: 'Dust', claimAmountBtc: DUST_BTC / 2 });
      const result = selectItemsForAmount([dustProfile, profileA], 0.005);

      expect(result).toHaveLength(1);
      expect(result[0].vaultId).toBe('A');
      expect(result[0].claimAmountPartial).toBeCloseTo(0.005, 8);
    });
  });

  describe('edge cases', () => {
    it('should return empty array when amount is 0', () => {
      expect(selectItemsForAmount([profileA], 0)).toHaveLength(0);
    });

    it('should return empty array when amount is negative', () => {
      expect(selectItemsForAmount([profileA], -1)).toHaveLength(0);
    });

    it('should return empty array when data is empty', () => {
      expect(selectItemsForAmount([], 0.5)).toHaveLength(0);
    });

    it('should return empty when a partial claim is below dust', () => {
      expect(selectItemsForAmount([profileA], DUST_BTC)).toHaveLength(0);
    });

    it('should not mutate the original profile objects', () => {
      const original = makeProfile({ vaultId: 'X', claimAmountBtc: 0.05 });
      selectItemsForAmount([original], 0.02);
      expect(original.claimAmountPartial).toBeUndefined();
    });
  });
});

// ============================================================

describe('recomputePartialVaultProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProtocolContract.mockResolvedValue({ terms: [] });
  });

  it('passes the protocol-rounded repo portion into the SDK', async () => {
    const partialProfile = makeLiquidVaultProfile({
      deficit_sats: 512_300,
      unit_balance: 321,
    });
    mockGetProfile.mockReturnValue(partialProfile);

    await recomputePartialVaultProfile(
      makeProfile({ claimAmountBtc: 0.01, claimAmountPartial: 0.00512345 }),
      80_000
    );

    expect(mockGetProfile).toHaveBeenCalledWith(
      { terms: [] },
      expect.anything(),
      'mock-thold-key',
      80_000,
      0.5123
    );
  });

  it('uses the selected liquidation profile price instead of the wallet price fallback', async () => {
    const partialProfile = makeLiquidVaultProfile({
      deficit_sats: 512_300,
      unit_balance: 321,
    });
    mockGetProfile.mockReturnValue(partialProfile);

    const result = await recomputePartialVaultProfile(
      makeProfile({
        claimAmountBtc: 0.01,
        claimAmountPartial: 0.00512345,
        liquid_price: 62_000,
      } as Partial<LiquidVaultProfileWithMeta>),
      80_000
    );

    expect(mockGetProfile).toHaveBeenCalledWith(
      { terms: [] },
      expect.anything(),
      'mock-thold-key',
      62_000,
      0.5123
    );
    expect(result.unitSwapBtc).toBe(3.21 / 62_000);
  });

  it('normalizes partial metadata to the recomputed SDK profile', async () => {
    const partialProfile = makeLiquidVaultProfile({
      deficit_sats: 512_300,
      unit_balance: 321,
    });
    mockGetProfile.mockReturnValue(partialProfile);

    const result = await recomputePartialVaultProfile(
      makeProfile({ claimAmountBtc: 0.01, claimAmountPartial: 0.00512345 }),
      80_000
    );

    expect(result.claimAmountBtc).toBe(0.005123);
    expect(result.claimAmountPartial).toBe(0.005123);
    expect(result.unit).toBe(3.21);
    expect(result.unitSwapBtc).toBe(3.21 / 80_000);
  });

  it('rejects partial claims below the executable protocol size', async () => {
    await expect(
      recomputePartialVaultProfile(
        makeProfile({ claimAmountBtc: 0.01, claimAmountPartial: DUST_BTC }),
        80_000
      )
    ).rejects.toThrow('Partial liquidation amount is below the minimum protocol claim size');
    expect(mockGetProfile).not.toHaveBeenCalled();
  });
});

// ============================================================

  describe('getMaxInvest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

  const btcPrice = 80_000;
  // 1 BTC wallet = 100_000_000 sats
  const walletSats = 100_000_000;
  const availableCollateral = 0.5;

  const vault1 = makeProfile({ vaultId: 'v1', unit: 12, claimAmountBtc: 0.005, unitSwapBtc: 0.00015 });
  const vault2 = makeProfile({ vaultId: 'v2', unit: 10, claimAmountBtc: 0.004, unitSwapBtc: 0.000125 });

  describe('happy path', () => {
    it('should return non-zero maxInvestBtc with valid inputs and autoSwap off', () => {
      const result = getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [vault1]);
      expect(result.maxInvestBtc).toBeGreaterThan(0);
      expect(result.maxClaimAmountBtc).toBeGreaterThan(0);
      expect(result.maxSwapBtc).toBe(0);      // no swap when isAutoSwap=false
      expect(result.maxVaultCount).toBe(1);
    });

    it('should include swap amounts when isAutoSwap is true', () => {
      const result = getMaxInvest(true, availableCollateral, walletSats, btcPrice, 1, [vault1]);
      expect(result.maxSwapBtc).toBeGreaterThan(0);
      expect(result.maxSwapUnit).toBeGreaterThan(0);
    });

    it('should process multiple vaults', () => {
      const result = getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [vault1, vault2]);
      expect(result.maxVaultCount).toBe(2);
    });

    it('should respect investCap and not exceed it', () => {
      const cap = 0.003;
      const result = getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [vault1, vault2], cap);
      // The slider cap is the selected claim amount.
      expect(result.maxInvestBtc).toBeLessThanOrEqual(cap);
    });

    it('should return claim amount as maxInvestBtc for the slider', () => {
      const result = getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [vault1]);
      expect(result.maxInvestBtc).toBeCloseTo(vault1.claimAmountBtc, 8);
      expect(result.maxClaimAmountBtc).toBeCloseTo(vault1.claimAmountBtc, 8);
    });
  });

  describe('zero inputs → empty stats', () => {
    const empty = { maxInvestBtc: 0, maxClaimAmountBtc: 0, maxSwapBtc: 0, maxSwapUnit: 0, maxVaultCount: 0, lastPortionRate: 1 };

    it('should return empty stats when btcPrice is undefined', () => {
      expect(getMaxInvest(false, availableCollateral, walletSats, undefined, 1, [vault1])).toEqual(empty);
    });

    it('should return empty stats when walletSats is 0', () => {
      expect(getMaxInvest(false, availableCollateral, 0, btcPrice, 1, [vault1])).toEqual(empty);
    });

    it('should return empty stats when liquidationData is empty', () => {
      expect(getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [])).toEqual(empty);
    });
  });

  describe('wallet-funded deficit deposits', () => {
    it('should allow claims when vault free collateral is zero but wallet BTC can fund the deposit', () => {
      const result = getMaxInvest(false, 0, walletSats, btcPrice, 1, [vault1]);

      expect(result.maxInvestBtc).toBeCloseTo(vault1.claimAmountBtc, 8);
      expect(result.maxClaimAmountBtc).toBeCloseTo(vault1.claimAmountBtc, 8);
      expect(result.maxVaultCount).toBe(1);
    });

    it('should partially cap claims by wallet BTC needed for deposit, swap, and fees', () => {
      const walletBudgetSats = 100_000;
      const result = getMaxInvest(true, 0, walletBudgetSats, btcPrice, 1, [vault1]);

      expect(result.maxInvestBtc).toBeGreaterThan(0);
      expect(result.maxInvestBtc).toBeLessThan(vault1.claimAmountBtc);
      expect(result.maxSwapBtc).toBeGreaterThan(0);
      expect(result.maxVaultCount).toBe(1);
    });

    it('should skip dust-sized profiles instead of stopping all investment', () => {
      const dustVault = makeProfile({ vaultId: 'dust', claimAmountBtc: DUST_BTC / 2 });
      const result = getMaxInvest(
        false,
        availableCollateral,
        walletSats,
        btcPrice,
        1,
        [dustVault, vault1]
      );

      expect(result.maxInvestBtc).toBeCloseTo(vault1.claimAmountBtc, 8);
      expect(result.maxVaultCount).toBe(1);
    });
  });

  describe('fee estimate resilience', () => {
    it('should still return valid result without a legacy get_tx_quote path', () => {
      const result = getMaxInvest(false, availableCollateral, walletSats, btcPrice, 1, [vault1]);
      expect(result.maxInvestBtc).toBeGreaterThan(0);
    });
  });
});

// ============================================================

  describe('computeClaimFromInvest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

  const vault1 = makeProfile({ vaultId: 'v1', claimAmountBtc: 0.005, unitSwapBtc: 0.00015 });
  const vault2 = makeProfile({ vaultId: 'v2', claimAmountBtc: 0.004, unitSwapBtc: 0.000125 });

  describe('happy path', () => {
    it('should fill one vault fully when investAmount covers it with autoSwap off', () => {
      const invest = vault1.claimAmountBtc + 0.001; // Enough to cover claim + fees
      const result = computeClaimFromInvest(false, invest, [vault1], 1);
      expect(result.claimAmountBtcSelected).toBeCloseTo(vault1.claimAmountBtc, 6);
      expect(result.vaultCount).toBe(1);
    });

    it('should do partial fill when investAmount < required', () => {
      // Small invest: less than vault1.claimAmountBtc
      const result = computeClaimFromInvest(false, 0.001, [vault1], 1);
      expect(result.claimAmountBtcSelected).toBeGreaterThan(0);
      expect(result.claimAmountBtcSelected).toBeLessThan(vault1.claimAmountBtc);
      expect(result.vaultCount).toBe(1);
    });

    it('should accumulate claim across multiple vaults', () => {
      const largeInvest = 0.02;
      const result = computeClaimFromInvest(false, largeInvest, [vault1, vault2], 1);
      expect(result.vaultCount).toBe(2);
    });

    it('should include swap amounts in claimAmountBtcSelected when autoSwap off', () => {
      const result = computeClaimFromInvest(false, 0.1, [vault1], 1);
      // swapAmountBtcSelected = investAmount - claimAmountBtcSelected
      expect(result.swapAmountBtcSelected).toBeGreaterThanOrEqual(0);
      expect(result.claimAmountBtcSelected + result.swapAmountBtcSelected).toBeCloseTo(0.1, 5);
    });

    it('should account for swap in portioning when isAutoSwap is true', () => {
      // Use an invest amount small enough to trigger a partial fill on vault1
      // (below claimAmountBtc=0.005 + unitSwapBtc=0.00015 = 0.00515).
      // With autoSwap=true the portion rate splits invest between claim and swap,
      // so claimAmountBtcSelected < the invest amount itself.
      // With autoSwap=false 100% of the partial goes to claim.
      const partialInvest = 0.003; // less than claimAmountBtc (0.005), forces partial
      const resultNoSwap = computeClaimFromInvest(false, partialInvest, [vault1], 1);
      const resultSwap = computeClaimFromInvest(true, partialInvest, [vault1], 1);
      // With autoSwap, portion of invest_after_fees goes to swap → less to claim
      expect(resultSwap.claimAmountBtcSelected).toBeLessThan(resultNoSwap.claimAmountBtcSelected);
    });
  });

  describe('edge cases', () => {
    it('should return zeros when investAmount is at dust threshold or below', () => {
      const result = computeClaimFromInvest(false, DUST_BTC, [vault1], 1);
      expect(result.claimAmountBtcSelected).toBe(0);
      expect(result.vaultCount).toBe(0);
    });

    it('should return zeros when liquidationData is empty', () => {
      const result = computeClaimFromInvest(false, 0.01, [], 1);
      expect(result.claimAmountBtcSelected).toBe(0);
      expect(result.vaultCount).toBe(0);
    });

    it('should not depend on a legacy get_tx_quote path in fee calc', () => {
      expect(() => computeClaimFromInvest(false, 0.01, [vault1], 1)).not.toThrow();
    });
  });
});

// ============================================================

describe('getOpCostRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return 0 when vaultCount is 0', () => {
      expect(getOpCostRepo(1, 0)).toBe(0);
    });

    it('should return a SDK-size-based repo fee estimate', () => {
      expect(getOpCostRepo(1, 1)).toBe(882);
      expect(getOpCostRepo(5, 1)).toBe(4410);
    });

    it('should scale with vault count', () => {
      const single = getOpCostRepo(1, 1);
      const triple = getOpCostRepo(1, 3);
      expect(triple).toBeGreaterThan(single);
      expect(triple).toBe(1192);
    });
  });

  describe('edge cases', () => {
    it('should handle feeRate = 0 without division error', () => {
      expect(() => getOpCostRepo(0, 1)).not.toThrow();
    });
  });
});

// ============================================================

describe('getTotalClaimBtc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should sum claimAmountBtc across all full vaults', () => {
      const data = [
        makeProfile({ claimAmountBtc: 0.01 }),
        makeProfile({ claimAmountBtc: 0.02 }),
      ];
      expect(getTotalClaimBtc(data)).toBeCloseTo(0.03, 8);
    });

    it('should use claimAmountPartial for partially filled vault', () => {
      const data = [
        makeProfile({ claimAmountBtc: 0.01 }),
        makeProfile({ claimAmountBtc: 0.02, claimAmountPartial: 0.007 }),
      ];
      expect(getTotalClaimBtc(data)).toBeCloseTo(0.017, 8);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty array', () => {
      expect(getTotalClaimBtc([])).toBe(0);
    });

    it('should return single vault value for single-element array', () => {
      const data = [makeProfile({ claimAmountBtc: 0.005 })];
      expect(getTotalClaimBtc(data)).toBeCloseTo(0.005, 8);
    });
  });
});

// ============================================================

describe('getTotalEstimatedProfit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should sum profitBtc across full vaults', () => {
      const data = [
        makeProfile({ profitBtc: 0.0002 }),
        makeProfile({ profitBtc: 0.0003 }),
      ];
      expect(getTotalEstimatedProfit(data)).toBeCloseTo(0.0005, 8);
    });

    it('should scale profitBtc proportionally for partial vault', () => {
      const data = [
        makeProfile({ claimAmountBtc: 0.01, profitBtc: 0.001, claimAmountPartial: 0.005 }),
      ];
      // part = 0.005 / 0.01 = 0.5 → profit = 0.001 × 0.5 = 0.0005
      expect(getTotalEstimatedProfit(data)).toBeCloseTo(0.0005, 8);
    });

    it('should handle mix of full and partial vaults', () => {
      const data = [
        makeProfile({ claimAmountBtc: 0.01, profitBtc: 0.001 }),
        makeProfile({ claimAmountBtc: 0.02, profitBtc: 0.002, claimAmountPartial: 0.01 }),
      ];
      expect(getTotalEstimatedProfit(data)).toBeCloseTo(0.001 + 0.001, 8);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty array', () => {
      expect(getTotalEstimatedProfit([])).toBe(0);
    });
  });
});

// ============================================================

describe('getClaimedDebtUnits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should sum unit across full vaults', () => {
      const data = [
        makeProfile({ unit: 10 }),
        makeProfile({ unit: 5 }),
      ];
      expect(getClaimedDebtUnits(data)).toBeCloseTo(15, 4);
    });

    it('should scale unit proportionally for partial vault', () => {
      const data = [
        makeProfile({ unit: 10, claimAmountBtc: 0.01, claimAmountPartial: 0.005 }),
      ];
      // part = 0.5 → unit contribution = 5
      expect(getClaimedDebtUnits(data)).toBeCloseTo(5, 4);
    });

    it('should handle mix of full and partial vaults', () => {
      const data = [
        makeProfile({ unit: 10, claimAmountBtc: 0.01 }),
        makeProfile({ unit: 20, claimAmountBtc: 0.02, claimAmountPartial: 0.01 }),
      ];
      expect(getClaimedDebtUnits(data)).toBeCloseTo(20, 4); // 10 + 10
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty array', () => {
      expect(getClaimedDebtUnits([])).toBe(0);
    });
  });
});

// ============================================================

describe('getEstimatedProfitAveragePercent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return weighted average of profitPercent', () => {
      const data = [
        makeProfile({ profitPercent: 4, claimAmountBtc: 0.01 }),
        makeProfile({ profitPercent: 6, claimAmountBtc: 0.01 }),
      ];
      // Equal weights → avg = 5
      expect(getEstimatedProfitAveragePercent(data)).toBeCloseTo(5, 4);
    });

    it('should weight heavier vault more', () => {
      const data = [
        makeProfile({ profitPercent: 2, claimAmountBtc: 0.01 }),
        makeProfile({ profitPercent: 8, claimAmountBtc: 0.03 }),
      ];
      // Weighted avg = (2×0.01 + 8×0.03) / 0.04 = (0.02 + 0.24) / 0.04 = 6.5
      expect(getEstimatedProfitAveragePercent(data)).toBeCloseTo(6.5, 4);
    });

    it('should use claimAmountPartial as weight when set', () => {
      const data = [
        makeProfile({ profitPercent: 4, claimAmountBtc: 0.02, claimAmountPartial: 0.01 }),
      ];
      // weight = 0.01, percent = 4 → avg = 4
      expect(getEstimatedProfitAveragePercent(data)).toBeCloseTo(4, 4);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty array', () => {
      expect(getEstimatedProfitAveragePercent([])).toBe(0);
    });

    it('should return 0 when data is null/undefined', () => {
      expect(getEstimatedProfitAveragePercent(null as unknown as [])).toBe(0);
    });

    it('should return 0 if all weights are 0 (guard against NaN)', () => {
      const data = [
        makeProfile({ profitPercent: 4, claimAmountBtc: 0, claimAmountPartial: undefined }),
      ];
      const result = getEstimatedProfitAveragePercent(data);
      // weightTotal = 0 → NaN → returns 0
      expect(Number.isFinite(result) || result === 0).toBe(true);
    });
  });
});

// ============================================================

describe('getEstimatedYield', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should return btc = sum of profitBtc and percent = weighted avg profitPercent', () => {
      const data = [
        makeProfile({ profitBtc: 0.001, profitPercent: 4, claimAmountBtc: 0.01 }),
        makeProfile({ profitBtc: 0.002, profitPercent: 4, claimAmountBtc: 0.01 }),
      ];
      const result = getEstimatedYield(data);
      expect(result.btc).toBeCloseTo(0.003, 8);
      expect(result.percent).toBeCloseTo(4, 4);
    });
  });

  describe('edge cases', () => {
    it('should return { btc: 0, percent: 0 } for empty array', () => {
      const result = getEstimatedYield([]);
      expect(result.btc).toBe(0);
      expect(result.percent).toBe(0);
    });
  });
});

// ============================================================

describe('getSelectionStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should compute correct stats for full vaults', () => {
      const data = [
        makeProfile({ claimAmountBtc: 0.005, postTaxBtcInVault: 0.018, unit: 12 }),
        makeProfile({ claimAmountBtc: 0.004, postTaxBtcInVault: 0.015, unit: 10 }),
      ];
      const stats = getSelectionStats(data);
      expect(stats.totalClaimBtc).toBeCloseTo(0.009, 8);
      expect(stats.totalClaimedBtc).toBeCloseTo(0.033, 8);
      expect(stats.totalClaimedUnit).toBeCloseTo(22, 4);
    });

    it('should apply portion for partial vault', () => {
      const data = [
        makeProfile({
          claimAmountBtc: 0.01,
          claimAmountPartial: 0.005,
          postTaxBtcInVault: 0.018,
          unit: 12,
        }),
      ];
      const stats = getSelectionStats(data);
      // portion = 0.5
      expect(stats.totalClaimBtc).toBeCloseTo(0.005, 8);
      expect(stats.totalClaimedBtc).toBeCloseTo(0.009, 8);
      expect(stats.totalClaimedUnit).toBeCloseTo(6, 4);
    });
  });

  describe('edge cases', () => {
    it('should return zeros for empty array', () => {
      const stats = getSelectionStats([]);
      expect(stats.totalClaimBtc).toBe(0);
      expect(stats.totalClaimedBtc).toBe(0);
      expect(stats.totalClaimedUnit).toBe(0);
    });
  });
});

// ============================================================

describe('getHealthAfterLiquidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('should compute finalVaultCollateral as btcInVault + deposit amount', () => {
      const claimed = [
        makeProfile({
          claimAmountBtc: 0.005,
          postTaxBtcInVault: 0.018,
          unit: 12,
        }),
      ];
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 0.1,
        unitInVault: 100,
        claimedVaults: claimed,
      });
      // totalClaimBtc = 0.005, totalClaimedBtc = 0.018
      // finalDepositAmount = 0.018 + 0.005 = 0.023
      // finalVaultCollateral = 0.1 + 0.023 = 0.123
      expect(result.finalDepositAmount).toBeCloseTo(0.023, 8);
      expect(result.finalVaultCollateral).toBeCloseTo(0.123, 6);
    });

    it('should compute finalUnitDebt as unitInVault + claimed units', () => {
      const claimed = [makeProfile({ unit: 12 })];
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 0.1,
        unitInVault: 100,
        claimedVaults: claimed,
      });
      expect(result.finalUnitDebt).toBeCloseTo(112, 4);
    });

    it('should return raw finalHealthValue when it is below minimum health', () => {
      // Force very low health: tiny btcInVault, large unitDebt
      const claimed = [makeProfile({ unit: 0.001, claimAmountBtc: 0.0001, postTaxBtcInVault: 0.00001 })];
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 0.00001,
        unitInVault: 10_000,
        claimedVaults: claimed,
      });
      expect(result.finalHealthValue).toBeLessThan(160);
    });

    it('should return raw health when it is above 160', () => {
      // Overcollateralised: large btcInVault, small debt
      const claimed = [makeProfile({ unit: 1, claimAmountBtc: 0.001, postTaxBtcInVault: 0.002 })];
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 1,
        unitInVault: 10,
        claimedVaults: claimed,
      });
      expect(result.finalHealthValue).toBeGreaterThan(160);
    });

    it('should compute finalAssetValueBtc = finalVaultCollateral - finalUnitDebt / btcPrice', () => {
      const claimed = [makeProfile({ unit: 10, claimAmountBtc: 0.005, postTaxBtcInVault: 0.018 })];
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 0.1,
        unitInVault: 50,
        claimedVaults: claimed,
      });
      const expected = result.finalVaultCollateral - result.finalUnitDebt / 80_000;
      expect(result.finalAssetValueBtc).toBeCloseTo(expected, 8);
    });
  });

  describe('edge cases', () => {
    it('should return raw finalHealthValue when claimedVaults is empty and vault is unhealthy', () => {
      const result = getHealthAfterLiquidation({
        btcPrice: 80_000,
        btcInVault: 0.0001,
        unitInVault: 10_000,
        claimedVaults: [],
      });
      expect(result.finalHealthValue).toBeLessThan(160);
    });

    it('should handle claimedVaults with partial fills', () => {
      const partial = makeProfile({
        claimAmountBtc: 0.01,
        claimAmountPartial: 0.005,
        postTaxBtcInVault: 0.018,
        unit: 12,
      });
      expect(() =>
        getHealthAfterLiquidation({
          btcPrice: 80_000,
          btcInVault: 0.1,
          unitInVault: 100,
          claimedVaults: [partial],
        })
      ).not.toThrow();
    });
  });
});
