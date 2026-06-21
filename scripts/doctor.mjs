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
    scripts.verify?.includes('npm run parity:check') &&
      scripts.verify?.includes('npm run doctor') &&
      scripts.verify?.includes('npm run e2e:validate') &&
      scripts.verify?.includes('npm run test:coverage'),
    'npm run verify must include parity check, doctor, E2E validation, and Jest coverage'
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

  check(!/\bE2E\b.*\bbypass\b/i.test(appConfig), 'app.config.ts must not expose test shortcuts');
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
      pattern: /\b(?:token|tokenString)\??\.(?:substring|slice)\(/,
    },
    {
      name: 'token or URL preview logging',
      pattern: /\b(?:tokenPrefix|urlPreview)\b/,
    },
    {
      name: 'proof secret preview logging',
      pattern: /\b(?:secretPreview|secretPrefix|witnessSignaturePrefix)\b/,
    },
    {
      name: 'private key metadata logging',
      pattern: /\bprivateKeyLength\b/,
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

function checkCashuDucatUnitInvariant() {
  const mintConfig = read('services/cashu/mintClient/mintConfig.ts');
  const networkConfig = read('utils/networkConfig.ts');
  check(
    mintConfig.includes("'https://dev-cashu-mint.ducatprotocol.com'"),
    'Cashu mint config must default to the Ducat Cashu mint URL'
  );
  check(
    mintConfig.includes("export const CASHU_UNIT = 'unit'"),
    'Cashu mint config must use unit for Ducat UNIT'
  );
  check(
    mintConfig.includes('export const RUNE_ID = `${RUNES_CONFIG.DUCAT_UNIT_RUNE_ID.block}:${RUNES_CONFIG.DUCAT_UNIT_RUNE_ID.tx}`'),
    'Cashu mint config must derive the Ducat UNIT rune id from RUNES_CONFIG'
  );
  check(
    networkConfig.includes("block: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_BLOCK') ?? 3007902n") &&
      networkConfig.includes("tx: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_TX') ?? 1n"),
    'Network config must default the Ducat UNIT rune id to 3007902:1'
  );

  const codeFiles = getAppCodeFiles();
  const forbiddenEndpointPatterns = [
    '/v1/mint/quote/unit',
    '/v1/mint/unit',
    '/v1/melt/quote/unit',
    '/v1/melt/unit',
  ];
  const forbiddenMethodPatterns = [
    /\bmethod\s*:\s*['"]unit['"]/,
    /\bmethod\s*:\s*['"]runes['"]/,
  ];

  const endpointViolations = [];
  const methodViolations = [];
  for (const file of codeFiles) {
    const content = read(file);
    if (forbiddenEndpointPatterns.some((pattern) => content.includes(pattern))) {
      endpointViolations.push(file);
    }
    if (forbiddenMethodPatterns.some((pattern) => pattern.test(content))) {
      methodViolations.push(file);
    }
  }

  check(
    endpointViolations.length === 0,
    `Legacy Ducat Cashu UNIT endpoints must not exist in app code: ${endpointViolations.join(', ')}`
  );
  check(
    methodViolations.length === 0,
    `Legacy Ducat Cashu UNIT methods must not exist in app code: ${methodViolations.join(', ')}`
  );

  const cashuFiles = listFiles('services/cashu')
    .filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))
    .filter((file) => !file.includes('/__tests__/'));
  const satUnitViolations = cashuFiles.filter((file) =>
    /\bunit\s*:\s*['"]sat['"]/.test(read(file))
  );
  check(
    satUnitViolations.length === 0,
    `Ducat Cashu UNIT code must not construct sat-denominated UNIT tokens: ${satUnitViolations.join(', ')}`
  );

  const compat = read('services/cashu/cashuTsCompat.ts');
  check(
    compat.includes('cashuB') && compat.includes('sat tokens are BTC/Lightning only'),
    'cashuTsCompat must enforce v4 cashuB tokens and reject sat tokens for Ducat UNIT'
  );

  const uiCashuBoundaryViolations = ['contexts', 'hooks', 'screens', 'components']
    .flatMap(listFiles)
    .filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))
    .filter((file) => !file.includes('/__tests__/'))
    .filter((file) =>
      /services\/cashu\/(?:cashuMintClient|crypto|p2pk|mintClient|operations)/.test(read(file))
    );
  check(
    uiCashuBoundaryViolations.length === 0,
    `UI and hook code must use cashuWalletService as the Cashu adapter: ${uiCashuBoundaryViolations.join(', ')}`
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
checkCashuDucatUnitInvariant();
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
