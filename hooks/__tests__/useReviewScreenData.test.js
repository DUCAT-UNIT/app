/**
 * Tests for useReviewScreenData hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useReviewScreenData } from '../useReviewScreenData';

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return {
    result,
    rerender: () => {
      act(() => {
        component.update(<TestComponent />);
      });
    },
    unmount: () => component.unmount(),
  };
}
import * as psbtService from '../../services/psbtService';
import * as TransactionBuildContext from '../../contexts/TransactionBuildContext';
import * as PriceContext from '../../contexts/PriceContext';

// Mock contexts
jest.mock('../../contexts/TransactionBuildContext', () => ({
  useTransactionBuild: jest.fn(),
}));

jest.mock('../../contexts/PriceContext', () => ({
  usePrice: jest.fn(),
}));

// Mock psbtService
jest.mock('../../services/psbtService');

describe('useReviewScreenData', () => {
  const mockSendIntent = {
    assetType: 'BTC',
    amount: 100000,
    amountBTC: '0.001',
    recipient: 'tb1qrecipient123',
    psbt: 'mock_psbt_base64',
    inputs: [{ value: 150000, status: { confirmed: true } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: mockSendIntent,
    });

    PriceContext.usePrice.mockReturnValue({
      btcPrice: 50000,
    });

    psbtService.parsePSBT.mockReturnValue({
      psbtInputs: [{ value: 150000, address: 'tb1qsource', type: 'btc' }],
      psbtOutputs: [
        { value: 100000, address: 'tb1qrecipient123', type: 'recipient' },
        { value: 49000, address: 'tb1qsource', type: 'change' },
      ],
      actualFee: 1000,
    });

    psbtService.buildFallbackOutputs.mockReturnValue([
      { value: 100000, address: 'tb1qrecipient123', type: 'recipient' },
    ]);

    psbtService.hasUnconfirmedInputs.mockReturnValue(false);
  });

  it('should return initial state correctly', () => {
    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.sendIntent).toBeDefined();
    expect(result.current.btcPrice).toBe(50000);
    expect(result.current.isDetailsExpanded).toBe(false);
  });

  it('should calculate BTC display amount correctly', () => {
    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.displayAmount).toBe('0.001 BTC');
  });

  it('should calculate BTC USD amount correctly', () => {
    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.usdAmount).toBe('50.00');
  });

  it('should calculate UNIT display amount correctly', () => {
    const unitIntent = {
      ...mockSendIntent,
      assetType: 'UNIT',
      amount: 10000,
    };

    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: unitIntent,
    });

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.displayAmount).toBe('100.00 UNIT');
  });

  it('should calculate UNIT USD amount correctly', () => {
    const unitIntent = {
      ...mockSendIntent,
      assetType: 'UNIT',
      amount: 10000,
    };

    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: unitIntent,
    });

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.usdAmount).toBe('100.00');
  });

  it('should toggle details expanded state', () => {
    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.isDetailsExpanded).toBe(false);

    act(() => {
      result.current.setIsDetailsExpanded(true);
    });

    expect(result.current.isDetailsExpanded).toBe(true);
  });

  it('should parse PSBT and return inputs/outputs', () => {
    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.psbtInputs).toHaveLength(1);
    expect(result.current.outputs).toHaveLength(2);
    expect(result.current.actualFee).toBe(1000);
  });

  it('should detect unconfirmed inputs', () => {
    psbtService.hasUnconfirmedInputs.mockReturnValue(true);

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.hasUnconfirmedInputs).toBe(true);
  });

  it('should set rune UTXO balance for UNIT transactions', () => {
    const unitIntent = {
      ...mockSendIntent,
      assetType: 'UNIT',
      runeUtxo: { runeAmount: 50000 },
    };

    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: unitIntent,
    });

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.runeUtxoBalance).toBe(50000);
  });

  it('should use fallback outputs if PSBT parsing fails', () => {
    psbtService.parsePSBT.mockReturnValue({
      psbtInputs: [],
      psbtOutputs: [], // Empty outputs
      actualFee: 0,
    });

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.outputs).toHaveLength(1);
    expect(result.current.outputs[0].type).toBe('recipient');
  });

  it('should handle null sendIntent', () => {
    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: null,
    });

    const { result } = renderHook(() => useReviewScreenData());

    expect(result.current.sendIntent).toBeNull();
    expect(result.current.displayAmount).toBe('');
    expect(result.current.usdAmount).toBe('0.00');
  });

  it('should recalculate when sendIntent changes', () => {
    const { result, rerender } = renderHook(() => useReviewScreenData());

    expect(result.current.displayAmount).toBe('0.001 BTC');

    const newIntent = {
      ...mockSendIntent,
      amount: 200000,
      amountBTC: '0.002',
    };

    TransactionBuildContext.useTransactionBuild.mockReturnValue({
      sendIntent: newIntent,
    });

    rerender();

    expect(result.current.displayAmount).toBe('0.002 BTC');
  });

  it('should recalculate USD amount when BTC price changes', () => {
    const { result, rerender } = renderHook(() => useReviewScreenData());

    expect(result.current.usdAmount).toBe('50.00');

    PriceContext.usePrice.mockReturnValue({
      btcPrice: 60000,
    });

    rerender();

    expect(result.current.usdAmount).toBe('60.00');
  });
});
