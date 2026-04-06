/**
 * Remote Config Service
 * Fetches, validates, and caches the server-hosted app configuration.
 * Fallback chain: network fetch → AsyncStorage cache → hardcoded default.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type {
  RemoteConfig,
  AppNetworkId,
  AnnouncementShowMode,
} from '../types/remoteConfig';

// ============================================================
// Constants
// ============================================================

const REMOTE_CONFIG_URL =
  process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL || 'https://config.ducatprotocol.com/app.json';
const CACHE_KEY = '@ducat/remote_config';
const CACHE_HASH_KEY = '@ducat/remote_config_hash';
const FETCH_TIMEOUT_MS = 5000;

// ============================================================
// Default Config (matches current app behavior)
// ============================================================

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  version: '0.0.0',
  hash: 'default',
  network: {
    id: 'mutinynet',
    endpointOverrides: {
      esploraApiUrl: null,
      ordUrl: null,
      guardianWs: null,
      quoteServer: null,
      priceServer: null,
      vaultUrl: null,
      phoneUrl: null,
      feeRecommendationsUrl: null,
      faucetUrl: null,
    },
  },
  banner: {
    visible: true,
    text: 'Mutinynet Edition',
    textColor: '#8B5CF6',
    backgroundColor: '#1D1C21',
  },
  announcement: {
    id: '',
    enabled: false,
    title: '',
    body: '',
    imageUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    showMode: 'once',
  },
  features: {},
};

// ============================================================
// Validation
// ============================================================

const VALID_NETWORK_IDS: AppNetworkId[] = ['mutinynet', 'mainnet'];
const VALID_SHOW_MODES: AnnouncementShowMode[] = ['once', 'always'];

function isHexColor(s: unknown): boolean {
  return typeof s === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(s);
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

export function validateRemoteConfig(raw: unknown): RemoteConfig | null {
  try {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;

    // Version + hash
    if (typeof obj.version !== 'string') return null;
    if (typeof obj.hash !== 'string') return null;

    // Network
    const network = obj.network as Record<string, unknown> | undefined;
    if (!network || typeof network !== 'object') return null;
    if (!VALID_NETWORK_IDS.includes(network.id as AppNetworkId)) return null;

    const overrides = network.endpointOverrides as Record<string, unknown> | undefined;
    if (!overrides || typeof overrides !== 'object') return null;
    const overrideKeys = [
      'esploraApiUrl', 'ordUrl', 'guardianWs', 'quoteServer',
      'priceServer', 'vaultUrl', 'phoneUrl', 'feeRecommendationsUrl', 'faucetUrl',
    ];
    for (const key of overrideKeys) {
      if (!(key in overrides)) continue;
      if (!isStringOrNull(overrides[key])) return null;
    }

    // Banner
    const banner = obj.banner as Record<string, unknown> | undefined;
    if (!banner || typeof banner !== 'object') return null;
    if (typeof banner.visible !== 'boolean') return null;
    if (typeof banner.text !== 'string') return null;
    if (!isHexColor(banner.textColor)) return null;
    if (!isHexColor(banner.backgroundColor)) return null;

    // Announcement
    const ann = obj.announcement as Record<string, unknown> | undefined;
    if (!ann || typeof ann !== 'object') return null;
    if (typeof ann.id !== 'string') return null;
    if (typeof ann.enabled !== 'boolean') return null;
    if (typeof ann.title !== 'string') return null;
    if (typeof ann.body !== 'string') return null;
    if (!isStringOrNull(ann.imageUrl)) return null;
    if (!isStringOrNull(ann.ctaLabel)) return null;
    if (!isStringOrNull(ann.ctaUrl)) return null;
    if (!VALID_SHOW_MODES.includes(ann.showMode as AnnouncementShowMode)) return null;

    return raw as RemoteConfig;
  } catch {
    return null;
  }
}

// ============================================================
// Fetch + Cache
// ============================================================

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  // 1. Try network fetch
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(REMOTE_CONFIG_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const validated = validateRemoteConfig(data);

    if (!validated) {
      logger.warn('[RemoteConfig] Invalid config from server, using cache');
      return loadCachedConfig();
    }

    // Compare hash — skip write if unchanged
    const cachedHash = await AsyncStorage.getItem(CACHE_HASH_KEY);
    if (cachedHash !== validated.hash) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(validated));
      await AsyncStorage.setItem(CACHE_HASH_KEY, validated.hash);
      logger.debug('[RemoteConfig] Config updated', {
        version: validated.version,
        hash: validated.hash,
      });
    }

    return validated;
  } catch (err: unknown) {
    logger.debug('[RemoteConfig] Fetch failed, using cache', {
      error: err instanceof Error ? err.message : String(err),
    });
    return loadCachedConfig();
  }
}

export async function loadCachedConfig(): Promise<RemoteConfig> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const validated = validateRemoteConfig(parsed);
      if (validated) return validated;
    }
  } catch {
    // ignore
  }
  return DEFAULT_REMOTE_CONFIG;
}

// ============================================================
// Endpoint Merge
// ============================================================

export function mergeEndpointOverrides<T extends Record<string, string | null>>(
  base: T,
  overrides: Record<string, string | null>,
): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && key in result) {
      (result as Record<string, string | null>)[key] = value;
    }
  }
  return result;
}
