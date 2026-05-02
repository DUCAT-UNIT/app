#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const checks = [
  {
    file: 'utils/evmCheckpointDisplay.ts',
    patterns: [
      /mapEvmCheckpointToHistoryItem/,
      /mergeEvmHistoryWithCheckpoints/,
      /isSelfTransfer/,
    ],
  },
  {
    file: 'contexts/EvmAssetsContext.tsx',
    patterns: [
      /backfillEvmHistoryFromCheckpoints/,
      /evmCheckpoints/,
    ],
  },
  {
    file: 'stores/pendingVaultTransactionStore.ts',
    patterns: [
      /getPendingAsHistoryTransaction/,
      /recordPendingVaultJournal/,
    ],
  },
  {
    file: 'stores/pendingTransactionsStore.ts',
    patterns: [
      /recordPendingSendJournal/,
      /confirmTransaction/,
      /invalidateTransaction/,
    ],
  },
  {
    file: 'stores/operationJournalStore.ts',
    patterns: [
      /OperationJournalKind/,
      /evm_transfer/,
      /vault_borrow/,
      /unit_send/,
    ],
  },
];

const failures = [];

for (const check of checks) {
  const filePath = join(root, check.file);
  if (!existsSync(filePath)) {
    failures.push(`${check.file} is missing`);
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      failures.push(`${check.file} does not satisfy ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`history audit failed: ${failure}`);
  }
  process.exit(1);
}

console.log('History audit passed: BTC/UNIT pending sends, vault pending operations, EVM checkpoints, and self-transfer display hooks are present.');
