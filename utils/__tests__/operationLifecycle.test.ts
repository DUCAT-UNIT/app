import {
  canTransitionOperationStage,
  createOperationLifecycleState,
  deriveOperationLifecycleFromFlags,
  getEvmCheckpointActionCopy,
  getEvmCheckpointLifecycle,
  transitionOperationLifecycle,
} from '../operationLifecycle';
import type { EvmTransactionCheckpoint } from '../../stores/evmTransactionCheckpointStore';

function checkpoint(overrides: Partial<EvmTransactionCheckpoint>): EvmTransactionCheckpoint {
  return {
    id: overrides.txHash || '0xhash',
    chain: 'sepolia',
    accountIndex: 0,
    kind: 'transfer',
    status: 'submitted',
    txHash: '0xabc',
    receiptTxHash: null,
    asset: 'USDC',
    amount: '1',
    spender: null,
    recipient: '0xrecipient',
    tokenIn: null,
    tokenOut: null,
    releaseId: null,
    destinationTaprootAddress: null,
    submittedAt: 1_700_000_000_000,
    confirmedAt: null,
    updatedAt: 1_700_000_000_000,
    error: null,
    ...overrides,
  };
}

describe('operationLifecycle', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives controls from stage defaults', () => {
    expect(createOperationLifecycleState({ stage: 'submit' })).toMatchObject({
      stage: 'submit',
      label: 'Submitting',
      busy: true,
      canNavigateBack: false,
      canSubmit: false,
      retryable: false,
    });

    expect(createOperationLifecycleState({ stage: 'recoverable' })).toMatchObject({
      stage: 'recoverable',
      label: 'Failed, safe to retry',
      busy: false,
      canNavigateBack: true,
      canSubmit: true,
      retryable: true,
    });
  });

  it('enforces typed lifecycle transitions', () => {
    const edit = createOperationLifecycleState({ stage: 'edit' });

    expect(canTransitionOperationStage('edit', 'review')).toBe(true);
    expect(canTransitionOperationStage('edit', 'confirmed')).toBe(false);
    expect(transitionOperationLifecycle(edit, { stage: 'review' }).stage).toBe('review');
    expect(() => transitionOperationLifecycle(edit, { stage: 'confirmed' })).toThrow(
      'Invalid operation lifecycle transition',
    );
  });

  it('derives lifecycle from async flags', () => {
    expect(deriveOperationLifecycleFromFlags({ isAuthenticating: true }).stage).toBe('auth');
    expect(deriveOperationLifecycleFromFlags({ isSubmitting: true }).stage).toBe('submit');
    expect(deriveOperationLifecycleFromFlags({ isPending: true, txid: '0xpending' })).toMatchObject({
      stage: 'pending',
      txid: '0xpending',
      label: 'Still pending',
    });
    expect(deriveOperationLifecycleFromFlags({ error: new Error('boom') })).toMatchObject({
      stage: 'failed',
      error: 'boom',
    });
  });

  it('maps EVM checkpoint states to lifecycle and user copy', () => {
    expect(getEvmCheckpointLifecycle(checkpoint({ status: 'submitted' })).stage).toBe('pending');
    expect(getEvmCheckpointLifecycle(checkpoint({
      status: 'confirmed',
      receiptTxHash: '0xreceipt',
      confirmedAt: 1_700_000_001_000,
    }))).toMatchObject({
      stage: 'confirmed',
      txid: '0xreceipt',
    });
    expect(getEvmCheckpointLifecycle(checkpoint({
      status: 'failed',
      error: 'reverted',
    }))).toMatchObject({
      stage: 'recoverable',
      error: 'reverted',
      retryable: true,
    });

    expect(getEvmCheckpointActionCopy(checkpoint({ status: 'submitted' }))).toMatchObject({
      primaryLabel: 'Check pending Sepolia transfer',
      statusLabel: 'Still pending',
    });
    expect(getEvmCheckpointActionCopy(checkpoint({ status: 'failed' }))).toMatchObject({
      statusLabel: 'Failed, safe to retry',
      retryable: true,
    });
  });
});
