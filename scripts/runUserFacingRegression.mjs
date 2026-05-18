#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadProjectEnvironment } from './loadEnv.mjs';

loadProjectEnvironment();

const MANIFEST_PATH = 'e2e/user-facing-regression.json';
const DEFAULT_REPORT_PATH = 'artifacts/user-facing-regression/last-run.json';
const DEFAULT_PROFILE = 'pr';

const args = process.argv.slice(2);
const options = new Set(args.filter((arg) => arg.startsWith('--')));
const profileArgs = args.filter((arg) => !arg.startsWith('--'));

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const startedAtMs = Date.now();
const report = {
  schemaVersion: 1,
  kind: 'ducat.user-facing-regression',
  manifestPath: MANIFEST_PATH,
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: null,
  durationMs: null,
  profiles: [],
  suites: [],
  result: 'running',
  validationErrors: [],
  gaps: [],
};

function usage() {
  console.log(`Usage: node scripts/runUserFacingRegression.mjs [profile ...] [options]

Profiles:
${Object.entries(manifest.profiles)
  .map(([id, profile]) => `  ${id.padEnd(10)} ${profile.description}`)
  .join('\n')}

Options:
  --list              Print profiles, suites, critical-flow coverage, and known gaps.
  --validate          Validate the regression manifest without running suites.
  --dry-run           Print selected suites and commands without running them.
  --enforce-complete  Fail validation if any critical/high-risk flow has no coverage.

Default profile: ${DEFAULT_PROFILE}
Report: ${DEFAULT_REPORT_PATH}`);
}

function unique(values) {
  return [...new Set(values)];
}

function suiteIdsForProfiles(profileIds) {
  return unique(
    profileIds.flatMap((profileId) => {
      const profile = manifest.profiles[profileId];
      if (!profile) {
        throw new Error(`Unknown user-facing regression profile "${profileId}".`);
      }
      return profile.suites;
    })
  );
}

function validateManifest({ enforceComplete = false } = {}) {
  const errors = [];
  const suiteIds = new Set(Object.keys(manifest.suites || {}));

  for (const [profileId, profile] of Object.entries(manifest.profiles || {})) {
    if (!Array.isArray(profile.suites) || profile.suites.length === 0) {
      errors.push(`Profile "${profileId}" must reference at least one suite.`);
      continue;
    }

    for (const suiteId of profile.suites) {
      if (!suiteIds.has(suiteId)) {
        errors.push(`Profile "${profileId}" references unknown suite "${suiteId}".`);
      }
    }
  }

  for (const [suiteId, suite] of Object.entries(manifest.suites || {})) {
    if (!Array.isArray(suite.command) || suite.command.length === 0) {
      errors.push(`Suite "${suiteId}" must define a non-empty command array.`);
      continue;
    }

    for (const part of suite.command) {
      if (typeof part !== 'string' || part.length === 0) {
        errors.push(`Suite "${suiteId}" command entries must be non-empty strings.`);
      }
    }

    for (const part of suite.command) {
      if (!part.endsWith('.yaml')) continue;
      if (!existsSync(resolve(process.cwd(), part))) {
        errors.push(`Suite "${suiteId}" references missing Maestro flow "${part}".`);
      }
    }
  }

  for (const flow of manifest.criticalFlows || []) {
    const coverage = Array.isArray(flow.coverage) ? flow.coverage : [];
    for (const suiteId of coverage) {
      if (!suiteIds.has(suiteId)) {
        errors.push(`Critical flow "${flow.id}" references unknown suite "${suiteId}".`);
      }
    }

    if (enforceComplete && coverage.length === 0) {
      errors.push(
        `Critical flow "${flow.id}" has no automated coverage: ${flow.gap || 'gap not documented'}`
      );
    }
  }

  return errors;
}

function knownGaps() {
  return (manifest.criticalFlows || []).filter(
    (flow) => !flow.coverage || flow.coverage.length === 0
  );
}

