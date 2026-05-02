import {
  MAX_UNIT_USDC_POOL_SNAPSHOTS,
  MAX_SWAP_DIAGNOSTIC_POLLS,
  resetSwapDiagnosticsStore,
  useSwapDiagnosticsStore,
} from '../swapDiagnosticsStore';

describe('swapDiagnosticsStore', () => {
  beforeEach(() => {
    resetSwapDiagnosticsStore();
  });

  it('starts a poll with bounded metadata', () => {
    const id = useSwapDiagnosticsStore.getState().startPoll({
      id: 'bridge:intent-1',
      kind: 'bridge_settlement',
      label: 'Bridge settlement',
      subject: 'intent-1',
      intervalMs: 4000,
      timeoutMs: 720000,
      metadata: {
        asset: 'USDC',
        ignored: undefined,
      },
    });

    const [poll] = useSwapDiagnosticsStore.getState().polls;
    expect(id).toBe('bridge:intent-1');
    expect(poll).toMatchObject({
      id: 'bridge:intent-1',
      kind: 'bridge_settlement',
      label: 'Bridge settlement',
      status: 'active',
      subject: 'intent-1',
      attempts: 0,
      intervalMs: 4000,
      timeoutMs: 720000,
      metadata: { asset: 'USDC' },
    });
    expect(poll.metadata).not.toHaveProperty('ignored');
  });

  it('records attempts and merges metadata', () => {
    useSwapDiagnosticsStore.getState().startPoll({
      id: 'tx:abc',
      kind: 'transaction_confirmation',
      label: 'Transaction confirmation',
      subject: 'abc',
    });

    useSwapDiagnosticsStore.getState().recordAttempt('tx:abc', {
      lastStatus: 'unconfirmed',
      metadata: { httpStatus: 200 },
    });
    useSwapDiagnosticsStore.getState().recordAttempt('tx:abc', {
      lastMessage: 'Still waiting',
      metadata: { confirmed: false },
    });

    const [poll] = useSwapDiagnosticsStore.getState().polls;
    expect(poll.attempts).toBe(2);
    expect(poll.lastStatus).toBe('unconfirmed');
    expect(poll.lastMessage).toBe('Still waiting');
    expect(poll.metadata).toEqual({ httpStatus: 200, confirmed: false });
  });

  it('completes and clears terminal polls', () => {
    useSwapDiagnosticsStore.getState().startPoll({
      id: 'liq:mempool',
      kind: 'liquidation_mempool',
      label: 'Liquidation mempool wait',
    });
    useSwapDiagnosticsStore.getState().completePoll('liq:mempool', {
      status: 'timeout',
      lastError: 'Not found',
    });

    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'timeout',
      lastError: 'Not found',
    });

    useSwapDiagnosticsStore.getState().clearCompleted();
    expect(useSwapDiagnosticsStore.getState().polls).toEqual([]);
  });

  it('does not overwrite a terminal poll when stopped during cleanup', () => {
    useSwapDiagnosticsStore.getState().startPoll({
      id: 'turbo',
      kind: 'turbo_token_processor',
      label: 'Turbo processor',
    });
    useSwapDiagnosticsStore.getState().completePoll('turbo', {
      status: 'success',
      lastMessage: 'Processed token',
    });
    useSwapDiagnosticsStore.getState().stopPoll('turbo');

    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'success',
      lastMessage: 'Processed token',
    });
  });

  it('ignores late attempts after a poll reaches a terminal state', () => {
    useSwapDiagnosticsStore.getState().startPoll({
      id: 'tx:late',
      kind: 'transaction_confirmation',
      label: 'Transaction confirmation',
    });
    useSwapDiagnosticsStore.getState().recordAttempt('tx:late', {
      lastStatus: 'unconfirmed',
    });
    useSwapDiagnosticsStore.getState().completePoll('tx:late', {
      status: 'timeout',
      lastStatus: 'unconfirmed',
      lastMessage: 'Timed out',
    });
    useSwapDiagnosticsStore.getState().recordAttempt('tx:late', {
      lastStatus: 'confirmed',
      lastMessage: 'Late confirmation',
    });

    expect(useSwapDiagnosticsStore.getState().polls[0]).toMatchObject({
      status: 'timeout',
      attempts: 1,
      lastStatus: 'unconfirmed',
      lastMessage: 'Timed out',
    });
  });

  it('keeps only the most recent diagnostic polls', () => {
    for (let i = 0; i < MAX_SWAP_DIAGNOSTIC_POLLS + 10; i++) {
      useSwapDiagnosticsStore.getState().startPoll({
        id: `poll:${i}`,
        kind: 'bridge_settlement',
        label: `Poll ${i}`,
      });
    }

    const polls = useSwapDiagnosticsStore.getState().polls;
    expect(polls).toHaveLength(MAX_SWAP_DIAGNOSTIC_POLLS);
    expect(polls.some((poll) => poll.id === 'poll:0')).toBe(false);
    expect(polls.some((poll) => poll.id === `poll:${MAX_SWAP_DIAGNOSTIC_POLLS + 9}`)).toBe(true);
  });

  it('records bounded UNIT/USDC pool snapshots separately from poll history', () => {
    for (let i = 0; i < MAX_UNIT_USDC_POOL_SNAPSHOTS + 3; i++) {
      useSwapDiagnosticsStore.getState().recordUnitUsdcPoolSnapshot({
        checkedAt: 1_000 + i,
        status: i % 2 === 0 ? 'ready' : 'degraded',
        readiness: {
          sepoliaRpc: true,
          bridgeApi: true,
          usdc: true,
          wunit: true,
          stablePool: true,
          bridgeRouter: true,
          poolContracts: true,
          bridgeContracts: true,
        },
        reserves: {
          usdc: `${100 + i}`,
          wunit: `${90 + i}`,
        },
        impliedUnitPriceUsdc: '1.1',
        imbalanceBps: 100 + i,
        maxInputAmount: `${90 + i}`,
        quoteSamples: [{
          amountIn: '1',
          unitToUsdcOut: '0.99',
          unitToUsdcImpactBps: 100,
          usdcToUnitOut: '0.98',
          usdcToUnitImpactBps: 200,
        }],
        error: null,
      });
    }

    const snapshots = useSwapDiagnosticsStore.getState().unitUsdcPoolSnapshots;
    expect(snapshots).toHaveLength(MAX_UNIT_USDC_POOL_SNAPSHOTS);
    expect(snapshots[0]).toMatchObject({
      checkedAt: 1_000 + MAX_UNIT_USDC_POOL_SNAPSHOTS + 2,
      status: 'ready',
      reserves: {
        usdc: `${100 + MAX_UNIT_USDC_POOL_SNAPSHOTS + 2}`,
        wunit: `${90 + MAX_UNIT_USDC_POOL_SNAPSHOTS + 2}`,
      },
    });
    expect(snapshots.some((snapshot) => snapshot.checkedAt === 1_000)).toBe(false);

    useSwapDiagnosticsStore.getState().clearUnitUsdcPoolSnapshots();
    expect(useSwapDiagnosticsStore.getState().unitUsdcPoolSnapshots).toEqual([]);
  });
});
