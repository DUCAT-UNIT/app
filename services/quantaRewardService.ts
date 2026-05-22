/**
 * Quanta Reward Service
 * Links a Ducat mobile install to an existing Quanta wallet address.
 */

import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { APP_NETWORK_CONFIG } from '../utils/networkConfig';
import { fetchWithTimeout } from '../utils/api';
import { postJSON, type PostOptions } from '../utils/apiClient';
import { logger } from '../utils/logger';

const LEGACY_QUANTA_INSTALL_ID_KEYS = ['ducat_quanta_install_id_v1'];
const LEGACY_QUANTA_LINKED_ADDRESS_KEYS = ['ducat_quanta_linked_address_v1'];
const QUANTA_INSTALL_ID_KEY = 'ducat_quanta_install_id_v2';
const QUANTA_LINKED_ADDRESS_KEY = 'ducat_quanta_linked_address_v2';
const QUANTA_UNIFIED_ADDRESSES_KEY = 'ducat_quanta_unified_addresses_v1';
const QUANTA_LOCAL_STATE_RESET_KEY = 'ducat_quanta_local_state_reset_token_v1';
const QUANTA_LOCAL_STATE_RESET_TOKEN = '2026-05-13-mobile-reward-retest';
const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
let legacyStorageCleanupPromise: Promise<void> | null = null;
let installIdCache: string | null = null;
let installIdPromise: Promise<string> | null = null;

export type QuantaRewardStatus = 'awarded' | 'already_claimed' | 'install_already_claimed';
export type QuantaMobileMatchedAddressType = 'legacy' | 'segwit' | 'taproot';

export interface QuantaRewardClaimResult {
  status: QuantaRewardStatus;
  awarded: boolean;
  points: number;
  user: {
    user_id: string;
    test_net_wallet: string;
  };
  task: {
    task_id: number;
    name: string;
    points: number;
  };
  claim: {
    claimed_at: string;
    platform?: string | null;
    app_version?: string | null;
    build_version?: string | null;
    mobile_wallet_address?: string | null;
    addresses_match?: boolean | null;
  } | null;
}

export interface QuantaRewardStatusResult {
  status: 'connected' | 'not_connected';
  connected: boolean;
  points: number;
  user: {
    user_id: string;
    test_net_wallet: string;
  } | null;
  task: {
    task_id: number;
    name: string;
    points: number;
    completed: boolean;
    completed_at?: string | null;
  } | null;
  claim: QuantaRewardClaimResult['claim'];
  stats: {
    total_points: number;
    tasks_completed: number;
    rank?: number | null;
  } | null;
}

export interface QuantaRewardDisconnectResult {
  disconnected: boolean;
  user: {
    user_id: string;
    test_net_wallet: string;
  } | null;
  task: {
    task_id: number;
    name: string;
    points: number;
  };
  removed: {
    claim: boolean;
    task: boolean;
    points: number;
  };
}

export interface UnifyQuantaAccountsInput {
  quantaAddress: string;
  mobileWalletAddress?: string | null;
  mobileLegacyAddress?: string | null;
  mobileTaprootAddress?: string | null;
  mobileSegwitAddress?: string | null;
  matchedAddressType?: QuantaMobileMatchedAddressType | null;
  accountIndex: number;
  derivationMode: string;
}

export interface UnifyQuantaAccountsResult {
  unified: boolean;
  status: 'unified' | 'already_unified' | 'no_changes';
  canonical_wallet_address?: string | null;
  merged_users?: number;
  moved_task_rows?: number;
  dropped_duplicate_task_rows?: number;
  moved_points?: number;
}

export interface ClaimQuantaMobileRewardInput {
  quantaAddress: string;
  mobileWalletAddress?: string | null;
  mobileLegacyAddress?: string | null;
  mobileTaprootAddress?: string | null;
  mobileSegwitAddress?: string | null;
  matchedAddressType?: QuantaMobileMatchedAddressType | null;
  addressesMatch: boolean;
}

export interface GetQuantaMobileRewardStatusInput {
  quantaAddress?: string | null;
  mobileWalletAddress?: string | null;
  mobileLegacyAddress?: string | null;
  mobileTaprootAddress?: string | null;
  mobileSegwitAddress?: string | null;
  matchedAddressType?: QuantaMobileMatchedAddressType | null;
}

export type DisconnectQuantaMobileRewardInput = GetQuantaMobileRewardStatusInput;

export interface GetQuantaMobileRewardStatusBatchItemInput
  extends Omit<GetQuantaMobileRewardStatusInput, 'quantaAddress'> {
  requestId: string;
  quantaAddress: string;
}

