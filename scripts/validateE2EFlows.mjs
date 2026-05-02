import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const productSuites = ['auth', 'wallet', 'send', 'settings', 'vault', 'ecash'];
const flowsRoot = path.join(root, 'e2e', 'maestro', 'flows');
const legacyHelpersRoot = path.join(root, 'e2e', 'maestro', 'helpers');
const configPath = path.join(flowsRoot, 'config.yaml');
const packagePath = path.join(root, 'package.json');
const coveragePath = path.join(root, 'e2e', 'maestro', 'E2E_COVERAGE_REPORT.md');

function fail(message) {
  console.error(`E2E validation failed: ${message}`);
  process.exitCode = 1;
}

function listYamlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.yaml') || entry.endsWith('.yml'))
    .map((entry) => path.join(dir, entry));
}

function listYamlFilesRecursive(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listYamlFilesRecursive(entryPath);
    }
    return entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') ? [entryPath] : [];
  });
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function validateRunFlowReferences(files) {
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const references = text.matchAll(/runFlow:\s*['"]?([^'"\s#]+\.ya?ml)['"]?/g);

    for (const match of references) {
      const referencedPath = path.resolve(path.dirname(file), match[1]);
      if (!existsSync(referencedPath)) {
        fail(`${relative(file)} references missing runFlow ${match[1]}`);
      }
    }
  }
}

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const scripts = packageJson.scripts || {};
const referencedFlows = Object.values(scripts)
  .flatMap((script) => String(script).match(/e2e\/maestro\/flows\/[^\s]+\.ya?ml/g) || []);

for (const relativeFlow of referencedFlows) {
  if (!existsSync(path.join(root, relativeFlow))) {
    fail(`package.json references missing flow ${relativeFlow}`);
  }
}

const liveScript = String(scripts['e2e:live'] || '');
const liveFlowsRoot = path.join(flowsRoot, 'test');
if (!liveScript.includes('npm run doctor:live')) {
  fail('package.json e2e:live must run doctor:live before live/ad-hoc flows');
}
if (!liveScript.includes('e2e/maestro/flows/test/')) {
  fail('package.json e2e:live must target e2e/maestro/flows/test/');
}
if (!existsSync(liveFlowsRoot) || listYamlFiles(liveFlowsRoot).length === 0) {
  fail('live/ad-hoc flow directory e2e/maestro/flows/test must contain YAML flows');
}

const legacyHelperYaml = listYamlFiles(legacyHelpersRoot);
if (legacyHelperYaml.length > 0) {
  fail(
    `legacy e2e/maestro/helpers must contain shell helpers only; YAML helpers belong under e2e/maestro/flows/helpers (${legacyHelperYaml
      .map(relative)
      .join(', ')})`
  );
}

const config = readFileSync(configPath, 'utf8');
if (/helpers\//.test(config) || /test\//.test(config)) {
  fail('flows/config.yaml must not include helpers or live/ad-hoc test flows');
}

for (const suite of productSuites) {
  const suitePath = path.join(flowsRoot, suite);
  if (!existsSync(suitePath) || !statSync(suitePath).isDirectory()) {
    fail(`missing product suite directory ${suite}`);
    continue;
  }

  if (listYamlFiles(suitePath).length === 0) {
    fail(`product suite ${suite} has no YAML flows`);
  }

  const seenPrefixes = new Map();
  for (const file of listYamlFiles(suitePath)) {
    const prefix = path.basename(file).match(/^(\d+)-/)?.[1];
    if (!prefix) continue;

    if (seenPrefixes.has(prefix)) {
      fail(`product suite ${suite} has duplicate numeric prefix ${prefix}: ${relative(seenPrefixes.get(prefix))} and ${relative(file)}`);
    }
    seenPrefixes.set(prefix, file);
  }
}

validateRunFlowReferences(listYamlFilesRecursive(flowsRoot));

const productFlowCount = productSuites.reduce(
  (count, suite) => count + listYamlFiles(path.join(flowsRoot, suite)).length,
  0,
);
const coverageReport = readFileSync(coveragePath, 'utf8');
const documentedCount = coverageReport.match(/Current State: (\d+) Maintained Product Flows/)?.[1];
if (documentedCount && Number(documentedCount) !== productFlowCount) {
  fail(`coverage report says ${documentedCount} product flows, but found ${productFlowCount}`);
}

if (!process.exitCode) {
  console.log(`E2E validation passed: ${productFlowCount} maintained product flows`);
}
