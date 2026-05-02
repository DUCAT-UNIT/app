import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import {
  initialVaultSettlementState,
  normalizeVaultSettlementPersistedState,
  resetVaultSettlementStore,
  useVaultSettlementStore,
  VAULT_SETTLEMENT_PERSIST_TTL_MS,
  VAULT_SETTLEMENT_STORAGE_KEY,
} from '../vaultSettlementStore';

const getPersistedSettlementState = () => {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([key]) => key === VAULT_SETTLEMENT_STORAGE_KEY,
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
          redemptionId: 'redemption-2',
          redemptionBurnTxHash: '0xabc',
          payoutAsset: 'wUNIT',
          payoutAmount: '125',
          updatedAt: now - 1000,
        },
        now,
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
        redemptionBurnTxHash: '0xabc',
        payoutAsset: 'wUNIT',
        payoutAmount: '125',
        updatedAt: now - 1000,
      });
    });

    it('drops stale or malformed persisted settlement state', () => {
      expect(
        normalizeVaultSettlementPersistedState(
          {
            kind: 'open',
            phase: 'waiting_bridge_fulfillment',
            bridgeIntentId: 'stale-intent',
            updatedAt: now - VAULT_SETTLEMENT_PERSIST_TTL_MS - 1,
          },
          now,
        ),
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState({ kind: 'open', phase: 'not-a-phase', updatedAt: now }, now),
      ).toEqual(initialVaultSettlementState);

      expect(
        normalizeVaultSettlementPersistedState({ phase: 'pending_settlement', updatedAt: now }, now),
      ).toEqual(initialVaultSettlementState);
    });

    it('clamps impossible future timestamps during rehydrate', () => {
      const state = normalizeVaultSettlementPersistedState(
        {
          kind: 'open',
          phase: 'pending_settlement',
          bridgeIntentId: 'intent-1',
          updatedAt: now + 120_000,
        },
        now,
      );

      expect(state.updatedAt).toBe(now);
    });
  });
});
