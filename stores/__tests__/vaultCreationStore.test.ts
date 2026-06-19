/**
 * Tests for vaultCreationStore
 * Consolidated to test meaningful behavior - computed values and flows
 */

import { act } from '@testing-library/react-native';
import {
  useVaultCreationStore,
  resetVaultCreationStore,
  ProcessingStep,
  getPersistedVaultCreationState,
} from '../vaultCreationStore';
import { VAULT_CONFIG } from '../../utils/constants';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/vaultUtils', () => ({
  computeHealthFactor: jest.fn((btcAmount, btcPrice, unitAmount) => {
    if (unitAmount <= 0) return 0;
    return ((btcAmount * btcPrice) / unitAmount) * 100;
  }),
  computeLiquidationPrice: jest.fn((unitAmount, btcAmount) => {
    if (btcAmount <= 0) return 0;
    return unitAmount / btcAmount / 0.6;
  }),
  getMaxUnit: jest.fn((btcAmount, btcPrice) => {
    if (!btcPrice || btcAmount <= 0) return null;
    return btcAmount * btcPrice * 0.6;
  }),
  getHealthStatus: jest.fn((healthFactor) => {
    if (healthFactor >= 200) return 'healthy';
    if (healthFactor >= 160) return 'warning';
    return 'danger';
  }),
}));

