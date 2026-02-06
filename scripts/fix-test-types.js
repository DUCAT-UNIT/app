/**
 * Script to fix common TypeScript errors in test files
 * Run with: node scripts/fix-test-types.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all test files with TypeScript errors
const testFiles = execSync(
  'npx tsc --noEmit 2>&1 | grep "error TS" | grep "__tests__" | cut -d"(" -f1 | sort | uniq',
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${testFiles.length} test files with errors`);

// Common fixes
const fixes = [
  // Fix untyped renderHook pattern - capture the full function signature
  {
    pattern: /function renderHook\(hook(?:,\s*(?:\{[^}]*\}|\w+))?\s*(?:=\s*\{\})?\)\s*\{[\s\S]*?const result:\s*\{\s*current:\s*T\s*\|\s*null\s*\}/g,
    replacement: (match) => {
      // Already typed or complex - try to fix T reference
      if (match.includes('<T>')) return match;
      return match.replace(
        /function renderHook\(hook/,
        'function renderHook<T>(hook: () => T'
      ).replace(
        /const result:\s*\{\s*current:\s*T\s*\|\s*null\s*\}/,
        'const result: { current: T | null }'
      );
    }
  },
  // Fix hook.mockReturnValue patterns
  {
    pattern: /(\w+Hook|\w+use\w+)\.mockReturnValue\(/g,
    replacement: '($1 as jest.Mock).mockReturnValue('
  },
  // Fix store.mockReturnValue patterns  
  {
    pattern: /(use\w+Store)\.mockReturnValue\(/g,
    replacement: '($1 as jest.Mock).mockReturnValue('
  },
  // Fix context hook patterns
  {
    pattern: /(use(?:SendFlow|Wallet|TransactionBuild|PendingTransactions|BalanceData|CashuBalance|WalletData|Price|Auth|Settings|DisplayPreferences|Notification|UI|Navigation))\.mockReturnValue\(/g,
    replacement: '($1 as jest.Mock).mockReturnValue('
  },
  // Fix .mock.calls access
  {
    pattern: /(\w+)\.mock\.calls/g,
    replacement: '($1 as jest.Mock).mock.calls'
  },
  // Fix .mockClear() without cast
  {
    pattern: /(\w+Service\.\w+)\.mockClear\(\)/g,
    replacement: '($1 as jest.Mock).mockClear()'
  },
  // Fix .mockResolvedValue without cast
  {
    pattern: /(\w+Service\.\w+)\.mockResolvedValue\(/g,
    replacement: '($1 as jest.Mock).mockResolvedValue('
  },
  // Fix .mockRejectedValue without cast
  {
    pattern: /(\w+Service\.\w+)\.mockRejectedValue\(/g,
    replacement: '($1 as jest.Mock).mockRejectedValue('
  },
  // Fix .mockImplementation without cast
  {
    pattern: /(\w+Service\.\w+)\.mockImplementation\(/g,
    replacement: '($1 as jest.Mock).mockImplementation('
  },
];

let totalFixed = 0;

testFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf-8');
  let modified = false;
  
  fixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    totalFixed++;
    console.log(`Fixed: ${file}`);
  }
});

console.log(`\nTotal files modified: ${totalFixed}`);
