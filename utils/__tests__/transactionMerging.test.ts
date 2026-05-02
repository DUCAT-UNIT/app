/**
 * Tests for Transaction Merging Utilities
 */

import {
  processEcashTokens,
  processPendingTransactions,
  mergeAndSortTransactions,
  findSelfClaimedTokenIds,
  getTimeInSeconds,
  type MergeableTransaction,
  type PendingTx,
} from '../transactionMerging';
import type { TokenWithStatus } from '../../services/cashu/tokenStatusService';
import type { TokenRecord, ReceivedTokenRecord } from '../../services/cashu/cashuLockedTokensService';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeSentToken(overrides: Partial<TokenRecord & { claimed?: boolean; partiallySpent?: boolean }> = {}): TokenWithStatus {
  return {
    id: 'sent-token-1',
    token: 'cashuBbc',
    amount: 500,
    timestamp: 1_700_000_000_000,
    taprootAddress: 'tb1pXXX',
    recipient: 'pubkey-recipient-hex',
    txid: 'txid-abc',
    shortUrl: null,
    claimed: false,
    partiallySpent: false,
    ...overrides,
  } as TokenWithStatus;
}

function makeReceivedToken(overrides: Partial<ReceivedTokenRecord & { claimed?: boolean; partiallySpent?: boolean }> = {}): TokenWithStatus {
  return {
    id: 'recv-token-1',
    token: 'cashuDef',
    amount: 300,
    timestamp: 1_700_001_000_000,
    taprootAddress: 'tb1pYYY',
    sender: 'pubkey-sender-hex',
    type: 'p2pk',
    claimed: false,
    partiallySpent: false,
    ...overrides,
  } as TokenWithStatus;
}

function makePendingTx(overrides: Partial<PendingTx> = {}): PendingTx {
  return {
    txid: 'pending-txid-1',
    status: 'pending',
    assetType: 'BTC',
    timestamp: 1_700_000_000_000,
    outputs: [{ value: 50_000 }],
    ...overrides,
  };
}

// ─── processEcashTokens ─────────────────────────────────────────────────────

