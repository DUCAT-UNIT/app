#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const REQUIRED_MAJOR = 22;
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-node22.mjs <bin> [...args]');
  process.exit(1);
}

function nodeMajor(executable) {
  const result = spawnSync(executable, ['-p', 'process.versions.node.split(".")[0]'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  const parsed = Number(result.stdout.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function findNode22() {
  const candidates = [
    process.env.DUCAT_NODE22,
    join(homedir(), '.nvm/versions/node/v22.13.0/bin/node'),
    join(homedir(), '.nvm/versions/node/v22.12.0/bin/node'),
    '/opt/homebrew/opt/node@22/bin/node',
    '/usr/local/opt/node@22/bin/node',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate) && nodeMajor(candidate) === REQUIRED_MAJOR) {
      return candidate;
    }
  }

  return null;
}

function resolveBin(binName) {
  const packageByBin = {
    eslint: 'eslint',
    expo: 'expo',
    jest: 'jest',
    knip: 'knip',
    tsc: 'typescript',
  };

  const packageName = packageByBin[binName];
  if (!packageName) {
    return null;
  }

  const packageJsonPath = join(projectRoot, 'node_modules', packageName, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];
  if (!bin) {
    throw new Error(`Package ${packageName} does not expose bin ${binName}`);
  }

  return join(dirname(packageJsonPath), bin);
}

const currentMajor = Number(process.versions.node.split('.')[0]);
let nodeExecutable = process.execPath;

if (currentMajor !== REQUIRED_MAJOR) {
  const node22 = findNode22();
  if (!node22) {
    console.error(
      `DUCAT mobile requires Node ${REQUIRED_MAJOR}.x for tooling. Current Node is ${process.versions.node}.\n` +
      'Install Node 22 or set DUCAT_NODE22=/absolute/path/to/node.'
    );
    process.exit(1);
  }
  nodeExecutable = node22;
}

const binPath = resolveBin(command);
if (!binPath) {
  console.error(`Unsupported project bin: ${command}`);
  process.exit(1);
}

const result = spawnSync(nodeExecutable, [binPath, ...args], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
