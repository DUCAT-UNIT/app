import { getEvmCheckpointActionCopy } from '../operationLifecycle';
import { selectSendRecoveryCheckpoint } from '../evmCheckpointRecovery';
import type { EvmTransactionCheckpoint } from '../../stores/evmTransactionCheckpointStore';

function checkpoint(overrides: Partial<EvmTransactionCheckpoint>): EvmTransactionCheckpoint {
  return {
    id: overrides.txHash || '0xhash',
    chain: 'sepolia',
    accountIndex: 0,
    kind: 'transfer',
    status: 'submitted',
    txHash: '0xhash',
    receiptTxHash: null,
    asset: 'USDC',
    amount: '1',
    spender: null,
    recipient: '0x1111111111111111111111111111111111111111',
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

describe('operation invariants', () => {
  it('submitted matching Sepolia sends block duplicate submit and are not retryable', () => {
    const pending = checkpoint({ status: 'submitted' });

    expect(selectSendRecoveryCheckpoint(
      [pending],
      0,
      'USDC',
      '0x1111111111111111111111111111111111111111',
      '1',
    )).toBe(pending);

    expect(getEvmCheckpointActionCopy(pending)).toMatchObject({
      statusLabel: 'Still pending',
      retryable: false,
    });
  });

  it('failed matching Sepolia sends are visible but explicitly safe to retry', () => {
    const failed = checkpoint({ status: 'failed', error: 'reverted' });

    expect(selectSendRecoveryCheckpoint(
      [failed],
      0,
      'USDC',
      '0x1111111111111111111111111111111111111111',
      '1',
    )).toBe(failed);

    expect(getEvmCheckpointActionCopy(failed)).toMatchObject({
      statusLabel: 'Failed, safe to retry',
      retryable: true,
    });
  });

  it('confirmed Sepolia sends do not block a new matching send', () => {
    const confirmed = checkpoint({ status: 'confirmed', receiptTxHash: '0xreceipt' });

    expect(selectSendRecoveryCheckpoint(
      [confirmed],
      0,
      'USDC',
      '0x1111111111111111111111111111111111111111',
      '1',
    )).toBeNull();
  });
});