export interface QuantaRewardStatusBatchItemResult {
  requestId: string;
  quantaAddress: string;
  status: QuantaRewardStatusResult;
}

export interface QuantaRewardStatusBatchResult {
  results: QuantaRewardStatusBatchItemResult[];
}

export interface GetQuantaMobileRewardStatusOptions {
  storeConnectedAddress?: boolean;
  cacheKey?: PostOptions['cacheKey'];
  cacheTtlMs?: PostOptions['cacheTtlMs'];
  circuitKey?: PostOptions['circuitKey'];
  dedupeKey?: PostOptions['dedupeKey'];
  retryOptions?: PostOptions['retryOptions'];
  signal?: PostOptions['signal'];
  staleOnError?: PostOptions['staleOnError'];
  timeout?: PostOptions['timeout'];
}

export interface PreviewQuantaMobileRewardStatusOptions {
  timeout?: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function createInstallId(): string {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function clearLegacyQuantaStorage(): Promise<void> {
  legacyStorageCleanupPromise ??= (async () => {
    const resetToken = await SecureStore.getItemAsync(QUANTA_LOCAL_STATE_RESET_KEY, DEVICE_ONLY);
    const keysToDelete = [...LEGACY_QUANTA_INSTALL_ID_KEYS, ...LEGACY_QUANTA_LINKED_ADDRESS_KEYS];

    if (resetToken !== QUANTA_LOCAL_STATE_RESET_TOKEN) {
      keysToDelete.push(QUANTA_INSTALL_ID_KEY, QUANTA_LINKED_ADDRESS_KEY);
    }

    await Promise.all(keysToDelete.map((key) => SecureStore.deleteItemAsync(key, DEVICE_ONLY)));

    if (resetToken !== QUANTA_LOCAL_STATE_RESET_TOKEN) {
      await SecureStore.setItemAsync(
        QUANTA_LOCAL_STATE_RESET_KEY,
        QUANTA_LOCAL_STATE_RESET_TOKEN,
        DEVICE_ONLY
      );
    }
  })();

  await legacyStorageCleanupPromise;
}

async function getOrCreateInstallId(): Promise<string> {
  if (installIdCache) {
    return installIdCache;
  }

  installIdPromise ??= (async () => {
    await clearLegacyQuantaStorage();

    const existing = await SecureStore.getItemAsync(QUANTA_INSTALL_ID_KEY, DEVICE_ONLY);
    if (existing) {
      installIdCache = existing;
      return existing;
    }

    const installId = createInstallId();
    await SecureStore.setItemAsync(QUANTA_INSTALL_ID_KEY, installId, DEVICE_ONLY);
    installIdCache = installId;
    return installId;
  })().finally(() => {
    installIdPromise = null;
  });

  return installIdPromise;
}

export function isLikelyQuantaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 8 || trimmed.length > 128 || /\s/.test(trimmed)) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  return APP_NETWORK_CONFIG.addressPrefixes.all.some((prefix) => normalized.startsWith(prefix));
}

function getQuantaAddressStorageKey(address: string | null | undefined): string | null {
  const normalized = address?.trim().toLowerCase();
  if (!normalized || !isLikelyQuantaAddress(normalized)) {
    return null;
  }

  return normalized;
}

async function readUnifiedQuantaAddressKeys(): Promise<Set<string>> {
  const stored = await SecureStore.getItemAsync(QUANTA_UNIFIED_ADDRESSES_KEY, DEVICE_ONLY);
  if (!stored) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      await SecureStore.deleteItemAsync(QUANTA_UNIFIED_ADDRESSES_KEY, DEVICE_ONLY);
      return new Set();
    }

    return new Set(
      parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => getQuantaAddressStorageKey(value))
        .filter((value): value is string => value !== null)
    );
  } catch (error: unknown) {
    logger.warn('[QuantaReward] Failed to read unified Quanta address cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    await SecureStore.deleteItemAsync(QUANTA_UNIFIED_ADDRESSES_KEY, DEVICE_ONLY);
    return new Set();
  }
}

export async function isQuantaAddressMarkedUnified(
  address: string | null | undefined
): Promise<boolean> {
  const key = getQuantaAddressStorageKey(address);
  if (!key) {
    return false;
  }

  const addresses = await readUnifiedQuantaAddressKeys();
  return addresses.has(key);
}

