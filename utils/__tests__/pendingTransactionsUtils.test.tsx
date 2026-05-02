/**
 * Tests for Pending Transactions Utilities
 */

import {
  buildExclusionSet,
  matchesAddressType,
  getUnconfirmedUTXOsFromPending,
  calculateUnconfirmedBalance,
  invalidateChildrenRecursive,
  invalidateTransactionTree,
  removeUtxoFromPending,
  cleanupInvalidTransactions,
  markUtxosAsSpent,
  unmarkUtxosAsSpent,
  PendingTransaction,
  UnconfirmedUTXO,
} from '../pendingTransactionsUtils';

describe('buildExclusionSet', () => {
  it('should return empty set when intent is null', () => {
    const result = buildExclusionSet(null);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return empty set when intent is undefined', () => {
    const result = buildExclusionSet(undefined);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should exclude BTC inputs', () => {
    const intent = {
      inputs: [
        { txid: 'abc123', vout: 0 },
        { txid: 'def456', vout: 1 },
      ],
    };

    const result = buildExclusionSet(intent);

    expect(result.has('abc123:0')).toBe(true);
    expect(result.has('def456:1')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('should exclude runeUtxo', () => {
    const intent = {
      runeUtxo: {
        transaction: 'rune123',
        vout: 2,
      },
    };

    const result = buildExclusionSet(intent);

    expect(result.has('rune123:2')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should exclude satUtxo', () => {
    const intent = {
      satUtxo: {
        txid: 'sat123',
        vout: 3,
      },
    };

    const result = buildExclusionSet(intent);

    expect(result.has('sat123:3')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should exclude all types together', () => {
    const intent = {
      inputs: [{ txid: 'btc1', vout: 0 }],
      runeUtxo: { transaction: 'rune1', vout: 1 },
      satUtxo: { txid: 'sat1', vout: 2 },
    };

    const result = buildExclusionSet(intent);

    expect(result.size).toBe(3);
    expect(result.has('btc1:0')).toBe(true);
    expect(result.has('rune1:1')).toBe(true);
    expect(result.has('sat1:2')).toBe(true);
  });
});

describe('matchesAddressType', () => {
  it('should return true for "all" filter', () => {
    expect(matchesAddressType('bc1qtest', 'all')).toBe(true);
    expect(matchesAddressType('bc1ptest', 'all')).toBe(true);
    expect(matchesAddressType('1test', 'all')).toBe(true);
  });

  it('should reject mainnet segwit addresses for Mutinynet filters', () => {
    expect(matchesAddressType('bc1qsegwit', 'segwit')).toBe(false);
    expect(matchesAddressType('bc1qsegwit', 'taproot')).toBe(false);
  });

  it('should match testnet segwit addresses', () => {
    expect(matchesAddressType('tb1qsegwit', 'segwit')).toBe(true);
    expect(matchesAddressType('tb1qsegwit', 'taproot')).toBe(false);
  });

  it('should reject mainnet taproot addresses for Mutinynet filters', () => {
    expect(matchesAddressType('bc1ptaproot', 'taproot')).toBe(false);
    expect(matchesAddressType('bc1ptaproot', 'segwit')).toBe(false);
  });

  it('should match testnet taproot addresses', () => {
    expect(matchesAddressType('tb1ptaproot', 'taproot')).toBe(true);
    expect(matchesAddressType('tb1ptaproot', 'segwit')).toBe(false);
  });

  it('should not match legacy addresses to specific types', () => {
    expect(matchesAddressType('1Legacy', 'segwit')).toBe(false);
    expect(matchesAddressType('1Legacy', 'taproot')).toBe(false);
  });
});

describe('getUnconfirmedUTXOsFromPending', () => {
  const mockPendingTxs = {
    tx1: {
      txid: 'tx1',
        status: 'pending',
        assetType: 'btc',
        outputs: [
        { vout: 0, address: 'tb1qsegwit', value: 50000 },
        { vout: 1, address: 'tb1ptaproot', value: 30000 },
      ],
    },
    tx2: {
      txid: 'tx2',
      status: 'invalid',
      assetType: 'btc',
      outputs: [{ vout: 0, address: 'tb1qsegwit', value: 10000 }],
    },
  } as Record<string, PendingTransaction>;

  it('should get all UTXOs with "all" filter', () => {
    const result = getUnconfirmedUTXOsFromPending(mockPendingTxs, 'all', new Set<string>());

    expect(result.length).toBe(2);
    expect(result[0].txid).toBe('tx1');
    expect(result[0].status.confirmed).toBe(false);
  });

  it('should filter by segwit addresses', () => {
    const result = getUnconfirmedUTXOsFromPending(mockPendingTxs, 'segwit', new Set<string>());

    expect(result.length).toBe(1);
    expect(result[0].address).toBe('tb1qsegwit');
  });

  it('should filter by taproot addresses', () => {
    const result = getUnconfirmedUTXOsFromPending(mockPendingTxs, 'taproot', new Set<string>());

    expect(result.length).toBe(1);
    expect(result[0].address).toBe('tb1ptaproot');
  });

  it('should exclude specified UTXOs', () => {
    const excludedKeys = new Set(['tx1:0']);
    const result = getUnconfirmedUTXOsFromPending(mockPendingTxs, 'all', excludedKeys);

    expect(result.length).toBe(1);
    expect(result[0].vout).toBe(1);
  });

  it('should skip invalid transactions', () => {
    const result = getUnconfirmedUTXOsFromPending(mockPendingTxs, 'all', new Set<string>());

    expect(result).not.toContainEqual(expect.objectContaining({ txid: 'tx2' }));
  });

  it('should preserve parentTxid and assetType', () => {
    const txsWithParent = {
      tx1: {
        txid: 'tx1',
        status: 'pending',
        assetType: 'runes',
        parentTxid: 'parent1',
        outputs: [{ vout: 0, address: 'tb1qtest', value: 1000 }],
      },
    } as Record<string, PendingTransaction>;

    const result = getUnconfirmedUTXOsFromPending(txsWithParent, 'all', new Set<string>());

    expect(result[0].parentTxid).toBe('parent1');
    expect(result[0].assetType).toBe('runes');
  });
});

describe('calculateUnconfirmedBalance', () => {
  it('should calculate BTC balance from UTXOs', () => {
    const utxos = [
      { value: 50000 },
      { value: 30000 },
      { value: 20000 },
    ] as UnconfirmedUTXO[];

    const result = calculateUnconfirmedBalance(utxos);

    expect(result.btc).toBe(0.001); // 100000 sats = 0.001 BTC
  });

  it('should calculate runes balance from UTXOs', () => {
    const utxos = [
      { runeAmount: 500 },
      { runeAmount: 300 },
    ] as UnconfirmedUTXO[];

    const result = calculateUnconfirmedBalance(utxos);

    expect(result.runes).toBe(8); // 800 / 100 = 8 UNIT
  });

  it('should handle mixed BTC and runes', () => {
    const utxos = [
      { value: 100000000, runeAmount: 1000 },
    ] as UnconfirmedUTXO[];

    const result = calculateUnconfirmedBalance(utxos);

    expect(result.btc).toBe(1);
    expect(result.runes).toBe(10);
  });

  it('should handle empty array', () => {
    const result = calculateUnconfirmedBalance([]);

    expect(result.btc).toBe(0);
    expect(result.runes).toBe(0);
  });

  it('should handle missing values', () => {
    const utxos = [
      {},
      { value: 50000 },
    ] as UnconfirmedUTXO[];

    const result = calculateUnconfirmedBalance(utxos);

    expect(result.btc).toBe(0.0005); // Only counts the 50000 sats
  });
});

describe('invalidateChildrenRecursive', () => {
  it('should invalidate direct children', () => {
    const transactions = {
      parent: { status: 'pending', parentTxid: null },
      child1: { status: 'pending', parentTxid: 'parent' },
      child2: { status: 'pending', parentTxid: 'parent' },
    } as unknown as Record<string, PendingTransaction>;
    const invalidated: string[] = [];

    invalidateChildrenRecursive(transactions, 'parent', invalidated);

    expect(transactions.child1.status).toBe('invalid');
    expect(transactions.child2.status).toBe('invalid');
    expect(invalidated).toEqual(['child1', 'child2']);
  });

  it('should invalidate grandchildren recursively', () => {
    const transactions = {
      parent: { status: 'pending', parentTxid: null },
      child: { status: 'pending', parentTxid: 'parent' },
      grandchild: { status: 'pending', parentTxid: 'child' },
    } as unknown as Record<string, PendingTransaction>;
    const invalidated: string[] = [];

    invalidateChildrenRecursive(transactions, 'parent', invalidated);

    expect(transactions.child.status).toBe('invalid');
    expect(transactions.grandchild.status).toBe('invalid');
    expect(invalidated).toContain('child');
    expect(invalidated).toContain('grandchild');
  });

  it('should not invalidate unrelated transactions', () => {
    const transactions = {
      parent1: { status: 'pending', parentTxid: null },
      parent2: { status: 'pending', parentTxid: null },
      child1: { status: 'pending', parentTxid: 'parent1' },
      child2: { status: 'pending', parentTxid: 'parent2' },
    } as unknown as Record<string, PendingTransaction>;
    const invalidated: string[] = [];

    invalidateChildrenRecursive(transactions, 'parent1', invalidated);

    expect(transactions.child1.status).toBe('invalid');
    expect(transactions.child2.status).toBe('pending');
    expect(invalidated).toEqual(['child1']);
  });
});

describe('invalidateTransactionTree', () => {
  it('should invalidate transaction and return it in invalidated list', () => {
    const pendingTxs = {
      tx1: { status: 'pending', parentTxid: null },
    } as unknown as Record<string, PendingTransaction>;

    const result = invalidateTransactionTree(pendingTxs, 'tx1');

    expect(result.updated.tx1.status).toBe('invalid');
    expect(result.invalidated).toContain('tx1');
  });

  it('should invalidate all children', () => {
    const pendingTxs = {
      parent: { status: 'pending', parentTxid: null },
      child: { status: 'pending', parentTxid: 'parent' },
    } as unknown as Record<string, PendingTransaction>;

    const result = invalidateTransactionTree(pendingTxs, 'parent');

    expect(result.updated.parent.status).toBe('invalid');
    expect(result.updated.child.status).toBe('invalid');
    expect(result.invalidated).toEqual(['parent', 'child']);
  });

  it('should create new object (immutable)', () => {
    const pendingTxs = {
      tx1: { status: 'pending', parentTxid: null },
    } as unknown as Record<string, PendingTransaction>;

    const result = invalidateTransactionTree(pendingTxs, 'tx1');

    expect(result.updated).not.toBe(pendingTxs); // New object created
    expect(result.updated.tx1.status).toBe('invalid');
  });

  it('should handle non-existent transaction', () => {
    const pendingTxs = {
      tx1: { status: 'pending', parentTxid: null },
    } as unknown as Record<string, PendingTransaction>;

    const result = invalidateTransactionTree(pendingTxs, 'nonexistent');

    expect(result.invalidated).toEqual([]);
    expect(result.updated).toEqual(pendingTxs);
  });
});

describe('removeUtxoFromPending', () => {
  it('should remove specific output from transaction', () => {
    const pendingTxs = {
      tx1: {
        outputs: [
          { vout: 0, value: 1000 },
          { vout: 1, value: 2000 },
        ],
      },
    } as unknown as Record<string, PendingTransaction>;

    const result = removeUtxoFromPending(pendingTxs, 'tx1', 0);

    expect(result.tx1.outputs.length).toBe(1);
    expect(result.tx1.outputs[0].vout).toBe(1);
  });

  it('should remove transaction when last output is removed', () => {
    const pendingTxs = {
      tx1: {
        outputs: [{ vout: 0, value: 1000 }],
      },
    } as unknown as Record<string, PendingTransaction>;

    const result = removeUtxoFromPending(pendingTxs, 'tx1', 0);

    expect(result.tx1).toBeUndefined();
  });

  it('should create new object (immutable)', () => {
    const pendingTxs = {
      tx1: {
        outputs: [{ vout: 0, value: 1000 }],
      },
    } as unknown as Record<string, PendingTransaction>;

    const result = removeUtxoFromPending(pendingTxs, 'tx1', 0);

    expect(result).not.toBe(pendingTxs); // New object created
    expect(result.tx1).toBeUndefined();
  });

  it('should handle non-existent transaction', () => {
    const pendingTxs = {
      tx1: { outputs: [{ vout: 0 }] },
    } as unknown as Record<string, PendingTransaction>;

    const result = removeUtxoFromPending(pendingTxs, 'nonexistent', 0);

    expect(result).toEqual(pendingTxs);
  });

  it('should handle transaction without outputs', () => {
    const pendingTxs = {
      tx1: {},
    } as unknown as Record<string, PendingTransaction>;

    const result = removeUtxoFromPending(pendingTxs, 'tx1', 0);

    expect(result).toEqual(pendingTxs);
  });
});

describe('cleanupInvalidTransactions', () => {
  it('should remove invalid transactions', () => {
    const pendingTxs = {
      tx1: { status: 'pending' },
      tx2: { status: 'invalid' },
      tx3: { status: 'invalid' },
    } as unknown as Record<string, PendingTransaction>;

    const result = cleanupInvalidTransactions(pendingTxs);

    expect(result.updated.tx1).toBeDefined();
    expect(result.updated.tx2).toBeUndefined();
    expect(result.updated.tx3).toBeUndefined();
    expect(result.cleaned).toBe(2);
  });

  it('should return 0 cleaned when no invalid transactions', () => {
    const pendingTxs = {
      tx1: { status: 'pending' },
      tx2: { status: 'pending' },
    } as unknown as Record<string, PendingTransaction>;

    const result = cleanupInvalidTransactions(pendingTxs);

    expect(result.cleaned).toBe(0);
    expect(Object.keys(result.updated)).toHaveLength(2);
  });

  it('should not modify original object', () => {
    const pendingTxs = {
      tx1: { status: 'invalid' },
    } as unknown as Record<string, PendingTransaction>;

    const result = cleanupInvalidTransactions(pendingTxs);

    expect(pendingTxs.tx1).toBeDefined(); // Original unchanged
    expect(result.updated.tx1).toBeUndefined();
  });
});

describe('markUtxosAsSpent', () => {
  it('should mark single UTXO as spent', () => {
    const spentUtxos = new Set<string>();
    const utxos = [{ txid: 'abc', vout: 0 }];

    const result = markUtxosAsSpent(spentUtxos, utxos);

    expect(result.has('abc:0')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should mark multiple UTXOs as spent', () => {
    const spentUtxos = new Set<string>();
    const utxos = [
      { txid: 'abc', vout: 0 },
      { txid: 'def', vout: 1 },
    ];

    const result = markUtxosAsSpent(spentUtxos, utxos);

    expect(result.has('abc:0')).toBe(true);
    expect(result.has('def:1')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('should not modify original set', () => {
    const spentUtxos = new Set<string>();
    const utxos = [{ txid: 'abc', vout: 0 }];

    const result = markUtxosAsSpent(spentUtxos, utxos);

    expect(spentUtxos.size).toBe(0); // Original unchanged
    expect(result.size).toBe(1);
  });

  it('should preserve existing entries', () => {
    const spentUtxos = new Set(['existing:0']);
    const utxos = [{ txid: 'new', vout: 1 }];

    const result = markUtxosAsSpent(spentUtxos, utxos);

    expect(result.has('existing:0')).toBe(true);
    expect(result.has('new:1')).toBe(true);
    expect(result.size).toBe(2);
  });
});

describe('unmarkUtxosAsSpent', () => {
  it('should unmark single UTXO', () => {
    const spentUtxos = new Set(['abc:0']);
    const utxos = [{ txid: 'abc', vout: 0 }];

    const result = unmarkUtxosAsSpent(spentUtxos, utxos);

    expect(result.has('abc:0')).toBe(false);
    expect(result.size).toBe(0);
  });

  it('should unmark multiple UTXOs', () => {
    const spentUtxos = new Set(['abc:0', 'def:1', 'keep:2']);
    const utxos = [
      { txid: 'abc', vout: 0 },
      { txid: 'def', vout: 1 },
    ];

    const result = unmarkUtxosAsSpent(spentUtxos, utxos);

    expect(result.has('abc:0')).toBe(false);
    expect(result.has('def:1')).toBe(false);
    expect(result.has('keep:2')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should not modify original set', () => {
    const spentUtxos = new Set(['abc:0']);
    const utxos = [{ txid: 'abc', vout: 0 }];

    const result = unmarkUtxosAsSpent(spentUtxos, utxos);

    expect(spentUtxos.has('abc:0')).toBe(true); // Original unchanged
    expect(result.has('abc:0')).toBe(false);
  });

  it('should handle unmarking non-existent UTXO', () => {
    const spentUtxos = new Set(['abc:0']);
    const utxos = [{ txid: 'nonexistent', vout: 0 }];

    const result = unmarkUtxosAsSpent(spentUtxos, utxos);

    expect(result).toEqual(spentUtxos);
  });
});
