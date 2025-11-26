#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('services/**/*.test.ts');

console.log(`Found ${testFiles.length} test files to fix`);

const fixes = [
  // Global object fixes
  { pattern: /\bglobal\.fetch(?![\w])/g, replacement: '(global as any).fetch' },
  { pattern: /\bglobal\.atob(?![\w])/g, replacement: '(global as any).atob' },
  { pattern: /\bdelete global\./g, replacement: 'delete (global as any).' },
  {pattern: /(\s+)(global\.processedCashuTokens(?![\w]))/g, replacement: '$1(global as any).processedCashuTokens' },
  { pattern: /(\s+)(global\.processedCashuTokensLoading(?![\w]))/g, replacement: '$1(global as any).processedCashuTokensLoading' },
  { pattern: /(\s+)(global\.pendingCashuToken(?![\w]))/g, replacement: '$1(global as any).pendingCashuToken' },
  { pattern: /(\s+)(global\.pendingTurboSnackbars(?![\w]))/g, replacement: '$1(global as any).pendingTurboSnackbars' },
  { pattern: /(\s+)(global\.turboJustResumed(?![\w]))/g, replacement: '$1(global as any).turboJustResumed' },
];

testFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');

  let changed = false;
  fixes.forEach(({ pattern, replacement }) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      changed = true;
      content = newContent;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
});

console.log('All files processed!');
