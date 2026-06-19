/**
 * Tests for createVaultOperationStore factory
 */

import { act } from '@testing-library/react-native';
import { createVaultOperationStore } from '../createVaultOperationStore';
import { commonInitialState } from '../vaultStoreTypes';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../utils/vaultUtils', () => ({
  computeHealthFactor: jest.fn((btcAmount: number, btcPrice: number, unitAmount: number) => {
    if (!btcPrice || btcAmount <= 0 || unitAmount <= 0) return 0;
    return ((btcAmount * btcPrice) / unitAmount) * 100;
  }),
  computeLiquidationPrice: jest.fn((unitAmount: number, btcAmount: number) => {
    if (btcAmount <= 0 || unitAmount <= 0) return 0;
    return unitAmount / btcAmount / 0.6;
  }),
  getHealthStatus: jest.fn((healthFactor: number) => {
    if (healthFactor >= 200) return 'healthy';
    if (healthFactor >= 160) return 'warning';
    return 'danger';
  }),
}));

describe('createVaultOperationStore', () => {
  describe('base store creation', () => {
    it('should create a store for each operation type', () => {
      const borrowStore = createVaultOperationStore('borrow');
      const depositStore = createVaultOperationStore('deposit');
      const repayStore = createVaultOperationStore('repay');
      const withdrawStore = createVaultOperationStore('withdraw');

      expect(borrowStore.getState()).toBeDefined();
      expect(depositStore.getState()).toBeDefined();
      expect(repayStore.getState()).toBeDefined();
      expect(withdrawStore.getState()).toBeDefined();
    });

    it('should initialize with common initial state', () => {
      const store = createVaultOperationStore('borrow');
      const state = store.getState();

      expect(state.selectedFeeRate).toBe(commonInitialState.selectedFeeRate);
      expect(state.currentUnitBorrowed).toBe(0);
      expect(state.currentBtcLocked).toBe(0);
      expect(state.bitcoinPrice).toBeNull();
      expect(state.currentStep).toBe('input');
      expect(state.processingStep).toBe(1);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.vaultTxid).toBeNull();
    });

    it('should create independent store instances', () => {
      const store1 = createVaultOperationStore('borrow');
      const store2 = createVaultOperationStore('borrow');

      act(() => {
        store1.getState().setSelectedFeeRate(5);
      });

      expect(store1.getState().selectedFeeRate).toBe(5);
      expect(store2.getState().selectedFeeRate).toBe(commonInitialState.selectedFeeRate);
    });
  });

  describe('common actions', () => {
    it('should set fee rate', () => {
      const store = createVaultOperationStore('deposit');

      act(() => {
        store.getState().setSelectedFeeRate(10);
      });

      expect(store.getState().selectedFeeRate).toBe(10);
    });

    it('should set current vault data', () => {
      const store = createVaultOperationStore('repay');

      act(() => {
        store.getState().setCurrentVaultData(500, 0.5);
      });

      expect(store.getState().currentUnitBorrowed).toBe(500);
      expect(store.getState().currentBtcLocked).toBe(0.5);
    });

    it('should set bitcoin price', () => {
      const store = createVaultOperationStore('withdraw');

      act(() => {
        store.getState().setBitcoinPrice(50000);
      });

      expect(store.getState().bitcoinPrice).toBe(50000);
    });

    it('should set current step and clear error', () => {
      const store = createVaultOperationStore('borrow');

      act(() => {
        store.getState().setError('some error');
        store.getState().setCurrentStep('confirm');
      });

      expect(store.getState().currentStep).toBe('confirm');
      expect(store.getState().error).toBeNull();
    });

    it('should set processing step', () => {
      const store = createVaultOperationStore('deposit');

      act(() => {
        store.getState().setProcessingStep(3);
      });

      expect(store.getState().processingStep).toBe(3);
    });

    it('should set loading', () => {
      const store = createVaultOperationStore('repay');

      act(() => {
        store.getState().setLoading(true);
      });

      expect(store.getState().loading).toBe(true);
    });

    it('should set error and clear loading', () => {
      const store = createVaultOperationStore('withdraw');

      act(() => {
        store.getState().setLoading(true);
        store.getState().setError('failed');
      });

      expect(store.getState().error).toBe('failed');
      expect(store.getState().loading).toBe(false);
    });

    it('should set vault txid', () => {
      const store = createVaultOperationStore('borrow');

      act(() => {
        store.getState().setVaultTxid('abc123');
      });

      expect(store.getState().vaultTxid).toBe('abc123');
    });

    it('should reset to initial state', () => {
      const store = createVaultOperationStore('deposit');

      act(() => {
        store.getState().setSelectedFeeRate(10);
        store.getState().setCurrentVaultData(500, 0.5);
        store.getState().setBitcoinPrice(50000);
        store.getState().setCurrentStep('processing');
        store.getState().setLoading(true);
        store.getState().setError('err');
        store.getState().setVaultTxid('tx1');
      });

      act(() => {
        store.getState().reset();
      });

      const state = store.getState();
      expect(state.selectedFeeRate).toBe(commonInitialState.selectedFeeRate);
      expect(state.currentUnitBorrowed).toBe(0);
      expect(state.currentBtcLocked).toBe(0);
      expect(state.bitcoinPrice).toBeNull();
      expect(state.currentStep).toBe('input');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.vaultTxid).toBeNull();
    });
  });

  describe('common computed getters', () => {
    it('should compute health factor', () => {
      const store = createVaultOperationStore('borrow');

      act(() => {
        store.getState().setCurrentVaultData(1000, 0.5);
        store.getState().setBitcoinPrice(100000);
      });

      const healthFactor = store.getState().getHealthFactor();
      // (0.5 * 100000 / 1000) * 100 = 5000
      expect(healthFactor).toBe(5000);
    });

    it('should return 0 health factor when missing data', () => {
      const store = createVaultOperationStore('deposit');

      expect(store.getState().getHealthFactor()).toBe(0);
    });

    it('should compute liquidation price', () => {
      const store = createVaultOperationStore('repay');

      act(() => {
        store.getState().setCurrentVaultData(1000, 0.5);
      });

      const liqPrice = store.getState().getLiquidationPrice();
      // 1000 / 0.5 / 0.6 = 3333.33...
      expect(liqPrice).toBeCloseTo(3333.33, 0);
    });

    it('should compute health status', () => {
      const store = createVaultOperationStore('withdraw');

      act(() => {
        store.getState().setCurrentVaultData(1000, 0.5);
        store.getState().setBitcoinPrice(100000);
      });

      expect(store.getState().getHealthStatus()).toBe('healthy');
    });
  });

  describe('extensions', () => {
    it('should merge extension state with common state', () => {
      interface CustomExt {
        customAmount: number;
        setCustomAmount: (n: number) => void;
      }

      const store = createVaultOperationStore<CustomExt>('borrow', (set, _get, _ctx) => ({
        customAmount: 42,
        setCustomAmount: (customAmount: number) => {
          set({ customAmount } as never);
        },
      }));

      const state = store.getState();
      expect(state.customAmount).toBe(42);
      expect(state.selectedFeeRate).toBe(commonInitialState.selectedFeeRate);
    });

    it('should allow extension to override reset', () => {
      interface CustomExt {
        customField: string;
        reset: () => void;
      }

      const store = createVaultOperationStore<CustomExt>('deposit', (set, _get, { initialState }) => ({
        customField: 'initial',
        reset: () => {
          set({ ...initialState, customField: 'initial' } as never);
        },
      }));

      act(() => {
        store.getState().setSelectedFeeRate(99);
        (store.getState() as { customField: string }).customField; // read
      });

      act(() => {
        store.getState().reset();
      });

      expect(store.getState().selectedFeeRate).toBe(commonInitialState.selectedFeeRate);
    });

    it('should provide context with initial state and store name', () => {
      let capturedContext: { initialState: unknown; storeName: string } | null = null;

      interface Ext {
        dummy: boolean;
      }

      createVaultOperationStore<Ext>('withdraw', (_set, _get, ctx) => {
        capturedContext = ctx;
        return { dummy: true };
      });

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.storeName).toBe('WithdrawStore');
      expect(capturedContext!.initialState).toEqual(commonInitialState);
    });
  });
});
