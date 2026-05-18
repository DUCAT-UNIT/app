import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(__dirname, '..');
const DEFAULT_FILES = ['.env', '.env.local'];

function parseValue(rawValue) {
  const trimmed = rawValue.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadDotenvFiles({
  root = DEFAULT_ROOT,
  files = DEFAULT_FILES,
  target = process.env,
  override = false,
} = {}) {
  const loaded = {};

  for (const filename of files) {
    const filePath = join(root, filename);
    if (!existsSync(filePath)) continue;

    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (!override && target[key] !== undefined) continue;

      const value = parseValue(rawValue);
      target[key] = value;
      loaded[key] = value;
    }
  }

  return loaded;
}

export function readDotenvEnvironment({
  root = DEFAULT_ROOT,
  files = DEFAULT_FILES,
  base = process.env,
  override = false,
} = {}) {
  const env = { ...base };
  loadDotenvFiles({ root, files, target: env, override });
  return env;
}

export function loadEasProfileEnv({
  root = DEFAULT_ROOT,
  profile = process.env.DUCAT_EAS_PROFILE || process.env.EAS_BUILD_PROFILE || 'production',
  target = process.env,
  override = false,
} = {}) {
  const easPath = join(root, 'eas.json');
  if (!profile || !existsSync(easPath)) return {};

  const easConfig = JSON.parse(readFileSync(easPath, 'utf8'));
  const env = easConfig?.build?.[profile]?.env;
  if (!env || typeof env !== 'object') return {};

  const loaded = {};
  for (const [key, value] of Object.entries(env)) {
    if (!override && target[key] !== undefined) continue;
    target[key] = String(value);
    loaded[key] = String(value);
  }
  return loaded;
}

export function loadProjectEnvironment({
  root = DEFAULT_ROOT,
  target = process.env,
  easProfile = process.env.DUCAT_EAS_PROFILE || process.env.EAS_BUILD_PROFILE || 'production',
} = {}) {
  const shellKeys = new Set(Object.keys(target));
  const loaded = {};

  Object.assign(loaded, loadEasProfileEnv({ root, profile: easProfile, target }));

  for (const filename of DEFAULT_FILES) {
    const filePath = join(root, filename);
    if (!existsSync(filePath)) continue;

    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (shellKeys.has(key)) continue;

      const value = parseValue(rawValue);
      target[key] = value;
      loaded[key] = value;
    }
  }

  return loaded;
}

export function readProjectEnvironment({ root = DEFAULT_ROOT, base = process.env } = {}) {
  const env = { ...base };
  loadProjectEnvironment({ root, target: env });
  return env;
}
