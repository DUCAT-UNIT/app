import {
  backfillEvmHistoryFromCheckpoints,
  mapEvmCheckpointToHistoryItem,
} from '../evmCheckpointDisplay';
import type { SepoliaAssetHistoryItem } from '../../services/evmBridgeService';
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
    amount: '3.5',
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

describe('evmCheckpointDisplay', () => {
  it('maps pending transfer checkpoints into display history', () => {
    expect(mapEvmCheckpointToHistoryItem(checkpoint({}), '0xwallet')).toEqual({
      txid: '0xabc',
      status: {
        confirmed: false,
        block_time: 1_700_000_000,
        failed: false,
      },
      txData: {
        amount: 3.5,
        assetType: 'USDC',
        isSent: true,
        isReceived: false,
      },
    });
  });

  it('preserves Sepolia self-transfers as sent and received', () => {
    const item = mapEvmCheckpointToHistoryItem(
      checkpoint({
        asset: 'ETH',
        amount: '0.02',
        recipient: '0x1111111111111111111111111111111111111111',
      }),
      '0x1111111111111111111111111111111111111111',
    );

    expect(item?.txData).toMatchObject({
      assetType: 'ETH',
      isSent: true,
      isReceived: true,
      amount: 0.02,
    });
  });

  it('dedupes checkpoint history when indexed history already has the txid', () => {
    const indexed: SepoliaAssetHistoryItem[] = [{
      txid: '0xabc',
      status: { confirmed: true, block_time: 1_700_000_010 },
      txData: {
        amount: 3.5,
        assetType: 'USDC',
        isSent: true,
        isReceived: false,
      },
    }];

    expect(backfillEvmHistoryFromCheckpoints(indexed, [checkpoint({})], 'USDC', 0)).toEqual(indexed);
  });

  it('sorts checkpoint and indexed history newest first', () => {
    const older: SepoliaAssetHistoryItem[] = [{
      txid: '0xold',
      status: { confirmed: true, block_time: 1_600_000_000 },
      txData: {
        amount: 1,
        assetType: 'ETH',
        isSent: false,
        isReceived: true,
      },
    }];

    const merged = backfillEvmHistoryFromCheckpoints(
      older,
      [checkpoint({
        asset: 'ETH',
        txHash: '0xnew',
        amount: '0.1',
        updatedAt: 1_700_000_000_000,
      })],
      'ETH',
      0,
    );

    expect(merged.map((item) => item.txid)).toEqual(['0xnew', '0xold']);
  });
});