export async function markQuantaAddressesUnified(
  addresses: Array<string | null | undefined>
): Promise<void> {
  const keys = addresses
    .map((address) => getQuantaAddressStorageKey(address))
    .filter((address): address is string => address !== null);
  if (keys.length === 0) {
    return;
  }

  const storedKeys = await readUnifiedQuantaAddressKeys();
  keys.forEach((key) => storedKeys.add(key));
  await SecureStore.setItemAsync(
    QUANTA_UNIFIED_ADDRESSES_KEY,
    JSON.stringify([...storedKeys]),
    DEVICE_ONLY
  );
}

export async function getStoredQuantaAddress(): Promise<string | null> {
  await clearLegacyQuantaStorage();
  return SecureStore.getItemAsync(QUANTA_LINKED_ADDRESS_KEY, DEVICE_ONLY);
}

export async function clearStoredQuantaAddress(): Promise<void> {
  await clearLegacyQuantaStorage();
  await SecureStore.deleteItemAsync(QUANTA_LINKED_ADDRESS_KEY, DEVICE_ONLY);
}

export async function clearQuantaRewardLocalState(): Promise<void> {
  await clearLegacyQuantaStorage();
  installIdCache = null;
  installIdPromise = null;
  await Promise.all([
    SecureStore.deleteItemAsync(QUANTA_INSTALL_ID_KEY, DEVICE_ONLY),
    SecureStore.deleteItemAsync(QUANTA_LINKED_ADDRESS_KEY, DEVICE_ONLY),
  ]);
}

export async function preloadQuantaRewardInstallId(): Promise<void> {
  await getOrCreateInstallId();
}

export async function previewQuantaMobileRewardStatus(
  {
    quantaAddress,
    mobileWalletAddress,
    mobileLegacyAddress,
    mobileTaprootAddress,
    mobileSegwitAddress,
    matchedAddressType,
  }: GetQuantaMobileRewardStatusInput,
  options: PreviewQuantaMobileRewardStatusOptions = {}
): Promise<QuantaRewardStatusResult> {
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/quanta-reward-status');
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installId: installIdCache ?? createInstallId(),
        quantaAddress: quantaAddress?.trim() || undefined,
        mobileWalletAddress: mobileWalletAddress?.trim() || undefined,
        mobileLegacyAddress: mobileLegacyAddress?.trim() || undefined,
        mobileTaprootAddress: mobileTaprootAddress?.trim() || undefined,
        mobileSegwitAddress: mobileSegwitAddress?.trim() || undefined,
        matchedAddressType: matchedAddressType ?? undefined,
      }),
    },
    options.timeout ?? 1500
  );

  if (!response.ok) {
    throw new Error(`Quanta preview failed with HTTP ${response.status}`);
  }

  const envelope = (await response.json()) as ApiEnvelope<QuantaRewardStatusResult>;
  if (envelope.success === false || !envelope.data) {
    throw new Error('Quanta preview status check failed');
  }

  return envelope.data;
}

export async function getQuantaMobileRewardStatus(
  {
    quantaAddress,
    mobileWalletAddress,
    mobileLegacyAddress,
    mobileTaprootAddress,
    mobileSegwitAddress,
    matchedAddressType,
  }: GetQuantaMobileRewardStatusInput = {},
  options: GetQuantaMobileRewardStatusOptions = {}
): Promise<QuantaRewardStatusResult> {
  const installId = await getOrCreateInstallId();
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/quanta-reward-status');

  const response = await postJSON<ApiEnvelope<QuantaRewardStatusResult>>(
    url,
    {
      installId,
      quantaAddress: quantaAddress?.trim() || undefined,
      mobileWalletAddress: mobileWalletAddress?.trim() || undefined,
      mobileLegacyAddress: mobileLegacyAddress?.trim() || undefined,
      mobileTaprootAddress: mobileTaprootAddress?.trim() || undefined,
      mobileSegwitAddress: mobileSegwitAddress?.trim() || undefined,
      matchedAddressType: matchedAddressType ?? undefined,
    },
    {
      timeout: options.timeout ?? 10000,
      description: 'Check Quanta mobile app reward status',
      dedupeKey: options.dedupeKey,
      cacheKey: options.cacheKey,
      cacheTtlMs: options.cacheTtlMs,
      retryOptions: options.retryOptions,
      signal: options.signal,
      staleOnError: options.staleOnError,
      circuitKey: options.circuitKey,
    }
  );

  if (response.success === false || !response.data) {
    throw new Error('Quanta reward status check failed');
  }

  const connectedAddress = quantaAddress?.trim() || response.data.user?.test_net_wallet;
  if (options.storeConnectedAddress !== false && response.data.connected && connectedAddress) {
    await SecureStore.setItemAsync(QUANTA_LINKED_ADDRESS_KEY, connectedAddress, DEVICE_ONLY);
  } else if (options.storeConnectedAddress !== false && !response.data.connected) {
    await SecureStore.deleteItemAsync(QUANTA_LINKED_ADDRESS_KEY, DEVICE_ONLY);
  }

  return response.data;
}

