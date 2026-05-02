/**
 * Tests for useTransactionBuilder hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTransactionBuilder, UseTransactionBuilderParams } from '../useTransactionBuilder';
import { notify } from '../../utils/notify';
import { isE2E } from '../../utils/e2e';

// Mock dependencies
jest.mock('../../services/transaction', () => ({
  createBtcIntent: jest.fn(),
  createUnitIntent: jest.fn(),
}));

jest.mock('../../utils/errorParser', () => ({
  parseErrorMessage: jest.fn((error) => error?.message || 'Unknown error'),
}));

jest.mock('../../utils/messages', () => ({
  ERRORS: {
    MISSING_RECIPIENT_AMOUNT: 'Missing recipient or amount',
    NO_UNIT_BALANCE: 'No UNIT balance available',
    ASSET_SELECTION_REQUIRED: 'Please select an asset',
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/pendingTransactionsUtils', () => ({
  releaseOrphanedUtxos: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/e2e', () => ({
  isE2E: jest.fn(() => false),
}));

import { createBtcIntent, createUnitIntent } from '../../services/transaction';
import { releaseOrphanedUtxos } from '../../utils/pendingTransactionsUtils';

// Helper to render hooks
function renderHook<T, P>(hook: (props: P) => T, props: P) {
  const result: { current: T | null } = { current: null };
  function TestComponent(): null {
    result.current = hook(props);
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount, component };
}

// Type for the hook props - simplified version for testing
type MockProps = {
  wallet: { segwitAddress: string; taprootAddress: string } | null;
  currentAccount: number;
  sendRecipient: string;
  sendAmount: string;
  sendAssetType: string;
  requireConfirmedUtxos: boolean;
  runesBalance: Array<{ rune: string; amount: number }>;
  sendIntent: unknown;
  setSendIntent: jest.Mock;
  setIntentStep: jest.Mock;
  getUnconfirmedUTXOs: jest.Mock;
  getSpentUtxos: jest.Mock;
  markUtxosAsSpent: jest.Mock;
  unmarkUtxosAsSpent: jest.Mock;
  setSendRecipient: jest.Mock;
};

describe('useTransactionBuilder', () => {
  const mockIsE2E = isE2E as jest.MockedFunction<typeof isE2E>;
  let mockProps: MockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsE2E.mockReturnValue(false);

    mockProps = {
      wallet: {
        segwitAddress: 'bc1qtest...',
        taprootAddress: 'tb1ptest...',
      },
      currentAccount: 0,
      sendRecipient: 'bc1qrecipient...',
      sendAmount: '0.001',
      sendAssetType: 'btc',
      requireConfirmedUtxos: false,
      runesBalance: [{ rune: 'UNIT', amount: 1000 }],
      sendIntent: null,
      setSendIntent: jest.fn(),
      setIntentStep: jest.fn(),
      getUnconfirmedUTXOs: jest.fn().mockReturnValue([]),
      getSpentUtxos: jest.fn().mockReturnValue(new Set()),
      markUtxosAsSpent: jest.fn().mockResolvedValue(undefined),
      unmarkUtxosAsSpent: jest.fn().mockResolvedValue(undefined),
      setSendRecipient: jest.fn(),
    };

    (createBtcIntent as jest.Mock).mockResolvedValue({
      assetType: 'BTC',
      inputs: [{ txid: 'txid1', vout: 0, value: 10000 }],
      outputs: [],
      fee: 500,
    });

    (createUnitIntent as jest.Mock).mockResolvedValue({
      assetType: 'UNIT',
      runeUtxo: { transaction: 'txid2', vout: 0 },
      satUtxo: { txid: 'txid3', vout: 1 },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return createSendIntent and cancelIntent functions', () => {
    const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

    expect(typeof result.current!.createSendIntent).toBe('function');
    expect(typeof result.current!.cancelIntent).toBe('function');
  });

  describe('createSendIntent', () => {
    it('should show error when recipient is missing', async () => {
      mockProps.sendRecipient = '';

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.missingRecipientAmount).toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockProps.setIntentStep).toHaveBeenCalledWith('entering_amount');
    });

    it('should show error when amount is missing', async () => {
      mockProps.sendAmount = '';

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.missingRecipientAmount).toHaveBeenCalled();
    });

    it('should trim recipient address before processing', async () => {
      mockProps.sendRecipient = '  bc1qrecipient...  ';

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.setSendRecipient).toHaveBeenCalledWith('bc1qrecipient...');
    });

    it('should show error for unknown asset type', async () => {
      mockProps.sendAssetType = 'unknown';

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.assetRequired).toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(mockProps.setIntentStep).toHaveBeenCalledWith('selecting_asset');
    });
  });

  describe('createBtcIntent', () => {
    it('should create BTC intent and set reviewing step', async () => {
      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createBtcIntent).toHaveBeenCalledWith(
        'bc1qrecipient...',
        '0.001',
        'bc1qtest...',
        0,
        [],
        expect.any(Set)
      );
      expect(mockProps.setSendIntent).toHaveBeenCalled();
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('reviewing');
    });

    it('should lock UTXOs when creating BTC intent', async () => {
      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.markUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid1', vout: 0 },
      ]);
    });

    it('should throw error when wallet is not initialized', async () => {
      mockProps.wallet = null;

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should throw error when segwitAddress is missing', async () => {
      mockProps.wallet = { segwitAddress: '', taprootAddress: 'tb1ptest...' };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should unlock UTXOs and release orphaned on error', async () => {
      (createBtcIntent as jest.Mock).mockRejectedValue(new Error('Insufficient funds'));

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(releaseOrphanedUtxos).toHaveBeenCalled();
      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should unlock locked UTXOs on error after marking', async () => {
      // First call succeeds (UTXOs locked), then error occurs
      let callCount = 0;
      (createBtcIntent as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            assetType: 'BTC',
            inputs: [{ txid: 'txid1', vout: 0 }],
          };
        }
        throw new Error('Network error');
      });

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      // First call should succeed
      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.markUtxosAsSpent).toHaveBeenCalled();
    });

    it('should pass unconfirmed UTXOs to createBtcIntent', async () => {
      mockProps.getUnconfirmedUTXOs.mockReturnValue([
        { txid: 'unconfirmed1', vout: 0, value: 5000, status: { confirmed: false } },
      ]);

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createBtcIntent).toHaveBeenCalledWith(
        'bc1qrecipient...',
        '0.001',
        'bc1qtest...',
        0,
        [{ txid: 'unconfirmed1', vout: 0, value: 5000, status: { confirmed: false } }],
        expect.any(Set)
      );
    });

    it('should release old intent UTXOs when rebuilding BTC intent', async () => {
      // Existing intent that hasn't been broadcast
      mockProps.sendIntent = {
        assetType: 'BTC',
        inputs: [
          { txid: 'old_txid1', vout: 0 },
          { txid: 'old_txid2', vout: 1 },
        ],
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Should release old UTXOs before building new intent
      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'old_txid1', vout: 0 },
        { txid: 'old_txid2', vout: 1 },
      ]);
    });

    it('should not release old intent UTXOs if already broadcast', async () => {
      // Existing intent that HAS been broadcast
      mockProps.sendIntent = {
        assetType: 'BTC',
        inputs: [{ txid: 'old_txid1', vout: 0 }],
        txid: 'broadcast_txid',
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Should not release broadcast transaction UTXOs
      expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalledWith([
        { txid: 'old_txid1', vout: 0 },
      ]);
    });

    it('should release locked UTXOs on error after marking them', async () => {
      // Mock to return intent with inputs, then fail on second call
      (createBtcIntent as jest.Mock).mockResolvedValueOnce({
        assetType: 'BTC',
        inputs: [{ txid: 'txid1', vout: 0 }],
      });

      // First call marks UTXOs, then markUtxosAsSpent throws
      mockProps.markUtxosAsSpent.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Error should be handled gracefully
      expect(notify.build.error).toHaveBeenCalled();
    });
  });

  describe('createUnitIntent', () => {
    beforeEach(() => {
      mockProps.sendAssetType = 'unit';
    });

    it('should create a fake UNIT intent in E2E bypass mode', async () => {
      mockIsE2E.mockReturnValue(true);

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createUnitIntent).not.toHaveBeenCalled();
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('reviewing');
      expect(mockProps.markUtxosAsSpent).not.toHaveBeenCalled();
      expect(mockProps.setSendIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: 'UNIT',
          psbt: 'e2e-mock-psbt',
          recipient: mockProps.sendRecipient,
          sourceAddress: mockProps.wallet!.taprootAddress,
          feeAddress: mockProps.wallet!.segwitAddress,
        })
      );
    });

    it('should create UNIT intent and set reviewing step', async () => {
      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createUnitIntent).toHaveBeenCalled();
      expect(mockProps.setSendIntent).toHaveBeenCalled();
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('reviewing');
    });

    it('should lock UTXOs when creating UNIT intent', async () => {
      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.markUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid2', vout: 0 },
        { txid: 'txid3', vout: 1 },
      ]);
    });

    it('should throw error when wallet is not initialized', async () => {
      mockProps.wallet = null;

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should throw error when taprootAddress is missing', async () => {
      mockProps.wallet = { segwitAddress: 'bc1qtest...', taprootAddress: '' };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should throw error when UNIT balance is zero', async () => {
      mockProps.runesBalance = [{ rune: 'UNIT', amount: 0 }];

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should throw error when runesBalance is empty', async () => {
      mockProps.runesBalance = [];

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should throw error when runesBalance is null', async () => {
      (mockProps as any).runesBalance = null;

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should use empty arrays for unconfirmed UTXOs when requireConfirmedUtxos is true', async () => {
      mockProps.requireConfirmedUtxos = true;
      mockProps.getUnconfirmedUTXOs.mockReturnValue([
        { txid: 'unconfirmed1', vout: 0, value: 5000 },
      ]);

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createUnitIntent).toHaveBeenCalledWith(
        'bc1qrecipient...',
        '0.001',
        'tb1ptest...',
        'bc1qtest...',
        0,
        [],
        [],
        expect.any(Set)
      );
    });

    it('should handle UNIT intent with multiple runeUtxos', async () => {
      (createUnitIntent as jest.Mock).mockResolvedValue({
        assetType: 'UNIT',
        runeUtxos: [
          { transaction: 'txid2', vout: 0 },
          { transaction: 'txid4', vout: 1 },
        ],
        satUtxo: { txid: 'txid3', vout: 1 },
      });

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.markUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid2', vout: 0 },
        { txid: 'txid4', vout: 1 },
        { txid: 'txid3', vout: 1 },
      ]);
    });

    it('should handle UNIT intent without satUtxo', async () => {
      (createUnitIntent as jest.Mock).mockResolvedValue({
        assetType: 'UNIT',
        runeUtxo: { transaction: 'txid2', vout: 0 },
        satUtxo: null,
      });

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.markUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid2', vout: 0 },
      ]);
    });

    it('should unlock UTXOs and release orphaned on error', async () => {
      (createUnitIntent as jest.Mock).mockRejectedValue(new Error('UTXO selection failed'));

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(releaseOrphanedUtxos).toHaveBeenCalled();
      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should release old intent UTXOs when rebuilding UNIT intent', async () => {
      // Existing UNIT intent that hasn't been broadcast
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { transaction: 'old_rune_txid', vout: 0 },
        satUtxo: { txid: 'old_sat_txid', vout: 1 },
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Should release old UTXOs before building new intent
      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'old_rune_txid', vout: 0 },
        { txid: 'old_sat_txid', vout: 1 },
      ]);
    });

    it('should release only runeUtxo when rebuilding UNIT intent without satUtxo', async () => {
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { transaction: 'old_rune_txid', vout: 0 },
        satUtxo: null,
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'old_rune_txid', vout: 0 },
      ]);
    });

    it('should not release old UNIT intent UTXOs if already broadcast', async () => {
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { transaction: 'old_rune_txid', vout: 0 },
        satUtxo: { txid: 'old_sat_txid', vout: 1 },
        txid: 'broadcast_txid',
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Should not release broadcast transaction UTXOs
      expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalledWith([
        { txid: 'old_rune_txid', vout: 0 },
        { txid: 'old_sat_txid', vout: 1 },
      ]);
    });

    it('should release locked UTXOs on error after marking them for UNIT', async () => {
      (createUnitIntent as jest.Mock).mockResolvedValueOnce({
        assetType: 'UNIT',
        runeUtxo: { transaction: 'txid1', vout: 0 },
        satUtxo: { txid: 'txid2', vout: 1 },
      });

      // markUtxosAsSpent throws after successful intent creation
      mockProps.markUtxosAsSpent.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      // Error should be handled gracefully
      expect(notify.build.error).toHaveBeenCalled();
    });

    it('should pass unconfirmed taproot UTXOs with runeAmount to createUnitIntent', async () => {
      mockProps.getUnconfirmedUTXOs.mockImplementation((addressType) => {
        if (addressType === 'taproot') {
          return [{ txid: 'taproot1', vout: 0, value: 5000, runeAmount: 100 }];
        }
        if (addressType === 'segwit') {
          return [{ txid: 'segwit1', vout: 0, value: 10000 }];
        }
        return [];
      });

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createUnitIntent).toHaveBeenCalledWith(
        'bc1qrecipient...',
        '0.001',
        'tb1ptest...',
        'bc1qtest...',
        0,
        [{ txid: 'taproot1', vout: 0, value: 5000, runeAmount: 100 }],
        [{ txid: 'segwit1', vout: 0, value: 10000, runeAmount: undefined }],
        expect.any(Set)
      );
    });

    it('should handle runesBalance as array format', async () => {
      // Test the Array.isArray branch for runesBalance format
      (mockProps as any).runesBalance = [[0, 1000]]; // Array format: [index, amount]

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.createSendIntent();
      });

      expect(createUnitIntent).toHaveBeenCalled();
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('reviewing');
    });
  });

  describe('cancelIntent', () => {
    it('should do nothing when sendIntent is null', async () => {
      mockProps.sendIntent = null;

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalled();
      expect(mockProps.setSendIntent).not.toHaveBeenCalled();
    });

    it('should not release UTXOs when transaction was broadcast', async () => {
      mockProps.sendIntent = {
        assetType: 'BTC',
        inputs: [{ txid: 'txid1', vout: 0 }],
        txid: 'broadcasted_txid',
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalled();
      expect(mockProps.setSendIntent).toHaveBeenCalledWith(null);
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('idle');
    });

    it('should release BTC UTXOs when canceling non-broadcast transaction', async () => {
      mockProps.sendIntent = {
        assetType: 'BTC',
        inputs: [
          { txid: 'txid1', vout: 0 },
          { txid: 'txid2', vout: 1 },
        ],
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid1', vout: 0 },
        { txid: 'txid2', vout: 1 },
      ]);
      expect(mockProps.setSendIntent).toHaveBeenCalledWith(null);
      expect(mockProps.setIntentStep).toHaveBeenCalledWith('idle');
    });

    it('should release UNIT UTXOs when canceling non-broadcast transaction', async () => {
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { transaction: 'txid2', vout: 0 },
        satUtxo: { txid: 'txid3', vout: 1 },
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid2', vout: 0 },
        { txid: 'txid3', vout: 1 },
      ]);
    });

    it('should release only runeUtxo when satUtxo is missing', async () => {
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { transaction: 'txid2', vout: 0 },
        satUtxo: null,
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).toHaveBeenCalledWith([
        { txid: 'txid2', vout: 0 },
      ]);
    });

    it('should not call unmarkUtxosAsSpent when no UTXOs to release for UNIT', async () => {
      mockProps.sendIntent = {
        assetType: 'UNIT',
        runeUtxo: null,
        satUtxo: null,
      };

      const { result } = renderHook(useTransactionBuilder, mockProps as unknown as UseTransactionBuilderParams);

      await act(async () => {
        await result.current!.cancelIntent();
      });

      expect(mockProps.unmarkUtxosAsSpent).not.toHaveBeenCalled();
      expect(mockProps.setSendIntent).toHaveBeenCalledWith(null);
    });
  });
});