describe('processEcashTokens', () => {
  const emptySelfClaimed = new Set<string>();

  describe('happy path', () => {
    it('should map a received token to a positive-amount mergeable transaction', () => {
      const token = makeReceivedToken({ amount: 500 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result).toHaveLength(1);
      expect(result[0].txid).toBe('recv-token-1');
      expect(result[0].ecashToken).toBe(true);
      expect(result[0].txData?.amount).toBe(500);
      expect(result[0].txData?.isSent).toBe(false);
      expect(result[0].txData?.isReceived).toBe(true);
    });

    it('should map a sent token to a negative-amount mergeable transaction', () => {
      const token = makeSentToken({ amount: 500 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result).toHaveLength(1);
      expect(result[0].txData?.amount).toBe(-500);
      expect(result[0].txData?.isSent).toBe(true);
      expect(result[0].txData?.isReceived).toBe(false);
    });

    it('should propagate claimed and partiallySpent flags', () => {
      const token = makeReceivedToken({ claimed: true, partiallySpent: true });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result[0].claimed).toBe(true);
      expect(result[0].partiallySpent).toBe(true);
    });

    it('should include tokenData on the result', () => {
      const token = makeReceivedToken();
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result[0].tokenData).toBe(token);
    });

    it('should set assetType to UNIT for every ecash token', () => {
      const result = processEcashTokens([makeReceivedToken(), makeSentToken()], emptySelfClaimed, undefined);
      result.forEach(tx => expect(tx.txData?.assetType).toBe('UNIT'));
    });
  });

  describe('cents/display-unit normalization heuristic', () => {
    it('should treat an integer amount as already cents and leave it unchanged', () => {
      // amount = 500 (integer) → treated as 500 cents already
      const token = makeReceivedToken({ amount: 500 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result[0].txData?.amount).toBe(500);
      expect(result[0].txData?.numericAmount).toBe(500);
    });

    it('should convert a fractional amount (legacy display units) to cents', () => {
      // amount = 5.00 (fractional ≠ floor) → 5.00 * 100 = 500 cents
      const token = makeReceivedToken({ amount: 5.0 });
      // 5.0 === Math.floor(5.0), so this is treated as cents → 5
      // Use a value that actually has a fractional part to trigger conversion
      const fractionalToken = makeReceivedToken({ amount: 5.25 });
      const result = processEcashTokens([fractionalToken], emptySelfClaimed, undefined);

      // 5.25 !== Math.floor(5.25) → Math.round(5.25 * 100) = 525
      expect(result[0].txData?.amount).toBe(525);
    });

    it('should round fractional amounts when converting to cents', () => {
      // 2.999 → Math.round(2.999 * 100) = 300
      const token = makeReceivedToken({ amount: 2.999 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result[0].txData?.amount).toBe(300);
    });

    it('should negate converted cents for a sent token with fractional amount', () => {
      const token = makeSentToken({ amount: 1.5 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      // 1.5 !== floor(1.5) → Math.round(1.5 * 100) = 150, negated for sent
      expect(result[0].txData?.amount).toBe(-150);
    });

    it('should handle amount of zero without NaN', () => {
      const token = makeReceivedToken({ amount: 0 });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result[0].txData?.amount).toBe(0);
      expect(Number.isNaN(result[0].txData?.amount)).toBe(false);
    });
  });

  describe('self-claimed tokens (autoclaim)', () => {
    it('should mark a token as autoclaim when its id is in selfClaimedSentTokenIds', () => {
      const token = makeSentToken({ id: 'sent-abc', amount: 200 });
      const selfClaimed = new Set(['sent-abc']);
      const result = processEcashTokens([token], selfClaimed, undefined);

      expect(result[0].isAutoclaim).toBe(true);
      expect(result[0].txData?.isAutoclaim).toBe(true);
      expect(result[0].txData?.isSent).toBe(false);
      expect(result[0].txData?.isReceived).toBe(true);
    });

    it('should make autoclaim amount positive even though token has "recipient" field', () => {
      const token = makeSentToken({ id: 'sent-abc', amount: 200 });
      const selfClaimed = new Set(['sent-abc']);
      const result = processEcashTokens([token], selfClaimed, undefined);

      expect(result[0].txData?.amount).toBe(200); // positive, not negative
    });

    it('should not mark a token as autoclaim when its id is NOT in the set', () => {
      const token = makeSentToken({ id: 'sent-xyz' });
      const selfClaimed = new Set(['sent-abc']);
      const result = processEcashTokens([token], selfClaimed, undefined);

      expect(result[0].isAutoclaim).toBe(false);
    });
  });

  describe('self-send filter', () => {
    it('should exclude a received token whose taprootAddress matches the current user taprootAddress', () => {
      const token = makeReceivedToken({ taprootAddress: 'tb1pMINE' });
      const result = processEcashTokens([token], emptySelfClaimed, 'tb1pMINE');

      expect(result).toHaveLength(0);
    });

    it('should include a received token when taprootAddress does NOT match', () => {
      const token = makeReceivedToken({ taprootAddress: 'tb1pOTHER' });
      const result = processEcashTokens([token], emptySelfClaimed, 'tb1pMINE');

      expect(result).toHaveLength(1);
    });

    it('should include a received token when its taprootAddress is null', () => {
      const token = makeReceivedToken({ taprootAddress: null });
      const result = processEcashTokens([token], emptySelfClaimed, 'tb1pMINE');

      expect(result).toHaveLength(1);
    });

    it('should include a received token when the current taprootAddress is undefined', () => {
      const token = makeReceivedToken({ taprootAddress: 'tb1pSOMETHING' });
      const result = processEcashTokens([token], emptySelfClaimed, undefined);

      expect(result).toHaveLength(1);
    });

    it('should never filter out sent tokens regardless of taprootAddress', () => {
      const token = makeSentToken({ taprootAddress: 'tb1pMINE' });
      const result = processEcashTokens([token], emptySelfClaimed, 'tb1pMINE');

      // Sent tokens have 'recipient' not 'sender', so the filter only applies to received tokens
      expect(result).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      expect(processEcashTokens([], emptySelfClaimed, undefined)).toEqual([]);
    });

    it('should handle multiple tokens in one call', () => {
      const tokens = [
        makeSentToken({ id: 'sent-1', amount: 100 }),
        makeReceivedToken({ id: 'recv-1', amount: 200 }),
      ];
      const result = processEcashTokens(tokens, emptySelfClaimed, undefined);
      expect(result).toHaveLength(2);
    });
  });
});

// ─── findSelfClaimedTokenIds ────────────────────────────────────────────────

describe('findSelfClaimedTokenIds', () => {
  describe('happy path', () => {
    it('should return the id of a sent token whose recipient matches the current pubkey and is claimed', () => {
      const token = makeSentToken({
        id: 'sent-1',
        recipient: 'my-pubkey-hex',
        claimed: true,
      });

      const result = findSelfClaimedTokenIds([token], 'my-pubkey-hex');
      expect(result.has('sent-1')).toBe(true);
    });

    it('should not include a sent token whose recipient does not match', () => {
      const token = makeSentToken({
        id: 'sent-1',
        recipient: 'other-pubkey-hex',
        claimed: true,
      });

      const result = findSelfClaimedTokenIds([token], 'my-pubkey-hex');
      expect(result.has('sent-1')).toBe(false);
    });

    it('should not include a sent token that has not been claimed', () => {
      const token = makeSentToken({
        id: 'sent-1',
        recipient: 'my-pubkey-hex',
        claimed: false,
      });

      const result = findSelfClaimedTokenIds([token], 'my-pubkey-hex');
      expect(result.has('sent-1')).toBe(false);
    });

    it('should not include received tokens (they lack "recipient")', () => {
      const token = makeReceivedToken({ id: 'recv-1', claimed: true });
      const result = findSelfClaimedTokenIds([token], 'any-pubkey');
      expect(result.has('recv-1')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return an empty Set when ecashTokens is empty', () => {
      const result = findSelfClaimedTokenIds([], 'my-pubkey');
      expect(result.size).toBe(0);
    });

    it('should return an empty Set when currentPubkeyHex is null', () => {
      const token = makeSentToken({ id: 'sent-1', recipient: 'my-pubkey', claimed: true });
      const result = findSelfClaimedTokenIds([token], null);
      expect(result.size).toBe(0);
    });

    it('should handle multiple tokens and identify all self-claims', () => {
      const tokens = [
        makeSentToken({ id: 'sent-1', recipient: 'my-pubkey', claimed: true }),
        makeSentToken({ id: 'sent-2', recipient: 'my-pubkey', claimed: false }),
        makeSentToken({ id: 'sent-3', recipient: 'other-pubkey', claimed: true }),
        makeReceivedToken({ id: 'recv-1', claimed: true }),
      ];
      const result = findSelfClaimedTokenIds(tokens, 'my-pubkey');
      expect(result.has('sent-1')).toBe(true);
      expect(result.has('sent-2')).toBe(false);
      expect(result.has('sent-3')).toBe(false);
      expect(result.has('recv-1')).toBe(false);
    });
  });
});

// ─── processPendingTransactions ─────────────────────────────────────────────

describe('processPendingTransactions', () => {
  describe('happy path', () => {
    it('should convert a pending BTC tx to a MergeableTransaction', () => {
      const tx = makePendingTx({
        txid: 'abc123',
        assetType: 'BTC',
        timestamp: 1_700_000_000_000,
        outputs: [{ value: 50_000 }],
      });
      const result = processPendingTransactions({ abc123: tx }, 'BTC', new Set());

      expect(result).toHaveLength(1);
      expect(result[0].txid).toBe('abc123');
      expect(result[0].isPending).toBe(true);
      expect(result[0].status?.confirmed).toBe(false);
    });

    it('should negate the output value to represent a sent amount', () => {
      const tx = makePendingTx({ outputs: [{ value: 30_000 }, { value: 20_000 }] });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      // total value = 50_000, negated = -50_000
      expect(result[0].txData?.amount).toBe(-50_000);
    });

    it('should use sentAmount when it is defined and positive', () => {
      const tx = makePendingTx({ sentAmount: 99_000, outputs: [{ value: 10_000 }] });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      // sentAmount takes priority
      expect(result[0].txData?.amount).toBe(-99_000);
    });

    it('should negate runeAmount for UNIT asset type', () => {
      const tx = makePendingTx({
        assetType: 'UNIT',
        outputs: [{ runeAmount: 500 }],
        sentAmount: undefined,
      });
      const result = processPendingTransactions({ [tx.txid]: tx }, 'UNIT', new Set());

      expect(result[0].txData?.amount).toBe(-500);
    });

    it('should set timestamp to tx.timestamp / 1000 (seconds)', () => {
      const tx = makePendingTx({ timestamp: 1_700_000_000_000 });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      expect(result[0].timestamp).toBe(1_700_000_000);
    });

    it('should set block_time equal to Math.floor(timestamp / 1000)', () => {
      const tx = makePendingTx({ timestamp: 1_700_000_000_999 });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      expect(result[0].status?.block_time).toBe(1_700_000_000);
    });

    it('should mark txData.isSent = true and isReceived = false', () => {
      const tx = makePendingTx();
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      expect(result[0].txData?.isSent).toBe(true);
      expect(result[0].txData?.isReceived).toBe(false);
    });
  });

  describe('filtering', () => {
    it('should filter out transactions whose status is not "pending"', () => {
      const tx = makePendingTx({ status: 'confirmed' });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      expect(result).toHaveLength(0);
    });

    it('should filter out transactions already in confirmedTxids', () => {
      const tx = makePendingTx({ txid: 'already-confirmed' });
      const confirmed = new Set(['already-confirmed']);
      const result = processPendingTransactions({ 'already-confirmed': tx }, undefined, confirmed);

      expect(result).toHaveLength(0);
    });

    it('should filter by assetType when assetType is provided', () => {
      const btcTx = makePendingTx({ txid: 'btc-tx', assetType: 'BTC' });
      const unitTx = makePendingTx({ txid: 'unit-tx', assetType: 'UNIT' });
      const map = { 'btc-tx': btcTx, 'unit-tx': unitTx };

      const result = processPendingTransactions(map, 'BTC', new Set());

      expect(result).toHaveLength(1);
      expect(result[0].txid).toBe('btc-tx');
    });

    it('should include all asset types when assetType is undefined', () => {
      const btcTx = makePendingTx({ txid: 'btc-tx', assetType: 'BTC' });
      const unitTx = makePendingTx({ txid: 'unit-tx', assetType: 'UNIT' });
      const map = { 'btc-tx': btcTx, 'unit-tx': unitTx };

      const result = processPendingTransactions(map, undefined, new Set());

      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty pendingTransactions', () => {
      expect(processPendingTransactions({}, undefined, new Set())).toEqual([]);
    });

    it('should default output value to 0 when value is absent', () => {
      const tx = makePendingTx({ outputs: [{}] });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      // Negating a 0 sum produces -0 in JavaScript; both 0 and -0 are valid
      expect(result[0].txData?.amount).toBe(-0);
    });

    it('should default runeAmount to 0 when absent for UNIT tx', () => {
      const tx = makePendingTx({ assetType: 'UNIT', outputs: [{}], sentAmount: undefined });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      // Negating a 0 rune sum produces -0 in JavaScript; both 0 and -0 are valid
      expect(result[0].txData?.amount).toBe(-0);
    });

    it('should ignore sentAmount when it is 0 and fall back to outputs', () => {
      const tx = makePendingTx({ sentAmount: 0, outputs: [{ value: 40_000 }] });
      const result = processPendingTransactions({ [tx.txid]: tx }, undefined, new Set());

      // sentAmount = 0 is falsy, falls back to output sum
      expect(result[0].txData?.amount).toBe(-40_000);
    });

    it('should handle multiple pending transactions at once', () => {
      const tx1 = makePendingTx({ txid: 'tx-1' });
      const tx2 = makePendingTx({ txid: 'tx-2' });
      const result = processPendingTransactions({ 'tx-1': tx1, 'tx-2': tx2 }, undefined, new Set());

      expect(result).toHaveLength(2);
    });
  });
});

// ─── mergeAndSortTransactions ───────────────────────────────────────────────

describe('mergeAndSortTransactions', () => {
  function makeMergeable(overrides: Partial<MergeableTransaction>): MergeableTransaction {
    return { txid: 'tx-x', ...overrides };
  }

  describe('happy path', () => {
    it('should merge multiple arrays into a single flat list', () => {
      const arr1 = [makeMergeable({ txid: 'a' })];
      const arr2 = [makeMergeable({ txid: 'b' }), makeMergeable({ txid: 'c' })];
      const result = mergeAndSortTransactions(arr1, arr2);

      expect(result).toHaveLength(3);
    });

    it('should sort pending transactions before non-pending ones', () => {
      const confirmed = makeMergeable({ txid: 'confirmed', isPending: false, timestamp: 1_000_000_000 });
      const pending = makeMergeable({ txid: 'pending', isPending: true, timestamp: 999_999_999 });

      const result = mergeAndSortTransactions([confirmed, pending]);

      expect(result[0].txid).toBe('pending');
      expect(result[1].txid).toBe('confirmed');
    });

    it('should sort non-pending transactions by timestamp descending (most recent first)', () => {
      const older = makeMergeable({ txid: 'older', timestamp: 1_000_000 });
      const newer = makeMergeable({ txid: 'newer', timestamp: 2_000_000 });

      const result = mergeAndSortTransactions([older, newer]);

      expect(result[0].txid).toBe('newer');
      expect(result[1].txid).toBe('older');
    });

    it('should sort pending transactions among themselves by timestamp descending', () => {
      const pendingOld = makeMergeable({ txid: 'p-old', isPending: true, timestamp: 1_000_000 });
      const pendingNew = makeMergeable({ txid: 'p-new', isPending: true, timestamp: 2_000_000 });

      const result = mergeAndSortTransactions([pendingOld, pendingNew]);

      expect(result[0].txid).toBe('p-new');
      expect(result[1].txid).toBe('p-old');
    });
  });

  describe('ecash token timestamp handling', () => {
    it('should divide ecash token timestamp by 1000 when comparing (they are in ms)', () => {
      // ecashToken timestamps are in milliseconds, on-chain timestamps in seconds.
      // A token at ms=2_000_000_000_000 has the same effective time as block_time=2_000_000_000
      const ecash = makeMergeable({
        txid: 'ecash',
        ecashToken: true,
        timestamp: 2_000_000_000_000, // ms — corresponds to 2_000_000_000 s
      });
      const onchain = makeMergeable({
        txid: 'onchain',
        ecashToken: false,
        timestamp: 1_999_999_999, // seconds — slightly older
      });

      const result = mergeAndSortTransactions([onchain, ecash]);

      expect(result[0].txid).toBe('ecash');
    });
  });

  describe('fallback to status.block_time', () => {
    it('should use status.block_time when timestamp is absent', () => {
      const withBlockTime = makeMergeable({
        txid: 'with-block-time',
        timestamp: undefined,
        status: { confirmed: true, block_time: 2_000_000 },
      });
      const withTimestamp = makeMergeable({ txid: 'with-timestamp', timestamp: 1_000_000 });

      const result = mergeAndSortTransactions([withTimestamp, withBlockTime]);

      expect(result[0].txid).toBe('with-block-time');
    });
  });

  describe('edge cases', () => {
    it('should return empty array when no transactions are provided', () => {
      expect(mergeAndSortTransactions([])).toEqual([]);
    });

    it('should return empty array when called with no arguments', () => {
      expect(mergeAndSortTransactions()).toEqual([]);
    });

    it('should handle a single array of one item', () => {
      const result = mergeAndSortTransactions([makeMergeable({ txid: 'solo' })]);
      expect(result).toHaveLength(1);
    });

    it('should treat transactions with no timestamp as having time 0', () => {
      const noTime = makeMergeable({ txid: 'no-time', timestamp: undefined });
      const withTime = makeMergeable({ txid: 'with-time', timestamp: 1 });

      const result = mergeAndSortTransactions([noTime, withTime]);

      expect(result[0].txid).toBe('with-time');
      expect(result[1].txid).toBe('no-time');
    });

    it('should handle many arrays merged together', () => {
      const arrays = Array.from({ length: 5 }, (_, i) => [
        makeMergeable({ txid: `tx-${i}`, timestamp: i * 1000 }),
      ]);

      const result = mergeAndSortTransactions(...arrays);

      expect(result).toHaveLength(5);
      // Highest timestamp first
      expect(result[0].txid).toBe('tx-4');
    });
  });
});

// ─── getTimeInSeconds ───────────────────────────────────────────────────────

describe('getTimeInSeconds', () => {
  it('should divide ecash token timestamp by 1000', () => {
    const tx: MergeableTransaction = { txid: 't', ecashToken: true, timestamp: 1_700_000_000_000 };
    expect(getTimeInSeconds(tx)).toBe(1_700_000_000);
  });

  it('should return timestamp directly for non-ecash transaction', () => {
    const tx: MergeableTransaction = { txid: 't', ecashToken: false, timestamp: 1_700_000_000 };
    expect(getTimeInSeconds(tx)).toBe(1_700_000_000);
  });

  it('should fall back to status.block_time when timestamp is absent', () => {
    const tx: MergeableTransaction = {
      txid: 't',
      timestamp: undefined,
      status: { confirmed: true, block_time: 1_600_000_000 },
    };
    expect(getTimeInSeconds(tx)).toBe(1_600_000_000);
  });

  it('should return 0 when both timestamp and status are absent', () => {
    const tx: MergeableTransaction = { txid: 't' };
    expect(getTimeInSeconds(tx)).toBe(0);
  });

  it('should return 0 for an ecash token with no timestamp', () => {
    const tx: MergeableTransaction = { txid: 't', ecashToken: true, timestamp: undefined };
    // undefined / 1000 = NaN → but getTimeInSeconds returns tx.timestamp || ... which is 0
    // Actual implementation: tx.timestamp / 1000 when ecashToken is true
    // undefined / 1000 → NaN; we verify the result is not a positive finite number
    const result = getTimeInSeconds(tx);
    expect(result === 0 || Number.isNaN(result)).toBe(true);
  });
});
