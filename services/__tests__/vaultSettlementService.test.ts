import { getBridgeIntentByClientRequestId, getBridgeStatus, getRedemptionStatus } from '../bridgeApiService';
import {
  estimateUsdcToUnitSwapExecution,
  quoteUnitUsdcSwap,
  quoteUsdcForExactWunit,
} from '../evmBridgeService';
import {
  formatVaultSettlementAmountInput,
  getVaultSettlementStatusMessage,
  quoteVaultBorrowSettlement,
  quoteVaultRepaySettlement,
  refreshPersistedVaultSettlementStatus,
  waitForBridgeSettlement,
  waitForRedemptionRelease,
} from '../vaultSettlementService';
import { resetSwapDiagnosticsStore, useSwapDiagnosticsStore } from '../../stores/swapDiagnosticsStore';
import { resetVaultSettlementStore, useVaultSettlementStore } from '../../stores/vaultSettlementStore';

jest.mock('../bridgeApiService', () => ({
  getBridgeIntentByClientRequestId: jest.fn(),
  getBridgeStatus: jest.fn(),
  getRedemptionStatus: jest.fn(),
}));

jest.mock('../evmBridgeService', () => ({
  estimateUsdcToUnitSwapExecution: jest.fn(),
  quoteUnitUsdcSwap: jest.fn(),
  quoteUsdcForExactWunit: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('vaultSettlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    resetSwapDiagnosticsStore();
    resetVaultSettlementStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats USD amount inputs without unnecessary trailing zeros', () => {
    expect(formatVaultSettlementAmountInput(25)).toBe('25');
    expect(formatVaultSettlementAmountInput(25.5)).toBe('25.5');
    expect(formatVaultSettlementAmountInput(25.55)).toBe('25.55');
  });

  it('quotes borrow settlement using UNIT->USDC swap output', async () => {
    (quoteUnitUsdcSwap as jest.Mock).mockResolvedValue({
      amountOut: '24.75',
      minimumAmountOut: '24.50',
    });

    await expect(quoteVaultBorrowSettlement(25)).resolves.toEqual({
      estimatedUsdcOut: '24.75',
      minimumUsdcOut: '24.50',
    });
    expect(quoteUnitUsdcSwap).toHaveBeenCalledWith('UNIT', '25');
  });

  it('quotes repay settlement with exact wUNIT output and Sepolia gas estimate', async () => {
    (quoteUsdcForExactWunit as jest.Mock).mockResolvedValue('26.10');
    (estimateUsdcToUnitSwapExecution as jest.Mock).mockResolvedValue({
      totalFeeEth: '0.00042',
    });

    await expect(quoteVaultRepaySettlement(3, 25.5, 'tb1pdestination')).resolves.toEqual({
      requiredUsdcIn: '26.10',
      estimatedSepoliaFeeEth: '0.00042',
    });
    expect(quoteUsdcForExactWunit).toHaveBeenCalledWith('25.5');
    expect(estimateUsdcToUnitSwapExecution).toHaveBeenCalledWith(3, '26.10', 'tb1pdestination');
  });

  it('waits for bridge settlement through pending status to fulfillment', async () => {
    jest.useFakeTimers();
    (getBridgeStatus as jest.Mock)
      .mockResolvedValueOnce({
        id: 'intent-1',
        status: 'pending',
        autoSwap: true,
        confirmations: 0,
      })
      .mockResolvedValueOnce({
        id: 'intent-1',
        status: 'fulfilled',
        autoSwap: true,
        payoutAsset: 'USDC',
        payoutAmount: '25.00',
        sepoliaTxHash: '0xabc',
      });

    const promise = waitForBridgeSettlement('intent-1', 10_000);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toEqual(expect.objectContaining({
      status: 'fulfilled',
      payoutAsset: 'USDC',
    }));
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      id: 'bridge:intent-1',
      status: 'success',
      attempts: 2,
      lastStatus: 'fulfilled',
    });
  });

  it('returns failed bridge settlements and records the error state', async () => {
    (getBridgeStatus as jest.Mock).mockResolvedValue({
      id: 'intent-failed',
      status: 'failed',
      error: 'swap failed',
    });

    await expect(waitForBridgeSettlement('intent-failed', 1000)).resolves.toEqual(
      expect.objectContaining({ status: 'failed', error: 'swap failed' })
    );
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'error',
      lastError: 'swap failed',
    });
  });

  it('propagates bridge status fetch errors and marks diagnostics as failed', async () => {
    (getBridgeStatus as jest.Mock).mockRejectedValue(new Error('bridge offline'));

    await expect(waitForBridgeSettlement('intent-error', 1000)).rejects.toThrow('bridge offline');
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'error',
      lastError: 'bridge offline',
    });
  });

  it('times out bridge settlement polling without spinning indefinitely', async () => {
    await expect(waitForBridgeSettlement('intent-timeout', 0)).rejects.toThrow(
      'Bridge settlement is still processing.'
    );
    expect(getBridgeStatus).not.toHaveBeenCalled();
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'timeout',
    });
  });

  it('waits for redemption release terminal states', async () => {
    (getRedemptionStatus as jest.Mock)
      .mockResolvedValueOnce({
        id: 'redemption-1',
        status: 'released',
        sourceAsset: 'USDC',
        amount: '25',
        releaseTxid: 'mutiny-txid',
      })
      .mockResolvedValueOnce({
        id: 'redemption-2',
        status: 'failed',
        sourceAsset: 'wUNIT',
        amount: '10',
        error: 'burn failed',
      });

    await expect(waitForRedemptionRelease('redemption-1', 1000)).resolves.toEqual(
      expect.objectContaining({ status: 'released', releaseTxid: 'mutiny-txid' })
    );
    await expect(waitForRedemptionRelease('redemption-2', 1000)).resolves.toEqual(
      expect.objectContaining({ status: 'failed', error: 'burn failed' })
    );

    expect(useSwapDiagnosticsStore.getState().polls).toEqual([
      expect.objectContaining({ id: 'redemption:redemption-2', status: 'error' }),
      expect.objectContaining({ id: 'redemption:redemption-1', status: 'success' }),
    ]);
  });

  it('propagates redemption status fetch errors and marks diagnostics as failed', async () => {
    (getRedemptionStatus as jest.Mock).mockRejectedValue(new Error('redemption api offline'));

    await expect(waitForRedemptionRelease('redemption-error', 1000)).rejects.toThrow(
      'redemption api offline',
    );
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      id: 'redemption:redemption-error',
      status: 'error',
      lastError: 'redemption api offline',
    });
  });

  it('times out redemption release polling without making an unnecessary status request', async () => {
    await expect(waitForRedemptionRelease('redemption-timeout', 0)).rejects.toThrow(
      'Released UNIT is still processing.',
    );
    expect(getRedemptionStatus).not.toHaveBeenCalled();
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      id: 'redemption:redemption-timeout',
      status: 'timeout',
    });
  });

  it('refreshes a persisted fulfilled bridge settlement and completes store state', async () => {
    useVaultSettlementStore.getState().startOperation('open', 100, 'USDC');
    useVaultSettlementStore.getState().setBridgeIntent('intent-complete', 'tb1pdeposit');
    (getBridgeStatus as jest.Mock).mockResolvedValue({
      id: 'intent-complete',
      status: 'fulfilled',
      autoSwap: true,
      payoutAsset: 'USDC',
      payoutAmount: '99.25',
      sepoliaTxHash: '0xsettled',
    });

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'settled',
      message: 'Bridge settlement completed.',
      lastStatus: 'fulfilled',
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      phase: 'settled',
      payoutAsset: 'USDC',
      payoutAmount: '99.25',
      sepoliaTxHash: '0xsettled',
    });
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      kind: 'bridge_settlement',
      status: 'success',
      lastStatus: 'fulfilled',
      lastMessage: 'Bridge settlement completed',
    });
  });

  it('refreshes a pending bridge settlement without marking it failed', async () => {
    useVaultSettlementStore.getState().startOperation('borrow', 50, 'USDC');
    useVaultSettlementStore.getState().setBridgeIntent('intent-pending', 'tb1pdeposit');
    (getBridgeStatus as jest.Mock).mockResolvedValue({
      id: 'intent-pending',
      status: 'confirmed',
      autoSwap: true,
      confirmations: 1,
    });

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'pending',
      message: 'Bridge settlement is still processing.',
      lastStatus: 'confirmed',
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      phase: 'waiting_bridge_fulfillment',
      error: null,
    });
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'stopped',
      lastStatus: 'confirmed',
      lastMessage: 'Bridge settlement is still processing',
    });
  });

  it('recovers a persisted bridge intent by client request id after restart', async () => {
    useVaultSettlementStore.getState().startOperation('borrow', 50, 'USDC');
    useVaultSettlementStore.getState().setBridgeClientRequestId('client-request-1');
    (getBridgeIntentByClientRequestId as jest.Mock).mockResolvedValue({
      id: 'intent-from-client',
      status: 'fulfilled',
      autoSwap: true,
      depositAddress: 'tb1pdeposit',
      sepoliaRecipient: '0xrecipient',
      amount: '50',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
    });
    (getBridgeStatus as jest.Mock).mockResolvedValue({
      id: 'intent-from-client',
      status: 'fulfilled',
      autoSwap: true,
      payoutAsset: 'USDC',
      payoutAmount: '49.25',
      sepoliaTxHash: '0xsettled',
    });

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'settled',
      message: 'Bridge settlement completed.',
      lastStatus: 'fulfilled',
    });

    expect(getBridgeIntentByClientRequestId).toHaveBeenCalledWith('client-request-1');
    expect(getBridgeStatus).toHaveBeenCalledWith('intent-from-client');
    expect(useVaultSettlementStore.getState()).toMatchObject({
      bridgeClientRequestId: 'client-request-1',
      bridgeIntentId: 'intent-from-client',
      bridgeDepositAddress: 'tb1pdeposit',
      phase: 'settled',
      payoutAsset: 'USDC',
      payoutAmount: '49.25',
      sepoliaTxHash: '0xsettled',
    });
  });

  it('keeps client request id recovery pending while the bridge intent is not indexed yet', async () => {
    useVaultSettlementStore.getState().startOperation('open', 100, 'USDC');
    useVaultSettlementStore.getState().setBridgeClientRequestId('client-request-missing');
    (getBridgeIntentByClientRequestId as jest.Mock).mockResolvedValue(null);

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'pending',
      message: 'Bridge intent is not indexed by client request id yet.',
    });

    expect(getBridgeStatus).not.toHaveBeenCalled();
    expect(useVaultSettlementStore.getState()).toMatchObject({
      bridgeClientRequestId: 'client-request-missing',
      bridgeIntentId: null,
      phase: 'quoting',
      error: null,
    });
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      label: 'Bridge intent lookup refresh',
      status: 'stopped',
      lastMessage: 'Bridge intent is not indexed by client request id yet',
    });
  });

  it('refreshes a persisted released redemption and moves repay to the final raw repay phase', async () => {
    useVaultSettlementStore.getState().startOperation('repay', 25, 'USDC');
    useVaultSettlementStore.getState().setRedemptionResult('redemption-complete', '0xburn');
    (getRedemptionStatus as jest.Mock).mockResolvedValue({
      id: 'redemption-complete',
      status: 'released',
      sourceAsset: 'USDC',
      amount: '25',
      releaseTxid: 'mutiny-release',
    });

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'ready_to_repay',
      message: 'Released UNIT is ready. Return to the repay flow to finish vault repayment.',
      lastStatus: 'released',
    });

    expect(useVaultSettlementStore.getState().phase).toBe('repaying_vault');
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      kind: 'redemption_release',
      status: 'success',
      lastStatus: 'released',
    });
  });

  it('records refresh fetch errors without mutating settlement into needs_retry', async () => {
    useVaultSettlementStore.getState().startOperation('open', 100, 'USDC');
    useVaultSettlementStore.getState().setBridgeIntent('intent-error', 'tb1pdeposit');
    (getBridgeStatus as jest.Mock).mockRejectedValue(new Error('bridge api offline'));

    await expect(refreshPersistedVaultSettlementStatus()).resolves.toEqual({
      status: 'error',
      message: 'bridge api offline',
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      phase: 'quoting',
      bridgeIntentId: 'intent-error',
      error: null,
    });
    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'error',
      lastError: 'bridge api offline',
    });
  });

  it('returns phase-specific user status messages', () => {
    expect(getVaultSettlementStatusMessage('borrow', 'idle', 1)).toBe('Preparing transaction...');
    expect(getVaultSettlementStatusMessage('borrow', 'quoting', 2)).toBe('Connecting to network...');
    expect(getVaultSettlementStatusMessage('borrow', 'issuing_vault', 3)).toBe('Validating details...');
    expect(getVaultSettlementStatusMessage('open', 'idle', 4)).toBe('Finalizing vault creation...');
    expect(getVaultSettlementStatusMessage('repay', 'idle', 4)).toBe('Finalizing vault repay...');
    expect(getVaultSettlementStatusMessage('borrow', 'idle', 4)).toBe('Finalizing borrow...');
    expect(getVaultSettlementStatusMessage(null, 'idle', 99)).toBe('Processing...');
    expect(getVaultSettlementStatusMessage('borrow', 'creating_bridge', 1)).toBe('Preparing Sepolia settlement...');
    expect(getVaultSettlementStatusMessage('borrow', 'building_bridge_send', 1)).toBe('Preparing UNIT bridge send...');
    expect(getVaultSettlementStatusMessage('borrow', 'signing_bridge_send', 1)).toBe('Signing the bridge settlement...');
    expect(getVaultSettlementStatusMessage('borrow', 'broadcasting_bridge_send', 1)).toBe('Broadcasting the bridge send...');
    expect(getVaultSettlementStatusMessage('borrow', 'waiting_bridge_fulfillment', 1)).toBe('Waiting for Sepolia USDC settlement...');
    expect(getVaultSettlementStatusMessage('repay', 'swapping_repay', 1)).toBe('Swapping Sepolia USDC into UNIT on Sepolia...');
    expect(getVaultSettlementStatusMessage('repay', 'waiting_redemption_release', 1)).toBe('Waiting for released UNIT on Mutinynet...');
    expect(getVaultSettlementStatusMessage('repay', 'repaying_vault', 1)).toBe('Repaying the vault with released UNIT...');
    expect(getVaultSettlementStatusMessage('borrow', 'settled', 1)).toBe('Settlement complete.');
    expect(getVaultSettlementStatusMessage('borrow', 'pending_settlement', 1)).toBe('Settlement is still processing in the background.');
    expect(getVaultSettlementStatusMessage('borrow', 'needs_retry', 1)).toBe('Settlement needs retry.');
  });
});
