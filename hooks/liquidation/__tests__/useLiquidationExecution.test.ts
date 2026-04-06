/**
 * Tests for useLiquidationExecution hook
 *
 * Covers: successful execution, empty selection error, partial vault recomputation,
 * executeLiquidation error, resetAfterSuccess, resetAfterError, pending tx registration.
 */

import { act } from 'react-test-renderer';
import { renderHook } from '../../../services/__tests__/testUtils/renderHook';
import { useLiquidationExecution } from '../useLiquidationExecution';
import {
  useLiquidationFlowStore,
  resetLiquidationFlowStore,
} from '../../../stores/liquidationFlowStore';
import {
  usePendingVaultTransactionStore,
  resetPendingVaultTransactionStore,
} from '../../../stores/pendingVaultTransactionStore';
import type { LiquidVaultProfileWithMeta } from '../../../services/liquidation/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../services/liquidation/calculations', () => ({
  selectItemsForAmount: jest.fn(),
  recomputePartialVaultProfile: jest.fn(),
}));

jest.mock('../../../services/liquidation/execution', () => ({
  executeLiquidation: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  selectItemsForAmount,
  recomputePartialVaultProfile,
} from '../../../services/liquidation/calculations';
import { executeLiquidation } from '../../../services/liquidation/execution';

const mockSelectItems = selectItemsForAmount as jest.Mock;
const mockRecomputePartial = recomputePartialVaultProfile as jest.Mock;
const mockExecuteLiquidation = executeLiquidation as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFullVault(overrides: Partial<LiquidVaultProfileWithMeta> = {}): LiquidVaultProfileWithMeta {
  return {
    vaultId: 'vault-001',
    unit: 200,
    btcInVault: 0.04,
    postTaxBtcInVault: 0.036,
    claimAmountBtc: 0.008,
    unitSwapBtc: 0.0025,
    profitBtc: 0.0003,
    profitPercent: 4,
    profitPercentPrecised: 4,
    liquid_quote: {
      coin_price: 80_000,
      deficit_cr: 0.05,
      deficit_sats: 800_000,
      liquid_nav: 0.95,
      profit_margin: 0.04,
      reserve_sats: 100_000,
      reward_cr: 1.0,
      reward_sats: 80_000,
      sats_balance: 4_000_000,
      subsidy_multi: 1.0,
      subsidy_rate: 0.01,
      subsidy_sats: 40_000,
      taxable_sats: 400_000,
      unit_balance: 200,
      unit_divisor: 100,
      vault_cr: 1.33,
    },
    repo_portion: 1,
    return_sats: 3_600_000,
    return_unit: 200,
    thold_key: 'thold-key-001',
    acct_id: 'acct-001',
    guard_pk: 'guard-pk-001',
    master_id: 'master-001',
    vault_pk: 'vault-pk-001',
    utxo: { value: 4_000_000, txid: 'txid-001', vout: 0, script: 'script-001' },
    rdata: {
      is_locked: true,
      thold_hash: 'hash-001',
      thold_price: 70_000,
      unit_balance: 200,
      unit_price: 80_000,
      unit_stamp: 1_700_000_000,
      vault_action: 'lock',
    },
    ...overrides,
  } as unknown as LiquidVaultProfileWithMeta;
}

function makePartialVault(): LiquidVaultProfileWithMeta {
  return makeFullVault({
    vaultId: 'vault-partial',
    claimAmountBtc: 0.010,
    claimAmountPartial: 0.006,
    claimAmountDiff: 0.004,
  });
}

const MOCK_WALLET = {
  segwitAddress: 'tb1qsegwit',
  segwitPubkey: 'segwit-pubkey',
  taprootAddress: 'tb1ptaproot',
  taprootPubkey: 'taproot-pubkey',
};

const MOCK_VAULT_DATA = {
  vaultInfo: {
    creation_account: 'acct-001',
    guard_pubkey: 'guard-pk-001',
    master_id: 'master-001',
  },
};

const DEFAULT_PARAMS = {
  wallet: MOCK_WALLET,
  vaultCollateral: 0.05,
  vaultDebt: 3_000,
  btcPrice: 80_000,
  vaultData: MOCK_VAULT_DATA,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLiquidationExecution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLiquidationFlowStore();
    resetPendingVaultTransactionStore();

    // Default: select one full vault
    mockSelectItems.mockReturnValue([makeFullVault()]);
    mockExecuteLiquidation.mockResolvedValue({ success: true, txid: 'abc123', vaultTxid: 'abc123' });
    mockRecomputePartial.mockResolvedValue(makePartialVault());
  });

  describe('execute', () => {
    describe('happy path — full vaults only', () => {
      it('should set step to processing at the start of execution', async () => {
        // Capture the step before resolve completes
        let stepDuringExecution = '';
        mockExecuteLiquidation.mockImplementation(async () => {
          stepDuringExecution = useLiquidationFlowStore.getState().currentStep;
          return { success: true, txid: 'abc123' };
        });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(stepDuringExecution).toBe('processing');
      });

      it('should set step to success on successful execution', async () => {
        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().currentStep).toBe('success');
      });

      it('should store the txid in the store on success', async () => {
        mockExecuteLiquidation.mockResolvedValue({ success: true, txid: 'mytxid123' });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().resultTxid).toBe('mytxid123');
      });

      it('should call executeLiquidation with wallet info and selected vaults', async () => {
        const vault = makeFullVault();
        mockSelectItems.mockReturnValue([vault]);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(mockExecuteLiquidation).toHaveBeenCalledWith(
          expect.objectContaining({
            liquidVaults: [vault],
            walletInfo: {
              segwitAddress: MOCK_WALLET.segwitAddress,
              segwitPubkey: MOCK_WALLET.segwitPubkey,
              taprootAddress: MOCK_WALLET.taprootAddress,
              taprootPubkey: MOCK_WALLET.taprootPubkey,
            },
            vaultPubkey: MOCK_WALLET.taprootPubkey,
            btcInVault: DEFAULT_PARAMS.vaultCollateral,
            unitDebt: DEFAULT_PARAMS.vaultDebt,
            vaultInfo: MOCK_VAULT_DATA.vaultInfo,
          }),
        );
      });

      it('should register a pending vault transaction when txid is returned', async () => {
        mockExecuteLiquidation.mockResolvedValue({ success: true, txid: 'pendingtx', vaultTxid: 'pendingtx' });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        const pending = usePendingVaultTransactionStore.getState().pendingTransaction;
        expect(pending).not.toBeNull();
        expect(pending!.txid).toBe('pendingtx');
        expect(pending!.action).toBe('repo');
        expect(pending!.vaultPubkey).toBe(MOCK_WALLET.taprootPubkey);
      });

      it('should compute deficitBtc as sum of claimAmountBtc for full vaults', async () => {
        const vault1 = makeFullVault({ claimAmountBtc: 0.005 });
        const vault2 = makeFullVault({ vaultId: 'vault-002', claimAmountBtc: 0.003 });
        mockSelectItems.mockReturnValue([vault1, vault2]);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        // deficitBtc = 0.005 + 0.003 = 0.008
        expect(mockExecuteLiquidation).toHaveBeenCalledWith(
          expect.objectContaining({ deficitAmountBtc: 0.008 }),
        );
      });

      it('should not register pending tx when txid is empty string', async () => {
        mockExecuteLiquidation.mockResolvedValue({ success: true, txid: '' });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(usePendingVaultTransactionStore.getState().pendingTransaction).toBeNull();
      });

      it('should work with null wallet (uses empty strings for addresses)', async () => {
        const params = { ...DEFAULT_PARAMS, wallet: null };
        const { result } = renderHook(() => useLiquidationExecution(params));

        await act(async () => {
          await result.current!.execute();
        });

        expect(mockExecuteLiquidation).toHaveBeenCalledWith(
          expect.objectContaining({
            walletInfo: {
              segwitAddress: '',
              segwitPubkey: '',
              taprootAddress: '',
              taprootPubkey: '',
            },
          }),
        );
      });
    });

    describe('empty selection error', () => {
      it('should set step to error when no vaults are selected', async () => {
        mockSelectItems.mockReturnValue([]);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().currentStep).toBe('error');
        expect(useLiquidationFlowStore.getState().error).toBe(
          'Investment amount too small to claim any vault.',
        );
      });

      it('should not call executeLiquidation when selection is empty', async () => {
        mockSelectItems.mockReturnValue([]);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(mockExecuteLiquidation).not.toHaveBeenCalled();
      });
    });

    describe('partial vault recomputation', () => {
      it('should call recomputePartialVaultProfile for a partial vault', async () => {
        const partialVault = makePartialVault();
        mockSelectItems.mockReturnValue([partialVault]);
        const recomputed = makeFullVault({ vaultId: 'vault-partial-recomputed' });
        mockRecomputePartial.mockResolvedValue(recomputed);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(mockRecomputePartial).toHaveBeenCalledWith(partialVault, 80_000);
      });

      it('should place the recomputed partial vault first in liquidVaults', async () => {
        const fullVault = makeFullVault({ vaultId: 'full-vault' });
        const partialVault = makePartialVault();
        // selectItemsForAmount returns both; partial is identified by claimAmountPartial
        mockSelectItems.mockReturnValue([fullVault, partialVault]);
        const recomputed = { ...partialVault, vaultId: 'recomputed-partial' } as LiquidVaultProfileWithMeta;
        mockRecomputePartial.mockResolvedValue(recomputed);

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        const call = mockExecuteLiquidation.mock.calls[0][0];
        expect(call.liquidVaults[0].vaultId).toBe('recomputed-partial');
      });

      it('should fall back to full vaults only when recompute throws', async () => {
        const fullVault = makeFullVault({ vaultId: 'full-vault' });
        const partialVault = makePartialVault();
        mockSelectItems.mockReturnValue([fullVault, partialVault]);
        mockRecomputePartial.mockRejectedValue(new Error('SDK error'));

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        // Should still proceed with claimedFull only
        const call = mockExecuteLiquidation.mock.calls[0][0];
        expect(call.liquidVaults).toEqual([fullVault]);
      });

      it('should use btcPrice=0 for recompute when btcPrice is null', async () => {
        const partialVault = makePartialVault();
        mockSelectItems.mockReturnValue([partialVault]);

        const params = { ...DEFAULT_PARAMS, btcPrice: null };
        const { result } = renderHook(() => useLiquidationExecution(params));

        await act(async () => {
          await result.current!.execute();
        });

        expect(mockRecomputePartial).toHaveBeenCalledWith(partialVault, 0);
      });

      it('should use claimAmountPartial for deficitBtc when partial vault is present', async () => {
        const partialVault = makePartialVault(); // claimAmountPartial=0.006, claimAmountBtc=0.010
        mockSelectItems.mockReturnValue([partialVault]);
        mockRecomputePartial.mockResolvedValue({ ...partialVault, vaultId: 'recomputed' });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        // deficitBtc uses claimAmountPartial (0.006) not claimAmountBtc (0.010)
        expect(mockExecuteLiquidation).toHaveBeenCalledWith(
          expect.objectContaining({ deficitAmountBtc: 0.006 }),
        );
      });
    });

    describe('executeLiquidation failure', () => {
      it('should set step to error when executeLiquidation returns success=false', async () => {
        mockExecuteLiquidation.mockResolvedValue({ success: false, error: 'Insufficient funds' });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().currentStep).toBe('error');
        expect(useLiquidationFlowStore.getState().error).toBe('Insufficient funds');
      });

      it('should use default error message when result.error is undefined', async () => {
        mockExecuteLiquidation.mockResolvedValue({ success: false });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().error).toBe('Liquidation failed');
      });

      it('should set step to error when executeLiquidation throws', async () => {
        mockExecuteLiquidation.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().currentStep).toBe('error');
        expect(useLiquidationFlowStore.getState().error).toBe('Network error');
      });

      it('should handle non-Error thrown values', async () => {
        mockExecuteLiquidation.mockRejectedValue('plain string error');

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(useLiquidationFlowStore.getState().currentStep).toBe('error');
        expect(useLiquidationFlowStore.getState().error).toBe('Liquidation failed');
      });
    });

    describe('processing message updates', () => {
      it('should set processing message to "Connecting to oracle..." at start', async () => {
        let capturedMsg = '';
        mockExecuteLiquidation.mockImplementation(async () => {
          capturedMsg = useLiquidationFlowStore.getState().processingMessage;
          return { success: true, txid: 'abc' };
        });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        expect(capturedMsg).toBe('Connecting to oracle...');
      });

      it('should forward onProgress messages from executeLiquidation to the store', async () => {
        mockExecuteLiquidation.mockImplementation(async ({ onProgress }: { onProgress?: (msg: string) => void }) => {
          onProgress?.('Signing transaction...');
          return { success: true, txid: 'abc' };
        });

        const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

        await act(async () => {
          await result.current!.execute();
        });

        // The final state will be overwritten by success step, but we verify the callback was wired
        expect(mockExecuteLiquidation).toHaveBeenCalledWith(
          expect.objectContaining({ onProgress: expect.any(Function) }),
        );
      });
    });
  });

  describe('resetAfterSuccess', () => {
    it('should clear error, resultTxid, and investAmount', async () => {
      // Set some state first
      useLiquidationFlowStore.getState().setError('some error');
      useLiquidationFlowStore.getState().setResultTxid('some-txid');
      useLiquidationFlowStore.getState().setInvestAmount(0.05);

      const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

      act(() => {
        result.current!.resetAfterSuccess();
      });

      const state = useLiquidationFlowStore.getState();
      expect(state.error).toBeNull();
      expect(state.resultTxid).toBeNull();
      expect(state.investAmount).toBe(0);
    });

    it('should not change the current step', async () => {
      useLiquidationFlowStore.getState().setCurrentStep('success');

      const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

      act(() => {
        result.current!.resetAfterSuccess();
      });

      // resetAfterSuccess does not navigate away — that is the caller's responsibility
      expect(useLiquidationFlowStore.getState().currentStep).toBe('success');
    });
  });

  describe('resetAfterError', () => {
    it('should return step to input and clear error and resultTxid', () => {
      useLiquidationFlowStore.getState().setCurrentStep('error');
      useLiquidationFlowStore.getState().setError('something went wrong');
      useLiquidationFlowStore.getState().setResultTxid('failed-txid');

      const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

      act(() => {
        result.current!.resetAfterError();
      });

      const state = useLiquidationFlowStore.getState();
      expect(state.currentStep).toBe('input');
      expect(state.error).toBeNull();
      expect(state.resultTxid).toBeNull();
    });
  });

  describe('return shape', () => {
    it('should expose execute, resetAfterSuccess, resetAfterError', () => {
      const { result } = renderHook(() => useLiquidationExecution(DEFAULT_PARAMS));

      expect(typeof result.current!.execute).toBe('function');
      expect(typeof result.current!.resetAfterSuccess).toBe('function');
      expect(typeof result.current!.resetAfterError).toBe('function');
    });
  });
});