describe('vaultCreationStore', () => {
  beforeEach(() => {
    resetVaultCreationStore();
  });

  it('should have correct initial state', () => {
    const state = useVaultCreationStore.getState();
    expect(state).toMatchObject({
      btcAmount: 0,
      unitAmount: 0,
      selectedFeeRate: VAULT_CONFIG.DEFAULT_FEE_RATE,
      bitcoinPrice: null,
      currentStep: 'amounts',
      processingStep: 1,
      loading: false,
      error: null,
      txid: null,
    });
  });

  describe('error handling', () => {
    it('should clear error when setting amounts or changing step', () => {
      const { setBtcAmount, setUnitAmount, setCurrentStep, setError } =
        useVaultCreationStore.getState();

      act(() => {
        setError('Some error');
      });
      expect(useVaultCreationStore.getState().error).toBe('Some error');

      act(() => {
        setBtcAmount(0.5);
      });
      expect(useVaultCreationStore.getState().error).toBeNull();

      act(() => {
        setError('Another error');
      });
      act(() => {
        setUnitAmount(10000);
      });
      expect(useVaultCreationStore.getState().error).toBeNull();

      act(() => {
        setError('Step error');
      });
      act(() => {
        setCurrentStep('confirm');
      });
      expect(useVaultCreationStore.getState().error).toBeNull();
    });

    it('should set loading to false when error occurs', () => {
      const { setLoading, setError } = useVaultCreationStore.getState();

      act(() => {
        setLoading(true);
        setError('Transaction failed');
      });

      expect(useVaultCreationStore.getState().loading).toBe(false);
      expect(useVaultCreationStore.getState().error).toBe('Transaction failed');
    });
  });

  describe('computed getters', () => {
    it('should compute health factor correctly', () => {
      const { setBtcAmount, setUnitAmount, setBitcoinPrice } = useVaultCreationStore.getState();

      // Missing data returns 0
      expect(useVaultCreationStore.getState().getHealthFactor()).toBe(0);

      act(() => {
        setBtcAmount(1);
        setUnitAmount(25000);
        setBitcoinPrice(50000);
      });

      // (1 * 50000 / 25000) * 100 = 200%
      expect(useVaultCreationStore.getState().getHealthFactor()).toBe(200);
    });

    it('should compute liquidation price correctly', () => {
      const { setBtcAmount, setUnitAmount } = useVaultCreationStore.getState();

      expect(useVaultCreationStore.getState().getLiquidationPrice()).toBe(0);

      act(() => {
        setBtcAmount(1);
        setUnitAmount(30000);
      });

      // 30000 / 1 / 0.6 = 50000
      expect(useVaultCreationStore.getState().getLiquidationPrice()).toBe(50000);
    });

    it('should compute max borrowable correctly', () => {
      const { setBtcAmount, setBitcoinPrice } = useVaultCreationStore.getState();

      expect(useVaultCreationStore.getState().getMaxBorrowable()).toBeNull();

      act(() => {
        setBtcAmount(1);
        setBitcoinPrice(50000);
      });

      // 1 * 50000 * 0.6 = 30000
      expect(useVaultCreationStore.getState().getMaxBorrowable()).toBe(30000);
    });

    it('should return correct health status based on health factor', () => {
      const { setBtcAmount, setUnitAmount, setBitcoinPrice } = useVaultCreationStore.getState();

      act(() => {
        setBtcAmount(1);
        setBitcoinPrice(50000);
        setUnitAmount(25000); // 200% = healthy
      });
      expect(useVaultCreationStore.getState().getHealthStatus()).toBe('healthy');

      act(() => {
        setUnitAmount(28000);
      }); // ~178% = warning
      expect(useVaultCreationStore.getState().getHealthStatus()).toBe('warning');

      act(() => {
        setUnitAmount(35000);
      }); // ~143% = danger
      expect(useVaultCreationStore.getState().getHealthStatus()).toBe('danger');
    });
  });

  describe('full vault creation flow', () => {
    it('should handle complete vault creation success flow', () => {
      const state = useVaultCreationStore.getState();

      // Enter amounts
      act(() => {
        state.setBitcoinPrice(50000);
        state.setBtcAmount(1);
        state.setUnitAmount(25000);
        state.setSelectedFeeRate(2);
      });

      expect(useVaultCreationStore.getState().getHealthFactor()).toBe(200);

      // Navigate through steps
      act(() => {
        state.setCurrentStep('confirm');
      });
      act(() => {
        state.setCurrentStep('processing');
        state.setLoading(true);
      });

      // Processing steps
      ([2, 3, 4] as const).forEach((step) => {
        act(() => {
          state.setProcessingStep(step as ProcessingStep);
        });
        expect(useVaultCreationStore.getState().processingStep).toBe(step);
      });

      // Success
      act(() => {
        state.setLoading(false);
        state.setTxid('abc123def456');
        state.setCurrentStep('success');
      });

      expect(useVaultCreationStore.getState().currentStep).toBe('success');
      expect(useVaultCreationStore.getState().txid).toBe('abc123def456');
    });

    it('should handle error during processing while preserving form values', () => {
      const state = useVaultCreationStore.getState();

      act(() => {
        state.setBtcAmount(1);
        state.setUnitAmount(25000);
        state.setCurrentStep('processing');
        state.setLoading(true);
      });

      act(() => {
        state.setError('Transaction failed: insufficient funds');
      });

      expect(useVaultCreationStore.getState().error).toBe('Transaction failed: insufficient funds');
      expect(useVaultCreationStore.getState().loading).toBe(false);
      // Form values preserved
      expect(useVaultCreationStore.getState().btcAmount).toBe(1);
      expect(useVaultCreationStore.getState().unitAmount).toBe(25000);
    });
  });

  it('should reset all state to initial values', () => {
    const state = useVaultCreationStore.getState();

    act(() => {
      state.setBtcAmount(1);
      state.setUnitAmount(10000);
      state.setCurrentStep('confirm');
      state.setTxid('test123');
    });

    act(() => {
      state.reset();
    });

    expect(useVaultCreationStore.getState()).toMatchObject({
      btcAmount: 0,
      unitAmount: 0,
      currentStep: 'amounts',
      txid: null,
    });
  });

  it('should not persist transient processing or success steps', () => {
    const baseState = useVaultCreationStore.getState();

    expect(
      getPersistedVaultCreationState({
        ...baseState,
        currentStep: 'processing',
      }).currentStep
    ).toBe('confirm');

    expect(
      getPersistedVaultCreationState({
        ...baseState,
        currentStep: 'success',
      }).currentStep
    ).toBe('confirm');

    expect(
      getPersistedVaultCreationState({
        ...baseState,
        currentStep: 'payout',
      }).currentStep
    ).toBe('payout');
  });
});