export async function getQuantaMobileRewardStatuses(
  candidates: GetQuantaMobileRewardStatusBatchItemInput[],
  options: GetQuantaMobileRewardStatusOptions = {}
): Promise<QuantaRewardStatusBatchResult> {
  if (candidates.length === 0) {
    return { results: [] };
  }

  const installId = await getOrCreateInstallId();
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/quanta-reward-status-batch');

  const response = await postJSON<ApiEnvelope<QuantaRewardStatusBatchResult>>(
    url,
    {
      installId,
      candidates: candidates.map((candidate) => ({
        requestId: candidate.requestId,
        quantaAddress: candidate.quantaAddress.trim(),
        mobileWalletAddress: candidate.mobileWalletAddress?.trim() || undefined,
        mobileLegacyAddress: candidate.mobileLegacyAddress?.trim() || undefined,
        mobileTaprootAddress: candidate.mobileTaprootAddress?.trim() || undefined,
        mobileSegwitAddress: candidate.mobileSegwitAddress?.trim() || undefined,
        matchedAddressType: candidate.matchedAddressType ?? undefined,
      })),
    },
    {
      timeout: options.timeout ?? 10000,
      description: 'Check Quanta mobile app reward status batch',
      dedupeKey: options.dedupeKey,
      cacheKey: options.cacheKey,
      cacheTtlMs: options.cacheTtlMs,
      retryOptions: options.retryOptions,
      signal: options.signal,
      staleOnError: options.staleOnError,
      circuitKey: options.circuitKey,
    }
  );

  if (response.success === false || !response.data) {
    throw new Error('Quanta reward status batch check failed');
  }

  return response.data;
}

export async function disconnectQuantaMobileReward({
  quantaAddress,
  mobileWalletAddress,
  mobileLegacyAddress,
  mobileTaprootAddress,
  mobileSegwitAddress,
  matchedAddressType,
}: DisconnectQuantaMobileRewardInput = {}): Promise<QuantaRewardDisconnectResult> {
  const installId = await getOrCreateInstallId();
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/disconnect-quanta-reward');

  const response = await postJSON<ApiEnvelope<QuantaRewardDisconnectResult>>(
    url,
    {
      installId,
      quantaAddress: quantaAddress?.trim() || undefined,
      mobileWalletAddress: mobileWalletAddress?.trim() || undefined,
      mobileLegacyAddress: mobileLegacyAddress?.trim() || undefined,
      mobileTaprootAddress: mobileTaprootAddress?.trim() || undefined,
      mobileSegwitAddress: mobileSegwitAddress?.trim() || undefined,
      matchedAddressType: matchedAddressType ?? undefined,
    },
    {
      timeout: 10000,
      description: 'Disconnect Quanta mobile app reward',
    }
  );

  if (response.success === false || !response.data) {
    throw new Error('Quanta reward disconnect failed');
  }

  await clearQuantaRewardLocalState();
  logger.info('[QuantaReward] Mobile reward disconnected', {
    disconnected: response.data.disconnected,
    pointsRemoved: response.data.removed.points,
  });

  return response.data;
}

