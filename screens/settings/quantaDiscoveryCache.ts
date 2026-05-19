import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WalletDerivationMode } from '../../constants/bitcoin';
import { logger } from '../../utils/logger';
import { getCandidateKey, type QuantaAccountCandidate } from './quantaLinkUtils';

const QUANTA_DISCOVERY_CACHE_VERSION = 1;
const QUANTA_DISCOVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const QUANTA_DISCOVERY_CACHE_PREFIX = 'quanta_discovery_cache_v1';

interface QuantaDiscoveryCacheParams {
  accountIndex: number;
  derivationMode: WalletDerivationMode;
  targetAddress: string;
  walletFingerprint: string | null | undefined;
}

interface SaveQuantaDiscoveryCacheParams extends QuantaDiscoveryCacheParams {
  candidates: QuantaAccountCandidate[];
  hasNoQuantaInWallet: boolean;
  selectedCandidateKey: string | null;
}

interface QuantaDiscoveryCacheRecord {
  version: typeof QUANTA_DISCOVERY_CACHE_VERSION;
  accountIndex: number;
  derivationMode: WalletDerivationMode;
  targetAddress: string;
  walletFingerprint: string;
  candidates: QuantaAccountCandidate[];
  hasNoQuantaInWallet: boolean;
  selectedCandidateKey: string | null;
  updatedAt: number;
}

export interface QuantaDiscoveryCacheResult {
  candidates: QuantaAccountCandidate[];
  hasNoQuantaInWallet: boolean;
  selectedCandidateKey: string | null;
}

function normalizeTargetAddress(targetAddress: string): string {
  return targetAddress.trim().toLowerCase();
}

function normalizeWalletFingerprint(walletFingerprint: string | null | undefined): string | null {
  const normalized = walletFingerprint?.trim().toLowerCase();
  return normalized || null;
}

function getQuantaDiscoveryCacheKey({
  accountIndex,
  derivationMode,
  targetAddress,
  walletFingerprint,
}: QuantaDiscoveryCacheParams): string | null {
  const normalizedFingerprint = normalizeWalletFingerprint(walletFingerprint);
  if (!normalizedFingerprint) {
    return null;
  }

  const normalizedTarget = normalizeTargetAddress(targetAddress) || 'wallet';
  return [
    QUANTA_DISCOVERY_CACHE_PREFIX,
    derivationMode,
    String(accountIndex),
    normalizedFingerprint,
    normalizedTarget,
  ].join(':');
}

function isCacheRecord(value: unknown): value is QuantaDiscoveryCacheRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Partial<QuantaDiscoveryCacheRecord>;
  return (
    record.version === QUANTA_DISCOVERY_CACHE_VERSION &&
    typeof record.accountIndex === 'number' &&
    typeof record.derivationMode === 'string' &&
    typeof record.targetAddress === 'string' &&
    typeof record.walletFingerprint === 'string' &&
    Array.isArray(record.candidates) &&
    typeof record.hasNoQuantaInWallet === 'boolean' &&
    (typeof record.selectedCandidateKey === 'string' || record.selectedCandidateKey === null) &&
    typeof record.updatedAt === 'number'
  );
}

export async function saveQuantaDiscoveryCache({
  accountIndex,
  candidates,
  derivationMode,
  hasNoQuantaInWallet,
  selectedCandidateKey,
  targetAddress,
  walletFingerprint,
}: SaveQuantaDiscoveryCacheParams): Promise<void> {
  const storageKey = getQuantaDiscoveryCacheKey({
    accountIndex,
    derivationMode,
    targetAddress,
    walletFingerprint,
  });
  const normalizedFingerprint = normalizeWalletFingerprint(walletFingerprint);
  if (!storageKey || !normalizedFingerprint) {
    return;
  }

  const fallbackSelectedKey = candidates[0] ? getCandidateKey(candidates[0]) : null;
  const record: QuantaDiscoveryCacheRecord = {
    version: QUANTA_DISCOVERY_CACHE_VERSION,
    accountIndex,
    derivationMode,
    targetAddress: normalizeTargetAddress(targetAddress),
    walletFingerprint: normalizedFingerprint,
    candidates,
    hasNoQuantaInWallet,
    selectedCandidateKey: selectedCandidateKey ?? fallbackSelectedKey,
    updatedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(record));
  } catch (error: unknown) {
    logger.warn('[QuantaDiscoveryCache] Failed to save discovery cache', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function loadQuantaDiscoveryCache({
  accountIndex,
  derivationMode,
  targetAddress,
  walletFingerprint,
}: QuantaDiscoveryCacheParams): Promise<QuantaDiscoveryCacheResult | null> {
  const storageKey = getQuantaDiscoveryCacheKey({
    accountIndex,
    derivationMode,
    targetAddress,
    walletFingerprint,
  });
  const normalizedFingerprint = normalizeWalletFingerprint(walletFingerprint);
  if (!storageKey || !normalizedFingerprint) {
    return null;
  }

  try {
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!isCacheRecord(parsed)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    const isCurrentWallet =
      parsed.accountIndex === accountIndex &&
      parsed.derivationMode === derivationMode &&
      parsed.targetAddress === normalizeTargetAddress(targetAddress) &&
      parsed.walletFingerprint === normalizedFingerprint;
    const isFresh = Date.now() - parsed.updatedAt <= QUANTA_DISCOVERY_CACHE_TTL_MS;
    if (!isCurrentWallet || !isFresh) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    return {
      candidates: parsed.candidates,
      hasNoQuantaInWallet: parsed.hasNoQuantaInWallet,
      selectedCandidateKey: parsed.selectedCandidateKey,
    };
  } catch (error: unknown) {
    logger.warn('[QuantaDiscoveryCache] Failed to load discovery cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
