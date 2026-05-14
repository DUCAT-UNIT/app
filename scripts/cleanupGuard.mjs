#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = [
  'components',
  'contexts',
  'hooks',
  'navigation',
  'pages',
  'screens',
  'services',
  'stores',
  'utils',
];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_PATH_PARTS = new Set(['__tests__', '__mocks__']);
const IGNORED_FILE_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/];
const CONSOLE_ALLOWLIST = new Set(['utils/logger.ts']);
const FORBIDDEN_WORKSPACE_IMPORT_PATTERN =
  /(?:from\s+|import\s*\(\s*)['"](?:\.\.\/)+(?:bridge-service|evm|web)(?:\/|['"])/;

function toPosix(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function shouldScan(filePath) {
  const relative = toPosix(filePath);
  const parts = relative.split('/');
  const extension = path.extname(filePath);

  if (!SOURCE_EXTENSIONS.has(extension)) {
    return false;
  }

  if (parts.some((part) => IGNORED_PATH_PARTS.has(part))) {
    return false;
  }

  return !IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(relative));
}

function walk(dirPath, files = []) {
  for (const entry of readdirSync(dirPath)) {
    const filePath = path.join(dirPath, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      walk(filePath, files);
    } else if (shouldScan(filePath)) {
      files.push(filePath);
    }
  }

  return files;
}

const violations = [];

for (const sourceDir of SOURCE_DIRS) {
  const absoluteDir = path.join(ROOT, sourceDir);
  const files = walk(absoluteDir);

  for (const filePath of files) {
    const relative = toPosix(filePath);
    const lines = readFileSync(filePath, 'utf8').split('\n');

    lines.forEach((line, index) => {
      if (/\bas\s+never\b/.test(line)) {
        violations.push({
          file: relative,
          line: index + 1,
          reason: 'Avoid production `as never`; use a typed adapter or local type boundary.',
        });
      }

      if (
        !CONSOLE_ALLOWLIST.has(relative) &&
        /\bconsole\.(log|warn|error|info|debug)\b/.test(line)
      ) {
        violations.push({
          file: relative,
          line: index + 1,
          reason: 'Use utils/logger instead of raw console calls in production code.',
        });
      }

      if (FORBIDDEN_WORKSPACE_IMPORT_PATTERN.test(line)) {
        violations.push({
          file: relative,
          line: index + 1,
          reason:
            'Do not import bridge-service, evm, or web into the mobile app runtime; use API/shared contracts instead.',
        });
      }
    });
  }
}

if (violations.length > 0) {
  console.error('cleanup guard failed:');
  violations.forEach((violation) => {
    console.error(`- ${violation.file}:${violation.line} ${violation.reason}`);
  });
  process.exit(1);
}

console.log('cleanup guard passed');