function printInventory() {
  console.log('User-facing regression profiles:');
  for (const [id, profile] of Object.entries(manifest.profiles)) {
    console.log(`  ${id}: ${profile.description}`);
    console.log(`    suites: ${profile.suites.join(', ')}`);
  }

  console.log('\nSuites:');
  for (const [id, suite] of Object.entries(manifest.suites)) {
    console.log(`  ${id} [${suite.tier}/${suite.kind}]: ${suite.description}`);
    console.log(`    ${suite.command.join(' ')}`);
  }

  console.log('\nCritical flow coverage:');
  for (const flow of manifest.criticalFlows || []) {
    const coverage = flow.coverage?.length ? flow.coverage.join(', ') : 'GAP';
    console.log(`  ${flow.id} (${flow.risk}/${flow.surface}): ${coverage}`);
    if (flow.gap) console.log(`    gap: ${flow.gap}`);
  }
}

function writeReport() {
  const reportPath = process.env.DUCAT_USER_FACING_REGRESSION_REPORT_PATH || DEFAULT_REPORT_PATH;
  if (reportPath === 'off' || reportPath === 'false') return;

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAtMs;
  report.gaps = knownGaps().map((flow) => ({
    id: flow.id,
    surface: flow.surface,
    risk: flow.risk,
    gap: flow.gap || null,
  }));

  const absolutePath = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(`${absolutePath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${absolutePath}.tmp`, absolutePath);
  console.log(`User-facing regression report written to ${reportPath}`);
}

function runSuite(suiteId) {
  const suite = manifest.suites[suiteId];
  const [command, ...commandArgs] = suite.command;
  const suiteReport = {
    id: suiteId,
    tier: suite.tier,
    kind: suite.kind,
    command: suite.command,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    status: 'running',
    exitCode: null,
    signal: null,
  };
  const suiteStartedAt = Date.now();
  report.suites.push(suiteReport);

  console.log(`\n=== ${suiteId} ===`);
  console.log(suite.description);
  console.log(`$ ${suite.command.join(' ')}`);

  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  suiteReport.finishedAt = new Date().toISOString();
  suiteReport.durationMs = Date.now() - suiteStartedAt;
  suiteReport.exitCode = result.status ?? null;
  suiteReport.signal = result.signal ?? null;

  if (result.error) {
    suiteReport.status = 'failed';
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    suiteReport.status = 'failed';
    return false;
  }

  suiteReport.status = 'passed';
  return true;
}

try {
  if (options.has('--help') || options.has('-h')) {
    usage();
    process.exit(0);
  }

  const validationErrors = validateManifest({
    enforceComplete: options.has('--enforce-complete'),
  });
  report.validationErrors = validationErrors;

  if (options.has('--list')) {
    printInventory();
    if (validationErrors.length > 0) {
      console.log('\nValidation errors:');
      for (const error of validationErrors) console.log(`  - ${error}`);
    }
    report.result = validationErrors.length > 0 ? 'failed' : 'passed';
    writeReport();
    process.exit(validationErrors.length > 0 ? 1 : 0);
  }

  if (validationErrors.length > 0) {
    for (const error of validationErrors) console.error(`manifest validation failed: ${error}`);
    report.result = 'failed';
    writeReport();
    process.exit(1);
  }

  if (options.has('--validate')) {
    console.log('User-facing regression manifest is valid.');
    const gaps = knownGaps();
    if (gaps.length > 0) {
      console.log(`Known automation gaps: ${gaps.map((gap) => gap.id).join(', ')}`);
    }
    report.result = 'passed';
    writeReport();
    process.exit(0);
  }

  const selectedProfiles = profileArgs.length > 0 ? profileArgs : [DEFAULT_PROFILE];
  const selectedSuiteIds = suiteIdsForProfiles(selectedProfiles);
  report.profiles = selectedProfiles;

  console.log(`Selected profiles: ${selectedProfiles.join(', ')}`);
  console.log(`Selected suites: ${selectedSuiteIds.join(', ')}`);

  if (options.has('--dry-run')) {
    for (const suiteId of selectedSuiteIds) {
      const suite = manifest.suites[suiteId];
      console.log(`${suiteId}: ${suite.command.join(' ')}`);
    }
    report.result = 'passed';
    writeReport();
    process.exit(0);
  }

  let failed = 0;
  for (const suiteId of selectedSuiteIds) {
    if (!runSuite(suiteId)) failed += 1;
  }

  report.result = failed > 0 ? 'failed' : 'passed';
  writeReport();
  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  report.result = 'failed';
  report.validationErrors.push(error instanceof Error ? error.message : String(error));
  console.error(error instanceof Error ? error.message : String(error));
  writeReport();
  process.exit(1);
}
