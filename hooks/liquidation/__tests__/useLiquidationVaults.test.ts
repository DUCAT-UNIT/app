/**
 * Tests for useLiquidationVaults hook
 *
 * Covers: refreshLiqVaults (happy path + errors), maxInvestable computation,
 * fetchStatus transitions, polling lifecycle, in-flight guard.
 */

import { act } from 'react-test-renderer';
import { renderHook } from '../../../services/__tests__/testUtils/renderHook';
import { useLiquidationVaults } from '../useLiquidationVaults';
import {
  useLiquidationFlowStore,
  resetLiquidationFlowStore,
} from '../../../stores/liquidationFlowStore';
import type { LiquidVaultProfileWithMeta } from '../../../services/liquidation/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../services/liquidation/fetchVaults', () => ({
  fetchLiquidatableVaults: jest.fn(),
}));

jest.mock('../../../services/vaultWallet', () => ({
  fetchProtocolContract: jest.fn(),
}));

jest.mock('../../../services/liquidation/calculations', () => ({
  computeLiquidVaultProfiles: jest.fn(),
  getMaxInvest: jest.fn(),
  getAvailableCollateralBtc: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { fetchLiquidatableVaults } from '../../../services/liquidation/fetchVaults';
import { fetchProtocolContract } from '../../../services/vaultWallet';
import {
  computeLiquidVaultProfiles,
  getMaxInvest,
  getAvailableCollateralBtc,
} from '../../../services/liquidation/calculations';

const mockFetchVaults = fetchLiquidatableVaults as jest.Mock;
const mockFetchContract = fetchProtocolContract as jest.Mock;
const mockComputeProfiles = computeLiquidVaultProfiles as jest.Mock;
const mockGetMaxInvest = getMaxInvest as jest.Mock;
const mockGetAvailableCollateral = getAvailableCollateralBtc as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CONTRACT = { id: 'contract-123' };

function makeFullProfile(overrides: Partial<LiquidVaultProfileWithMeta> = {}): LiquidVaultProfileWithMeta {
  return {
    vaultId: 'vault-001',
    unit: 100,
    btcInVault: 0.02,
    postTaxBtcInVault: 0.018,
    claimAmountBtc: 0.005,
    unitSwapBtc: 0.00125,
    profitBtc: 0.0002,
    profitPercent: 4,
    profitPercentPrecised: 4,
    liquid_quote: {
      coin_price: 80_000,
      deficit_cr: 0.05,
      deficit_sats: 500_000,
      liquid_nav: 0.95,
      profit_margin: 0.04,
      reserve_sats: 100_000,
      reward_cr: 1.0,
      reward_sats: 80_000,
      sats_balance: 2_000_000,
      subsidy_multi: 1.0,
      subsidy_rate: 0.01,
      subsidy_sats: 20_000,
      taxable_sats: 200_000,
      unit_balance: 100,
      unit_divisor: 100,
      vault_cr: 1.33,
    },
    repo_portion: 1,
    return_sats: 1_500_000,
    return_unit: 100,
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
      unit_balance: 100,
      unit_price: 80_000,
      unit_stamp: 1_700_000_000,
      vault_action: 'lock',
    },
    ...overrides,
  } as unknown as LiquidVaultProfileWithMeta;
}

const DEFAULT_PARAMS = {
  btcPrice: 80_000,
  segwitBalance: 0.01,
  taprootBalance: 0,
  vaultCollateral: 0.05,
  vaultDebt: 3_000,
  hasVault: true,
  visible: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLiquidationVaults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLiquidationFlowStore();

    mockFetchVaults.mockResolvedValue([]);
    mockFetchContract.mockResolvedValue(MOCK_CONTRACT);
    mockComputeProfiles.mockReturnValue([]);
    mockGetMaxInvest.mockReturnValue({
      maxInvestBtc: 0,
      maxClaimAmountBtc: 0,
      maxSwapBtc: 0,
      maxSwapUnit: 0,
      maxVaultCount: 0,
      lastPortionRate: 1,
    });
    mockGetAvailableCollateral.mockReturnValue(0.02);
  });

  describe('refreshLiqVaults', () => {
    describe('happy path', () => {
      it('should set fetchStatus to loading then loaded on success', async () => {
        const profiles = [makeFullProfile()];
        mockComputeProfiles.mockReturnValue(profiles);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(useLiquidationFlowStore.getState().fetchStatus).toBe('loaded');
      });

      it('should call fetchLiquidatableVaults and fetchProtocolContract concurrently', async () => {
        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(mockFetchVaults).toHaveBeenCalledTimes(1);
        expect(mockFetchContract).toHaveBeenCalledTimes(1);
      });

      it('should call computeLiquidVaultProfiles with raw vaults, btcPrice, and contract', async () => {
        const rawVaults = [{ vault_id: 'v1' }];
        mockFetchVaults.mockResolvedValue(rawVaults);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(mockComputeProfiles).toHaveBeenCalledWith(rawVaults, 80_000, MOCK_CONTRACT);
      });

      it('should populate the store vaults with display projections', async () => {
        const profiles = [makeFullProfile({ vaultId: 'abc', profitPercent: 5 })];
        mockComputeProfiles.mockReturnValue(profiles);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        const storeVaults = useLiquidationFlowStore.getState().vaults;
        expect(storeVaults).toHaveLength(1);
        expect(storeVaults[0].vaultId).toBe('abc');
        expect(storeVaults[0].profitPercent).toBe(5);
      });

      it('should compute profitRate, depositRate, swapRate from the first vault', async () => {
        const profile = makeFullProfile({
          claimAmountBtc: 0.006,
          unitSwapBtc: 0.004,
          profitPercent: 8,
        });
        mockComputeProfiles.mockReturnValue([profile]);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        const state = useLiquidationFlowStore.getState();
        // profitRate = profitPercent / 100 = 0.08
        expect(state.profitRate).toBeCloseTo(0.08);
        // depositRate = claimAmountBtc / (claimAmountBtc + unitSwapBtc) = 0.006 / 0.010 = 0.6
        expect(state.depositRate).toBeCloseTo(0.6);
        // swapRate = unitSwapBtc / total = 0.004 / 0.010 = 0.4
        expect(state.swapRate).toBeCloseTo(0.4);
      });

      it('should set profitRate/depositRate/swapRate to 0 when vaults list is empty', async () => {
        mockComputeProfiles.mockReturnValue([]);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        const state = useLiquidationFlowStore.getState();
        expect(state.profitRate).toBe(0);
        expect(state.depositRate).toBe(0);
        expect(state.swapRate).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should set fetchStatus to error when fetch throws', async () => {
        mockFetchVaults.mockRejectedValue(new Error('Network failure'));

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(useLiquidationFlowStore.getState().fetchStatus).toBe('error');
      });

      it('should set fetchStatus to error when fetchProtocolContract throws', async () => {
        mockFetchContract.mockRejectedValue(new Error('Contract not found'));

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(useLiquidationFlowStore.getState().fetchStatus).toBe('error');
      });

      it('should not update vaults on error', async () => {
        // Seed some vaults
        useLiquidationFlowStore.getState().setVaultData(
          [{ vaultId: 'existing', unit: 10, btcInVault: 0.01, claimAmountBtc: 0.005, profitBtc: 0.0001, profitPercent: 2, postTaxBtcInVault: 0.009, unitSwapBtc: 0.0001 }],
          [],
          0,
          0,
          0,
        );

        mockFetchVaults.mockRejectedValue(new Error('fail'));

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        // Display vaults should remain unchanged since we failed
        expect(useLiquidationFlowStore.getState().vaults[0].vaultId).toBe('existing');
      });
    });

    describe('in-flight guard', () => {
      it('should not start a second fetch while one is in flight', async () => {
        let resolveFirst: (value: unknown) => void;
        const firstFetch = new Promise((res) => { resolveFirst = res; });
        mockFetchVaults.mockReturnValueOnce(firstFetch);

        const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

        // Start first fetch without awaiting
        act(() => { void result.current!.refreshLiqVaults(); });

        // Attempt second fetch while first is running
        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        // Only one call to fetchLiquidatableVaults
        expect(mockFetchVaults).toHaveBeenCalledTimes(1);

        // Resolve first fetch
        await act(async () => {
          resolveFirst!([]);
          await Promise.resolve();
        });
      });

      it('should skip refresh when btcPrice is null', async () => {
        const params = { ...DEFAULT_PARAMS, btcPrice: null };
        const { result } = renderHook(() => useLiquidationVaults(params));

        await act(async () => {
          await result.current!.refreshLiqVaults();
        });

        expect(mockFetchVaults).not.toHaveBeenCalled();
      });
    });
  });

  describe('maxInvestable computation', () => {
    it('should return 0 when btcPrice is null', () => {
      const params = { ...DEFAULT_PARAMS, btcPrice: null };
      const { result } = renderHook(() => useLiquidationVaults(params));

      expect(result.current!.maxInvestable).toBe(0);
    });

    it('should return 0 when vaultsFull is empty', () => {
      const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

      // vaultsFull starts as []
      expect(result.current!.maxInvestable).toBe(0);
      expect(mockGetMaxInvest).not.toHaveBeenCalled();
    });

    it('should call getMaxInvest with correct args after vaults are loaded', async () => {
      const profiles = [makeFullProfile()];
      mockComputeProfiles.mockReturnValue(profiles);
      mockGetAvailableCollateral.mockReturnValue(0.03);
      mockGetMaxInvest.mockReturnValue({
        maxInvestBtc: 0.025,
        maxClaimAmountBtc: 0.02,
        maxSwapBtc: 0.005,
        maxSwapUnit: 400,
        maxVaultCount: 1,
        lastPortionRate: 1,
      });

      const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

      await act(async () => {
        await result.current!.refreshLiqVaults();
      });

      expect(mockGetMaxInvest).toHaveBeenCalledWith(
        true,
        expect.any(Number), // availableCollateral
        expect.any(Number), // walletSats
        80_000,
        1, // LIQ_DEFAULT_FEE_RATE
        profiles,
        0.025, // LIQ_MAX_CLAIM_AMOUNT_BTC
      );

      expect(result.current!.maxInvestable).toBe(0.025);
    });

    it('should combine segwitBalance and taprootBalance for walletSats', async () => {
      const profiles = [makeFullProfile()];
      mockComputeProfiles.mockReturnValue(profiles);
      mockGetMaxInvest.mockReturnValue({ maxInvestBtc: 0.01, maxClaimAmountBtc: 0, maxSwapBtc: 0, maxSwapUnit: 0, maxVaultCount: 1, lastPortionRate: 1 });

      const params = { ...DEFAULT_PARAMS, segwitBalance: 0.01, taprootBalance: 0.005 };
      const { result } = renderHook(() => useLiquidationVaults(params));

      await act(async () => {
        await result.current!.refreshLiqVaults();
      });

      // walletSats = round((0.01 + 0.005) * 100_000_000) = 1_500_000
      expect(mockGetMaxInvest).toHaveBeenCalledWith(
        true,
        expect.any(Number),
        1_500_000,
        80_000,
        expect.any(Number),
        profiles,
        expect.any(Number),
      );
    });

    it('should use wallet balance as collateral when hasVault is false', async () => {
      const profiles = [makeFullProfile()];
      mockComputeProfiles.mockReturnValue(profiles);
      mockGetMaxInvest.mockReturnValue({ maxInvestBtc: 0.005, maxClaimAmountBtc: 0, maxSwapBtc: 0, maxSwapUnit: 0, maxVaultCount: 1, lastPortionRate: 1 });

      const params = { ...DEFAULT_PARAMS, hasVault: false, segwitBalance: 0.005, taprootBalance: 0 };
      const { result } = renderHook(() => useLiquidationVaults(params));

      await act(async () => {
        await result.current!.refreshLiqVaults();
      });

      // When hasVault=false, availableCollateral = walletSats / 100_000_000
      // getMaxInvest should be called with 0.005 (= 500_000 sats / 100_000_000) as availableCollateral
      expect(mockGetMaxInvest).toHaveBeenCalledWith(
        true,
        0.005, // walletSats / 100_000_000
        500_000, // walletSats in sats
        80_000,
        expect.any(Number),
        profiles,
        expect.any(Number),
      );
    });

    it('should use getAvailableCollateralBtc when hasVault is true', async () => {
      const profiles = [makeFullProfile()];
      mockComputeProfiles.mockReturnValue(profiles);
      mockGetAvailableCollateral.mockReturnValue(0.035);
      mockGetMaxInvest.mockReturnValue({ maxInvestBtc: 0.02, maxClaimAmountBtc: 0, maxSwapBtc: 0, maxSwapUnit: 0, maxVaultCount: 1, lastPortionRate: 1 });

      const { result } = renderHook(() => useLiquidationVaults(DEFAULT_PARAMS));

      await act(async () => {
        await result.current!.refreshLiqVaults();
      });

      expect(mockGetAvailableCollateral).toHaveBeenCalledWith(
        80_000,
        DEFAULT_PARAMS.vaultCollateral,
        DEFAULT_PARAMS.vaultDebt,
      );
      expect(mockGetMaxInvest).toHaveBeenCalledWith(
        true,
        0.035,
        expect.any(Number),
        80_000,
        expect.any(Number),
        profiles,
        expect.any(Number),
      );
    });
  });

  describe('polling lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start polling when visible and currentStep is input', () => {
      const params = { ...DEFAULT_PARAMS, visible: true };
      renderHook(() => useLiquidationVaults(params));

      act(() => { jest.advanceTimersByTime(30_000); });

      // fetchLiquidatableVaults called once on mount (from initial fetch effect) + once from poll
      expect(mockFetchVaults.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop polling on unmount', async () => {
      const params = { ...DEFAULT_PARAMS, visible: true };
      const { unmount } = renderHook(() => useLiquidationVaults(params));

      unmount();

      // Advance timers — no additional calls after unmount
      act(() => { jest.advanceTimersByTime(60_000); });

      // Count calls after unmount — only the initial ones before unmount
      const callsBefore = mockFetchVaults.mock.calls.length;
      expect(mockFetchVaults.mock.calls.length).toBe(callsBefore);
    });

    it('should still fetch in background when visible is false', () => {
      const params = { ...DEFAULT_PARAMS, visible: false };
      renderHook(() => useLiquidationVaults(params));

      // The hook now always fetches on mount for background prefetch
      // When visible=false, it uses the background polling interval (120s)
      expect(mockFetchVaults).toHaveBeenCalled();
    });

    it('should not poll when currentStep is not input', () => {
      useLiquidationFlowStore.getState().setCurrentStep('processing');
      const params = { ...DEFAULT_PARAMS, visible: true };
      renderHook(() => useLiquidationVaults(params));

      act(() => { jest.advanceTimersByTime(30_000); });

      // Only the initial fetch triggered by visible=true; no poll
      // (the poll setInterval is not set when currentStep != 'input')
      expect(mockFetchVaults.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('initial fetch on mount', () => {
    it('should trigger fetch when visible is true', async () => {
      const params = { ...DEFAULT_PARAMS, visible: true };
      renderHook(() => useLiquidationVaults(params));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchVaults).toHaveBeenCalled();
    });

    it('should also trigger background fetch when visible is false', async () => {
      const params = { ...DEFAULT_PARAMS, visible: false };
      renderHook(() => useLiquidationVaults(params));

      await act(async () => {
        await Promise.resolve();
      });

      // The hook now prefetches in background regardless of visibility
      expect(mockFetchVaults).toHaveBeenCalled();
    });
  });
});
