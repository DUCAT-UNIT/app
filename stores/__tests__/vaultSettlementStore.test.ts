import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import {
  initialVaultSettlementState,
  normalizeVaultSettlementPersistedState,
  persistVaultSettlementNow,
  resetVaultSettlementStore,
  shouldPreserveVaultSettlementRecovery,
  VAULT_SETTLEMENT_ACTIVE_TTL_MS,
  useVaultSettlementStore,
  VAULT_SETTLEMENT_PERSIST_TTL_MS,
  VAULT_SETTLEMENT_STORAGE_KEY,
} from '../vaultSettlementStore';

const getPersistedSettlementState = () => {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([key]) => key === VAULT_SETTLEMENT_STORAGE_KEY
  );
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][1]);
};

describe('vaultSettlementStore', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    resetVaultSettlementStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with an idle settlement state', () => {
    expect(useVaultSettlementStore.getState()).toMatchObject(initialVaultSettlementState);
  });

  it('persists bridge settlement identifiers needed after restart', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('open', 100, 'USDC');
      state.setQuote('99.50', '98.00');
      state.setIssueResult('issue-txid-1', 'vault-txid-1');
      state.setBridgeClientRequestId('client-request-1');
      state.setBridgeIntent('bridge-intent-1', 'tb1pbridgeaddress');
      state.setBridgeSendTxid('bridge-send-txid-1');
      state.markPendingSettlement('Bridge settlement is still processing.');
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'open',
      phase: 'pending_settlement',
      faceValueUsd: 100,
      estimatedUsdcOut: '99.50',
      minimumUsdcOut: '98.00',
      issueTxid: 'issue-txid-1',
      vaultTxid: 'vault-txid-1',
      bridgeClientRequestId: 'client-request-1',
      bridgeIntentId: 'bridge-intent-1',
      bridgeDepositAddress: 'tb1pbridgeaddress',
      bridgeSendTxid: 'bridge-send-txid-1',
      error: 'Bridge settlement is still processing.',
      updatedAt: now,
    });

    const persisted = getPersistedSettlementState();
    expect(persisted.version).toBe(1);
    expect(persisted.state).toMatchObject({
      kind: 'open',
      phase: 'pending_settlement',
      bridgeClientRequestId: 'client-request-1',
      bridgeIntentId: 'bridge-intent-1',
      bridgeDepositAddress: 'tb1pbridgeaddress',
      bridgeSendTxid: 'bridge-send-txid-1',
      updatedAt: now,
    });
    expect(persisted.state.startOperation).toBeUndefined();
  });

  it('persists redemption identifiers for repay recovery', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 42, 'USDC');
      state.setRepayQuote('43.10', '0.002');
      state.setRedemptionResult('redemption-1', '0xburntx');
      state.setPhase('waiting_redemption_release');
    });

    const persisted = getPersistedSettlementState();
    expect(persisted.state).toMatchObject({
      kind: 'repay',
      phase: 'waiting_redemption_release',
      faceValueUsd: 42,
      requiredUsdcIn: '43.10',
      estimatedSepoliaFeeEth: '0.002',
      redemptionId: 'redemption-1',
      redemptionBurnTxHash: '0xburntx',
      updatedAt: now,
    });
  });

  it('persists the Cashu mint quote amount for TurboUNIT settlement recovery', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('borrow', 50, 'TURBOUNIT');
      state.setCashuMintQuote('cashu-quote-1', 'tb1pmint', 5050);
      state.setPhase('building_turbo_send');
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      cashuMintQuoteId: 'cashu-quote-1',
      cashuMintDepositAddress: 'tb1pmint',
      cashuMintQuoteAmount: 5050,
    });

    const persisted = getPersistedSettlementState();
    expect(persisted.state).toMatchObject({
      cashuMintQuoteId: 'cashu-quote-1',
      cashuMintDepositAddress: 'tb1pmint',
      cashuMintQuoteAmount: 5050,
    });
  });

  it('can force a durable settlement write before external settlement work continues', async () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 42, 'USDC', {
        accountIndex: 3,
        taprootAddress: 'tb1prepay',
      });
      state.setRedemptionResult('release-durable', '0xburn');
      state.setPhase('waiting_redemption_release');
    });

    (AsyncStorage.setItem as jest.Mock).mockClear();

    await persistVaultSettlementNow();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      VAULT_SETTLEMENT_STORAGE_KEY,
      expect.stringContaining('release-durable')
    );
    const persisted = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(persisted).toMatchObject({
      version: 1,
      state: {
        accountIndex: 3,
        taprootAddress: 'tb1prepay',
        phase: 'waiting_redemption_release',
        redemptionId: 'release-durable',
        redemptionBurnTxHash: '0xburn',
      },
    });
  });

  it('resets persisted state back to idle', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('borrow', 75, 'USDC');
      state.setBridgeIntent('intent-to-clear', 'tb1pdeposit');
      state.reset();
    });

    expect(useVaultSettlementStore.getState()).toMatchObject(initialVaultSettlementState);
    const persisted = getPersistedSettlementState();
    expect(persisted.state).toMatchObject({
      kind: null,
      phase: 'idle',
      bridgeClientRequestId: null,
      bridgeIntentId: null,
      redemptionId: null,
      updatedAt: 0,
    });
  });

  it('does not overwrite an active settlement on the same account', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('borrow', 75, 'USDC', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setBridgeIntent('intent-to-preserve', 'tb1pdeposit');
    });

    expect(() =>
      useVaultSettlementStore.getState().startOperation('repay', 25, 'USDC', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      })
    ).toThrow('A vault settlement is still pending. Resume or reset it before starting another.');

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'borrow',
      phase: 'quoting',
      bridgeIntentId: 'intent-to-preserve',
    });
  });

  it('allows a new operation after a payout completed even if the phase is stale', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('open', 75, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setPhase('waiting_turbo_mint');
      state.completeSettlement('TURBOUNIT', '75.00');
      state.setPhase('waiting_turbo_mint');
    });

    act(() => {
      useVaultSettlementStore.getState().startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'repay',
      phase: 'quoting',
      faceValueUsd: 25,
      requestedPayoutAsset: 'TURBOUNIT',
    });
  });

  it('allows a new operation over a needs-retry record with no recovery handle', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.markNeedsRetry('Quote failed before a recoverable transaction was created.');
    });

    act(() => {
      useVaultSettlementStore.getState().startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'repay',
      phase: 'quoting',
      faceValueUsd: 25,
      requestedPayoutAsset: 'TURBOUNIT',
      error: null,
    });
  });

  it('allows a new operation to replace transient pre-issue state', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('open', 75, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setPhase('issuing_vault');
    });

    act(() => {
      useVaultSettlementStore.getState().startOperation('open', 90, 'UNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'open',
      phase: 'quoting',
      faceValueUsd: 90,
      requestedPayoutAsset: 'UNIT',
      issueTxid: null,
    });
  });

  it('preserves active state when resuming the same settlement', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setCashuMeltQuote('melt-quote-to-preserve');
      state.setPhase('melting_turbo_repay');
    });

    act(() => {
      useVaultSettlementStore.getState().startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'repay',
      phase: 'melting_turbo_repay',
      cashuMeltQuoteId: 'melt-quote-to-preserve',
    });
  });

  it('blocks a recoverable same-kind settlement when the display amount changed', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setCashuMeltQuote('melt-quote-to-resume');
      state.setPhase('needs_retry');
    });

    expect(() =>
      useVaultSettlementStore.getState().startOperation('repay', 24.99, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      })
    ).toThrow('A vault settlement is still pending. Resume or reset it before starting another.');

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'repay',
      phase: 'needs_retry',
      faceValueUsd: 25,
      cashuMeltQuoteId: 'melt-quote-to-resume',
    });
  });

  it('auto-clears active settlement state after three minutes', () => {
    act(() => {
      const state = useVaultSettlementStore.getState();
      state.startOperation('repay', 25, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
      state.setCashuMeltQuote('stale-melt-quote');
      state.setPhase('waiting_turbo_release');
    });

    jest.setSystemTime(now + VAULT_SETTLEMENT_ACTIVE_TTL_MS + 1);

    act(() => {
      useVaultSettlementStore.getState().startOperation('repay', 24.99, 'TURBOUNIT', {
        accountIndex: 0,
        taprootAddress: 'tb1paccount',
      });
    });

    expect(useVaultSettlementStore.getState()).toMatchObject({
      kind: 'repay',
      phase: 'quoting',
      faceValueUsd: 24.99,
      cashuMeltQuoteId: null,
    });
  });

  it('classifies active settlement phases as recovery records that success screens must keep', () => {
    expect(shouldPreserveVaultSettlementRecovery('idle')).toBe(false);
    expect(shouldPreserveVaultSettlementRecovery('settled')).toBe(false);
    expect(shouldPreserveVaultSettlementRecovery('pending_settlement')).toBe(true);
    expect(shouldPreserveVaultSettlementRecovery('needs_retry')).toBe(true);
    expect(shouldPreserveVaultSettlementRecovery('waiting_bridge_fulfillment')).toBe(true);
    expect(shouldPreserveVaultSettlementRecovery('waiting_turbo_mint')).toBe(true);
  });

  describe('normalizeVaultSettlementPersistedState', () => {
    it('keeps fresh bridge and redemption recovery fields', () => {
      const state = normalizeVaultSettlementPersistedState(
        {
          kind: 'repay',
          phase: 'waiting_redemption_release',
          faceValueUsd: 125,
          requestedPayoutAsset: 'UNIT',
          requiredUsdcIn: '126.5',
          estimatedSepoliaFeeEth: '0.001',
          bridgeIntentId: 'ignored-for-repay-but-safe',
          bridgeClientRequestId: 'client-request-2',
          cashuMintQuoteAmount: 5050,
          redemptionId: 'redemption-2',
          redemptionBurnTxHash: '0xabc',
          payoutAsset: 'wUNIT',
          payoutAmount: '125',
          updatedAt: now - 1000,
        },
        now
      );

      expect(state).toMatchObject({
        kind: 'repay',
        phase: 'waiting_redemption_release',
        faceValueUsd: 125,
        requestedPayoutAsset: 'UNIT',
        requiredUsdcIn: '126.5',
        estimatedSepoliaFeeEth: '0.001',
        redemptionId: 'redemption-2',
        bridgeClientRequestId: 'client-request-2',
        cashuMintQuoteAmount: 5050,
        redemptionBurnTxHash: '0xabc',
        payoutAsset: 'wUNIT',
        payoutAmount: '125',
        updatedAt: now - 1000,
      });
    });

    it('drops stale active recovery state and stale terminal state', () => {
      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'open',
            phase: 'waiting_bridge_fulfillment',
            bridgeIntentId: 'stale-intent',
            updatedAt: now - VAULT_SETTLEMENT_PERSIST_TTL_MS - 1,
          },
          now
        )
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'open',
            phase: 'settled',
            bridgeIntentId: 'settled-intent',
            updatedAt: now - VAULT_SETTLEMENT_PERSIST_TTL_MS - 1,
          },
          now
        )
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState(
          { kind: 'open', phase: 'not-a-phase', updatedAt: now },
          now
        )
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState({ phase: 'pending_settlement', updatedAt: now }, now)
      ).toEqual(initialVaultSettlementState);
    });

    it('drops transient pre-issue state without an issue transaction', () => {
      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'open',
            phase: 'issuing_vault',
            faceValueUsd: 100,
            requestedPayoutAsset: 'TURBOUNIT',
            updatedAt: now - 1000,
          },
          now
        )
      ).toEqual(initialVaultSettlementState);
    });

    it('drops retry state without a recovery handle', () => {
      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'repay',
            phase: 'needs_retry',
            faceValueUsd: 25,
            requestedPayoutAsset: 'TURBOUNIT',
            error: 'Unable to create TurboUNIT melt quote.',
            updatedAt: now - 1000,
          },
          now
        )
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'repay',
            phase: 'needs_retry',
            faceValueUsd: 25,
            requestedPayoutAsset: 'TURBOUNIT',
            cashuMeltQuoteId: 'melt-quote-1',
            error: 'Retry TurboUNIT melt.',
            updatedAt: now - 1000,
          },
          now
        )
      ).toMatchObject({
        kind: 'repay',
        phase: 'needs_retry',
        cashuMeltQuoteId: 'melt-quote-1',
      });
    });

    it('clamps impossible future timestamps during rehydrate', () => {
      const state = normalizeVaultSettlementPersistedState(
        {
          kind: 'open',
          phase: 'pending_settlement',
          bridgeIntentId: 'intent-1',
          updatedAt: now + 120_000,
        },
        now
      );

      expect(state.updatedAt).toBe(now);
    });
  });
});