export async function unifyQuantaAccounts({
  quantaAddress,
  mobileWalletAddress,
  mobileLegacyAddress,
  mobileTaprootAddress,
  mobileSegwitAddress,
  matchedAddressType,
  accountIndex,
  derivationMode,
}: UnifyQuantaAccountsInput): Promise<UnifyQuantaAccountsResult> {
  const trimmedAddress = quantaAddress.trim();
  if (!isLikelyQuantaAddress(trimmedAddress)) {
    throw new Error('Connected Quanta address is invalid');
  }

  const trimmedMobileLegacyAddress = mobileLegacyAddress?.trim() || undefined;
  const trimmedMobileTaprootAddress = mobileTaprootAddress?.trim() || undefined;
  const trimmedMobileSegwitAddress = mobileSegwitAddress?.trim() || undefined;
  const trimmedMobileAddress =
    mobileWalletAddress?.trim() ||
    trimmedMobileLegacyAddress ||
    trimmedMobileTaprootAddress ||
    trimmedMobileSegwitAddress;

  if (!trimmedMobileAddress || !isLikelyQuantaAddress(trimmedMobileAddress)) {
    throw new Error('Mobile wallet address is missing or invalid');
  }

  const installId = await getOrCreateInstallId();
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/unify-quanta-accounts');

  const response = await postJSON<ApiEnvelope<UnifyQuantaAccountsResult>>(
    url,
    {
      installId,
      quantaAddress: trimmedAddress,
      mobileWalletAddress: trimmedMobileAddress,
      mobileLegacyAddress: trimmedMobileLegacyAddress,
      mobileTaprootAddress: trimmedMobileTaprootAddress,
      mobileSegwitAddress: trimmedMobileSegwitAddress,
      matchedAddressType: matchedAddressType ?? undefined,
      accountIndex,
      derivationMode,
      platform: Platform.OS,
      appVersion: Application.nativeApplicationVersion ?? undefined,
      buildVersion: Application.nativeBuildVersion ?? undefined,
    },
    {
      timeout: 20000,
      description: 'Unify Quanta accounts',
    }
  );

  if (response.success === false || !response.data?.unified) {
    throw new Error('Quanta account unification failed');
  }

  logger.info('[QuantaReward] Quanta account unification checked', {
    status: response.data.status,
    mergedUsers: response.data.merged_users,
  });

  return response.data;
}

export async function claimQuantaMobileReward({
  quantaAddress,
  mobileWalletAddress,
  mobileLegacyAddress,
  mobileTaprootAddress,
  mobileSegwitAddress,
  matchedAddressType,
  addressesMatch,
}: ClaimQuantaMobileRewardInput): Promise<QuantaRewardClaimResult> {
  const trimmedAddress = quantaAddress.trim();
  if (!isLikelyQuantaAddress(trimmedAddress)) {
    throw new Error('Enter a valid Mutinynet wallet address');
  }

  const trimmedMobileLegacyAddress = mobileLegacyAddress?.trim() || undefined;
  const trimmedMobileTaprootAddress = mobileTaprootAddress?.trim() || undefined;
  const trimmedMobileSegwitAddress = mobileSegwitAddress?.trim() || undefined;
  const trimmedMobileAddress =
    mobileWalletAddress?.trim() ||
    trimmedMobileLegacyAddress ||
    trimmedMobileTaprootAddress ||
    trimmedMobileSegwitAddress;

  if (!trimmedMobileAddress || !isLikelyQuantaAddress(trimmedMobileAddress)) {
    throw new Error('Mobile wallet address is missing or invalid');
  }
  if (
    trimmedMobileLegacyAddress !== undefined &&
    !isLikelyQuantaAddress(trimmedMobileLegacyAddress)
  ) {
    throw new Error('Mobile legacy address is invalid');
  }
  if (
    trimmedMobileTaprootAddress !== undefined &&
    !isLikelyQuantaAddress(trimmedMobileTaprootAddress)
  ) {
    throw new Error('Mobile Taproot address is invalid');
  }
  if (
    trimmedMobileSegwitAddress !== undefined &&
    !isLikelyQuantaAddress(trimmedMobileSegwitAddress)
  ) {
    throw new Error('Mobile SegWit address is invalid');
  }

  const installId = await getOrCreateInstallId();
  const url = joinUrl(APP_NETWORK_CONFIG.api.quantaUrl, '/mobile/link-quanta-reward');

  const response = await postJSON<ApiEnvelope<QuantaRewardClaimResult>>(
    url,
    {
      quantaAddress: trimmedAddress,
      mobileWalletAddress: trimmedMobileAddress,
      mobileLegacyAddress: trimmedMobileLegacyAddress,
      mobileTaprootAddress: trimmedMobileTaprootAddress,
      mobileSegwitAddress: trimmedMobileSegwitAddress,
      matchedAddressType: matchedAddressType ?? undefined,
      addressesMatch,
      installId,
      platform: Platform.OS,
      appVersion: Application.nativeApplicationVersion ?? undefined,
      buildVersion: Application.nativeBuildVersion ?? undefined,
    },
    {
      timeout: 10000,
      description: 'Claim Quanta mobile app reward',
    }
  );

  if (response.success === false || !response.data) {
    throw new Error('Quanta reward claim failed');
  }

  await SecureStore.setItemAsync(QUANTA_LINKED_ADDRESS_KEY, trimmedAddress, DEVICE_ONLY);
  logger.info('[QuantaReward] Mobile reward claim checked', {
    status: response.data.status,
    awarded: response.data.awarded,
  });

  return response.data;
}
