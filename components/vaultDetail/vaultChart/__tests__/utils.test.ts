import type { VaultHistoryTransaction } from '../../../../services/vaultService';
import { createEventSeries } from '../utils';

const NOW_SECONDS = 1_700_000_000;

function createTransaction(overrides: Partial<VaultHistoryTransaction>): VaultHistoryTransaction {
  return {
    amount_borrowed: 4_000_000,
    vault_amount: 100_000_000,
    btc_amt: 0,
    unit_amt: 0,
    oracle_price: 50_000,
    timestamp: NOW_SECONDS,
    action: 'open',
    ...overrides,
  };
}

describe('createEventSeries', () => {
  const dateNowSpy = jest.spyOn(Date, 'now');

  beforeEach(() => {
    dateNowSpy.mockReturnValue(NOW_SECONDS * 1000);
  });

  afterAll(() => {
    dateNowSpy.mockRestore();
  });

  it('preserves bucket semantics when multiple transactions share a bucket', () => {
    const unitLength = 5 * 60;
    const numberOfUnits = 288;
    const startTimestamp = NOW_SECONDS - unitLength * numberOfUnits;
    const bucketIndex = 10;
    const bucketStart = startTimestamp + bucketIndex * unitLength;
    const bucketEnd = bucketStart + unitLength - 1;

    const openTx = createTransaction({
      action: 'open',
      amount_borrowed: 4_000_000,
      timestamp: startTimestamp - 60,
    });
    const olderBucketTx = createTransaction({
      action: 'repay',
      amount_borrowed: 2_500_000,
      timestamp: bucketStart + 50,
    });
    const newerBucketTx = createTransaction({
      action: 'borrow',
      amount_borrowed: 2_000_000,
      timestamp: bucketStart + 100,
    });

    const { series, referenceLines } = createEventSeries(
      [
        { timestamp: NOW_SECONDS, price: '50000' },
        { timestamp: startTimestamp, price: '50000' },
      ],
      [],
      '1D',
      [olderBucketTx, openTx, newerBucketTx]
    );

    expect(series).toHaveLength(numberOfUnits);
    expect(series[bucketIndex]).toMatchObject({
      date: bucketEnd * 1000,
      healthValue: 200,
      eventType: 'borrow',
      isEventPoint: true,
    });

    expect(referenceLines).toEqual([
      expect.objectContaining({
        date: bucketEnd * 1000,
        txTimestamp: olderBucketTx.timestamp * 1000,
        prevValue: 125,
        newValue: 200,
        eventType: 'repay',
      }),
    ]);
  });
});
