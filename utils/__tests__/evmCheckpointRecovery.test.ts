import {
  describeEvmRecoveryCheckpoint,
  formatEvmCheckpointReconciliationSummary,
  selectRedeemRecoveryCheckpoint,
  selectSendRecoveryCheckpoint,
  selectSwapRecoveryCheckpoint,
  shortEvmTxHash,
} from '../evmCheckpointRecovery';
import type { EvmTransactionCheckpoint } from '../../stores/evmTransactionCheckpointStore';

function checkpoint(overrides: Partial<EvmTransactionCheckpoint>): EvmTransactionCheckpoint {
  return {
    id: overrides.txHash || '0xhash',
    chain: 'sepolia',
    accountIndex: 0,
    kind: 'swap',
    status: 'submitted',
    txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    receiptTxHash: null,
    asset: null,
    amount: null,
    spender: null,
    recipient: null,
    tokenIn: null,
    tokenOut: null,
    releaseId: null,
    destinationTaprootAddress: null,
    submittedAt: 100,
    confirmedAt: null,
    updatedAt: 100,
    error: null,
    ...overrides,
  };
}

describe('evmCheckpointRecovery', () => {
  it('selects the latest actionable USDC to UNIT swap checkpoint for the account and amount', () => {
    const older = checkpoint({
      accountIndex: 0,
      kind: 'swap',
      status: 'failed',
      amount: '10',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      updatedAt: 200,
      txHash: '0xolder',
    });
    const latest = checkpoint({
      accountIndex: 0,
      kind: 'swap',
      status: 'confirmed',
      amount: '10',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      updatedAt: 300,
      txHash: '0xlatest',
    });
    const wrongAccount = checkpoint({
      accountIndex: 1,
      kind: 'swap',
      status: 'failed',
      amount: '10',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      updatedAt: 400,
      txHash: '0xwrong',
    });

    expect(selectSwapRecoveryCheckpoint([older, latest, wrongAccount], 0, '10')).toBe(latest);
  });

  it('does not surface unrelated swap amounts', () => {
    const unrelated = checkpoint({
      kind: 'swap',
      status: 'failed',
      amount: '25',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      updatedAt: 300,
    });

    expect(selectSwapRecoveryCheckpoint([unrelated], 0, '10')).toBeNull();
  });

  it('requires expected output amount before surfacing confirmed redemptions on swap summary', () => {
    const confirmedRedemption = checkpoint({
      kind: 'redemption',
      status: 'confirmed',
      amount: '9.8',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      destinationTaprootAddress: 'tb1pdestination',
      updatedAt: 300,
    });

    expect(selectSwapRecoveryCheckpoint(
      [confirmedRedemption],
      0,
      '10',
      'tb1pdestination',
    )).toBeNull();
    expect(selectSwapRecoveryCheckpoint(
      [confirmedRedemption],
      0,
      '10',
      'tb1pdestination',
      '9.8',
    )).toBe(confirmedRedemption);
  });

  it('selects redemption checkpoints by destination and release amount', () => {
    const destination = 'tb1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    const match = checkpoint({
      kind: 'redemption',
      status: 'submitted',
      amount: '12.5',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      destinationTaprootAddress: destination,
      updatedAt: 300,
      txHash: '0xredeem',
    });
    const otherDestination = checkpoint({
      kind: 'redemption',
      status: 'submitted',
      amount: '12.5',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      destinationTaprootAddress: 'tb1pother',
      updatedAt: 400,
      txHash: '0xother',
    });

    expect(selectRedeemRecoveryCheckpoint([match, otherDestination], 0, destination.toUpperCase(), '12.5')).toBe(match);
  });

  it('selects submitted or failed transfers by asset, recipient, and amount', () => {
    const recipient = '0x1111111111111111111111111111111111111111';
    const match = checkpoint({
      kind: 'transfer',
      status: 'failed',
      asset: 'USDC',
      recipient,
      amount: '3',
      updatedAt: 300,
      txHash: '0xtransfer',
    });
    const confirmed = checkpoint({
      kind: 'transfer',
      status: 'confirmed',
      asset: 'USDC',
      recipient,
      amount: '3',
      updatedAt: 400,
      txHash: '0xconfirmed',
    });

    expect(selectSendRecoveryCheckpoint([match, confirmed], 0, 'USDC', recipient.toUpperCase(), '3')).toBe(match);
    expect(selectSendRecoveryCheckpoint([match], 0, 'USDC', '0x2222222222222222222222222222222222222222', '3')).toBeNull();
    expect(selectSendRecoveryCheckpoint([match], 0, 'USDC', recipient, '4')).toBeNull();
  });

  it('describes swap recovery states', () => {
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const confirmedSwap = describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'swap',
      status: 'confirmed',
      tokenIn: 'USDC',
      tokenOut: 'wUNIT',
      txHash,
    }), 'swap');
    const confirmedRedemption = describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'redemption',
      status: 'confirmed',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      txHash,
    }), 'swap');
    const submitted = describeEvmRecoveryCheckpoint(checkpoint({ status: 'submitted', txHash }), 'swap');
    const failed = describeEvmRecoveryCheckpoint(checkpoint({ status: 'failed', txHash }), 'swap');

    expect(shortEvmTxHash(txHash)).toBe('0x12345678...abcdef');
    expect(shortEvmTxHash('0xshort')).toBe('0xshort');
    expect(confirmedSwap.title).toBe('Swap confirmed; redeem wUNIT');
    expect(confirmedRedemption.title).toBe('Redemption burn confirmed');
    expect(submitted.title).toBe('Sepolia transaction still pending');
    expect(failed.title).toBe('Previous Sepolia step failed');
  });

  it('describes redeem and send recovery states', () => {
    expect(describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'redemption',
      status: 'confirmed',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
    }), 'redeem').title).toBe('Burn confirmed; release may be pending');
    expect(describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'redemption',
      status: 'submitted',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
    }), 'redeem').title).toBe('Redemption burn submitted');
    expect(describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'redemption',
      status: 'failed',
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
    }), 'redeem').title).toBe('Previous redemption failed');
    expect(describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'transfer',
      status: 'submitted',
      asset: 'ETH',
    }), 'send').title).toBe('Transfer submitted');
    expect(describeEvmRecoveryCheckpoint(checkpoint({
      kind: 'transfer',
      status: 'failed',
      asset: 'ETH',
    }), 'send').title).toBe('Previous transfer failed');
  });

  it('formats reconciliation summaries', () => {
    expect(formatEvmCheckpointReconciliationSummary({
      checked: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
      errors: 0,
    })).toBe('No submitted Sepolia transactions needed a status check.');
    expect(formatEvmCheckpointReconciliationSummary({
      checked: 3,
      pending: 1,
      confirmed: 1,
      failed: 1,
      errors: 2,
    })).toBe('3 checked, 1 confirmed, 1 pending, 1 failed, 2 errors');
  });
});
