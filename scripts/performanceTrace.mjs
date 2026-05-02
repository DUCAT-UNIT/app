#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SEARCH_ROOTS = ['app', 'components', 'contexts', 'hooks', 'screens', 'services', 'stores', 'utils'];
const ALLOWED_DIRECT_FETCH_FILES = new Set([
  'utils/api.ts',
  'utils/apiClient.ts',
  'scripts/liveIntegrationDoctor.mjs',
]);

function listFiles(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return [];

  const stat = statSync(absolutePath);
  if (stat.isFile()) return [relativePath];

  return readdirSync(absolutePath).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '__tests__') return [];
    const child = join(relativePath, entry);
    const childStat = statSync(join(root, child));
    return childStat.isDirectory() ? listFiles(child) : [child];
  });
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const files = SEARCH_ROOTS
  .flatMap(listFiles)
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

const failures = [];
const warnings = [];

for (const file of files) {
  const content = read(file);
  const directFetch = /\bfetch\s*\(/.test(content);
  if (directFetch && !ALLOWED_DIRECT_FETCH_FILES.has(file) && !file.includes('/__tests__/')) {
    warnings.push(`${file} uses direct fetch; prefer apiClient/requestPolicy for retry, timeout, and classified errors.`);
  }
}

const requiredFiles = [
  'components/common/OperationBusyIndicator.tsx',
  'components/common/OperationRecoveryCard.tsx',
  'utils/requestPolicy.ts',
  'utils/errorTaxonomy.ts',
  'services/reconciliationWorker.ts',
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`${file} is required for the async feedback/recovery performance pass.`);
  }
}

const walletData = existsSync(join(root, 'contexts/WalletDataContext.tsx'))
  ? read('contexts/WalletDataContext.tsx')
  : '';
if (!/isRefreshing|lastUpdated|isStale|reconciliation/i.test(walletData)) {
  failures.push('WalletDataContext should expose refresh/stale/reconciliation state for traceable first-load behavior.');
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`performance audit warning: ${warning}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`performance audit failed: ${failure}`);
  }
  process.exit(1);
}

console.log('Performance audit passed: shared busy/recovery components and request policy are present.');
console.log('Manual trace target: cold launch -> wallet first paint -> vault stale data render -> background refresh -> send review tap latency.');
