#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const APP_CODE_ROOTS = [
  'App.tsx',
  'app.config.ts',
  'bridge-service',
  'components',
  'constants',
  'contexts',
  'hooks',
  'navigation',
  'pages',
  'screens',
  'services',
  'shared',
  'stores',
  'types',
  'utils',
];

const failures = [];
const warnings = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function listFiles(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stat = statSync(absolutePath);
  if (stat.isFile()) {
    return [relativePath];
  }

  const files = [];
  for (const entry of readdirSync(absolutePath)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'coverage' || entry === 'dist') {
      continue;
    }

    const child = join(relativePath, entry);
    const childStat = statSync(join(root, child));
    if (childStat.isDirectory()) {
      files.push(...listFiles(child));
    } else {
      files.push(child);
    }
  }

  return files;
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return `${result.stdout}${result.stderr}`.trim();
}

function major(version) {
  const match = version?.match(/(\d+)/);
  return match ? Number(match[1]) : null;
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
    if (existsSync(candidate) && nodeMajor(candidate) === 22) {
      return candidate;
    }
  }

  return null;
}

function checkRequiredTooling() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor !== 22) {
    const node22 = findNode22();
    check(Boolean(node22), `Node 22.x is required; current Node is ${process.versions.node} and no Node 22 fallback was found`);
    if (node22) {
      warn(`current shell uses Node ${process.versions.node}; project bin scripts will use ${node22}`);
    }
  }

  const npmVersion = commandVersion('npm');
  const npmMajor = major(npmVersion);
  check(npmMajor !== null && npmMajor >= 10, `npm >=10 is required; current npm is ${npmVersion ?? 'not found'}`);

  check(existsSync(join(root, 'package-lock.json')), 'package-lock.json is required for reproducible npm ci installs');
  check(existsSync(join(root, 'node_modules')), 'node_modules is missing; run npm ci before local verification');
}

function checkProjectScripts() {
  const packageJson = JSON.parse(read('package.json'));
  const scripts = packageJson.scripts || {};
  const requiredScripts = ['doctor', 'doctor:live', 'verify', 'typecheck', 'lint', 'deadcode', 'test', 'e2e:validate', 'e2e:live'];

  for (const script of requiredScripts) {
    check(typeof scripts[script] === 'string', `package.json is missing npm script ${script}`);
  }

  check(
    scripts.verify?.includes('npm run doctor') &&
      scripts.verify?.includes('npm run e2e:validate') &&
      scripts.verify?.includes('npm run test:coverage'),
    'npm run verify must include doctor, E2E validation, and Jest coverage'
  );
}

function getAppCodeFiles() {
  return APP_CODE_ROOTS
    .flatMap(listFiles)
    .filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))
    .filter((file) => !file.includes('/__tests__/'));
}

function checkMutinynetInvariant() {
  const appConfig = read('app.config.ts');
  const networkConfig = read('utils/networkConfig.ts');
  const envExample = read('.env.example');
  const codeFiles = getAppCodeFiles();
  const remoteConfigReferences = codeFiles.filter((file) => {
    const content = read(file);
    return /\b(remoteConfig|RemoteConfig)\b/.test(content);
  });

  check(
    appConfig.includes('EXPO_PUBLIC_E2E_BYPASS') && appConfig.includes('NODE_ENV === \'production\''),
    'app.config.ts must block EXPO_PUBLIC_E2E_BYPASS in production'
  );
  check(
    appConfig.includes('EXPO_PUBLIC_APP_NETWORK') && appConfig.includes('mutinynet'),
    'app.config.ts must reject non-mutinynet EXPO_PUBLIC_APP_NETWORK values'
  );
  check(
    networkConfig.includes("export type AppNetworkId = 'mutinynet'"),
    'utils/networkConfig.ts must keep AppNetworkId narrowed to mutinynet'
  );
  check(
    /if \(configured && configured !== 'mutinynet'\)/.test(networkConfig),
    'utils/networkConfig.ts must throw for non-mutinynet EXPO_PUBLIC_APP_NETWORK values'
  );
  check(
    envExample.includes('EXPO_PUBLIC_APP_NETWORK=mutinynet') &&
      !/Supported values:.*mainnet/i.test(envExample),
    '.env.example must document Mutinynet-only network configuration'
  );
  check(!existsSync(join(root, 'services', 'remoteConfigService.ts')), 'remoteConfigService.ts must not exist');
  check(!existsSync(join(root, 'stores', 'remoteConfigStore.ts')), 'remoteConfigStore.ts must not exist');
  check(
    remoteConfigReferences.length === 0,
    `Remote config references must not exist in app code: ${remoteConfigReferences.join(', ')}`
  );
}

function checkSensitiveLoggingInvariant() {
  const forbiddenPatterns = [
    {
      name: 'raw QR payload logging',
      pattern: /QR scanned[^;\n]*(?:,\s*data|\{\s*data\s*\})/i,
    },
    {
      name: 'QR payload preview logging',
      pattern: /first 100|tokenStart/i,
    },
    {
      name: 'direct token snippet logging',
      pattern: /logger\.[a-zA-Z]+\([^;\n]*(?:^|[^a-zA-Z0-9_])token\.(?:substring|slice)\(/,
    },
    {
      name: 'direct short URL logging',
      pattern: /logger\.[a-zA-Z]+\([^;\n]*shortUrl(?:\)|,|\s*\})/,
    },
    {
      name: 'raw response/error logging',
      pattern: /\b(?:rawResponse|fullResponse|rawError)\b/,
    },
    {
      name: 'raw witness logging',
      pattern: /\bwitness\s*:\s*[^,\n}]+\.witness\b/,
    },
  ];

  const violations = [];
  for (const file of getAppCodeFiles()) {
    const content = read(file);
    for (const { name, pattern } of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`${file} (${name})`);
      }
    }
  }

  check(
    violations.length === 0,
    `Sensitive logging guard failed: ${violations.join(', ')}`
  );
}

function checkOptionalNativeTooling() {
  if (!commandVersion('maestro')) {
    warn('Maestro CLI not found; install it before running npm run e2e locally');
  }
  if (!commandVersion('xcrun')) {
    warn('xcrun not found; iOS simulator reset/run scripts require Xcode command line tools');
  }
  if (!commandVersion('eas')) {
    warn('EAS CLI not found; production build/submit commands require eas-cli');
  }
}

checkRequiredTooling();
checkProjectScripts();
checkMutinynetInvariant();
checkSensitiveLoggingInvariant();
checkOptionalNativeTooling();

for (const message of warnings) {
  console.warn(`doctor warning: ${message}`);
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(`doctor failed: ${message}`);
  }
  process.exit(1);
}

console.log(`doctor passed${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}`);
