import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { DEVICE_ONLY } from '../storagePolicy';
import { addProofs, getCurrentCashuAccount } from './cashuProofManager';
import type { CashuProof } from './crypto';

const FAILED_PROOF_RECOVERY_KEYS = 'cashu_failed_proof_recovery_keys_v1';
const FAILED_PROOF_RECOVERY_FALLBACK_KEY = 'cashu_failed_proofs_latest_v1';

interface ProofRecoveryRecord {
  proofs: CashuProof[];
  amount: number;
  timestamp: string;
  error?: string;
  source: string;
  taprootAddress?: string | null;
}

export interface FailedProofRecoveryResult {
  checked: number;
  recovered: number;
  totalAmountRecovered: number;
  errors: string[];
}

const quarantineCorruptProofRecoveryRegistry = async (
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${FAILED_PROOF_RECOVERY_KEYS}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('Quarantined corrupt proof recovery registry', {
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('Failed to quarantine corrupt proof recovery registry', {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const loadProofRecoveryRegistry = async (): Promise<string[]> => {
  const existingRegistryRaw = await SecureStore.getItemAsync(FAILED_PROOF_RECOVERY_KEYS);
  if (!existingRegistryRaw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existingRegistryRaw) as unknown;
  } catch (error) {
    await quarantineCorruptProofRecoveryRegistry(existingRegistryRaw, 'invalid JSON');
    logger.error('Failed to parse proof recovery registry', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Proof recovery registry corrupted: invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptProofRecoveryRegistry(existingRegistryRaw, 'invalid registry');
    throw new Error('Proof recovery registry corrupted: invalid registry');
  }

  return parsed.filter((key): key is string => typeof key === 'string');
};

const buildProofRecoveryRecord = (
  proofs: ProofRecoveryRecord['proofs'],
  amount: number,
  source: string,
  error?: string
): ProofRecoveryRecord => ({
  proofs,
  amount,
  timestamp: new Date().toISOString(),
  error,
  source,
  taprootAddress: getCurrentCashuAccount(),
});

const isSameProofRecoveryRecord = (
  a: ProofRecoveryRecord,
  b: ProofRecoveryRecord
): boolean =>
  a.amount === b.amount &&
  a.timestamp === b.timestamp &&
  a.source === b.source &&
  a.taprootAddress === b.taprootAddress &&
  JSON.stringify(a.proofs) === JSON.stringify(b.proofs);

const parseProofRecoveryRecord = (stored: string): ProofRecoveryRecord => {
  const record = JSON.parse(stored) as ProofRecoveryRecord;
  if (!Array.isArray(record.proofs) || typeof record.amount !== 'number') {
    throw new Error('Invalid proof recovery record');
  }
  return record;
};

const clearMatchingFallbackRecord = async (record: ProofRecoveryRecord): Promise<void> => {
  try {
    const fallbackStored = await SecureStore.getItemAsync(FAILED_PROOF_RECOVERY_FALLBACK_KEY);
    if (!fallbackStored) {
      return;
    }
    const fallback = parseProofRecoveryRecord(fallbackStored);
    if (isSameProofRecoveryRecord(fallback, record)) {
      await SecureStore.deleteItemAsync(FAILED_PROOF_RECOVERY_FALLBACK_KEY);
    }
  } catch (error) {
    logger.warn('Failed to clear matching proof recovery fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const persistProofRecoveryRecord = async (
  proofs: ProofRecoveryRecord['proofs'],
  amount: number,
  source: string,
  error?: string
): Promise<string> => {
  const recoveryKey = `cashu_failed_proofs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = buildProofRecoveryRecord(proofs, amount, source, error);
  await SecureStore.setItemAsync(
    FAILED_PROOF_RECOVERY_FALLBACK_KEY,
    JSON.stringify(record),
    DEVICE_ONLY
  );
  const existingRegistry = await loadProofRecoveryRegistry();
  const updatedRegistry = Array.from(new Set([...existingRegistry, recoveryKey]));

  await SecureStore.setItemAsync(
    recoveryKey,
    JSON.stringify(record),
    DEVICE_ONLY
  );
  await SecureStore.setItemAsync(
    FAILED_PROOF_RECOVERY_KEYS,
    JSON.stringify(updatedRegistry),
    DEVICE_ONLY
  );
  await clearMatchingFallbackRecord(record);
  logger.info('Stored proofs in recovery queue', { recoveryKey, source, amount });
  return recoveryKey;
};

export const clearProofRecoveryRecord = async (recoveryKey: string): Promise<void> => {
  try {
    const stored = await SecureStore.getItemAsync(recoveryKey);
    const record = stored ? parseProofRecoveryRecord(stored) : null;
    await SecureStore.deleteItemAsync(recoveryKey);
    const existingRegistry = await loadProofRecoveryRegistry();
    const updatedRegistry = existingRegistry.filter((key) => key !== recoveryKey);
    await SecureStore.setItemAsync(
      FAILED_PROOF_RECOVERY_KEYS,
      JSON.stringify(updatedRegistry),
      DEVICE_ONLY
    );
    if (record) {
      await clearMatchingFallbackRecord(record);
    }
  } catch (error) {
    logger.warn('Failed to clear proof recovery record', {
      recoveryKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const recoverFailedProofSaves = async (): Promise<FailedProofRecoveryResult> => {
  const result: FailedProofRecoveryResult = {
    checked: 0,
    recovered: 0,
    totalAmountRecovered: 0,
    errors: [],
  };

  let registry: string[];
  try {
    registry = await loadProofRecoveryRegistry();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    logger.error('Failed to load proof recovery registry', { error: errorMessage });
    registry = [];
  }
  const currentAccount = getCurrentCashuAccount();
  const records: Array<{ key: string; record: ProofRecoveryRecord; fallback: boolean }> = [];

  for (const recoveryKey of registry) {
    try {
      const stored = await SecureStore.getItemAsync(recoveryKey);
      if (!stored) {
        await clearProofRecoveryRecord(recoveryKey);
        continue;
      }

      records.push({ key: recoveryKey, record: parseProofRecoveryRecord(stored), fallback: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load proof recovery record', {
        recoveryKey,
        error: errorMessage,
      });
      result.errors.push(`${recoveryKey}: ${errorMessage}`);
    }
  }

  try {
    const fallbackStored = await SecureStore.getItemAsync(FAILED_PROOF_RECOVERY_FALLBACK_KEY);
    if (fallbackStored) {
      const fallbackRecord = parseProofRecoveryRecord(fallbackStored);
      if (!records.some(({ record }) => isSameProofRecoveryRecord(record, fallbackRecord))) {
        records.push({
          key: FAILED_PROOF_RECOVERY_FALLBACK_KEY,
          record: fallbackRecord,
          fallback: true,
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load proof recovery fallback', { error: errorMessage });
    result.errors.push(`${FAILED_PROOF_RECOVERY_FALLBACK_KEY}: ${errorMessage}`);
  }

  for (const { key: recoveryKey, record, fallback } of records) {
    result.checked++;

    try {
      if (record.taprootAddress && currentAccount && record.taprootAddress !== currentAccount) {
        logger.info('Skipping proof recovery record for different Cashu account', {
          recoveryKey,
          recordAccount: record.taprootAddress,
          currentAccount,
        });
        continue;
      }

      await addProofs(record.proofs);
      if (fallback) {
        await SecureStore.deleteItemAsync(FAILED_PROOF_RECOVERY_FALLBACK_KEY);
      } else {
        await clearProofRecoveryRecord(recoveryKey);
      }
      result.recovered++;
      result.totalAmountRecovered += record.amount;

      logger.info('Recovered proofs from recovery queue', {
        recoveryKey,
        source: record.source,
        amount: record.amount,
        proofCount: record.proofs.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to recover proofs from recovery queue', {
        recoveryKey,
        error: errorMessage,
      });
      result.errors.push(`${recoveryKey}: ${errorMessage}`);
    }
  }

  return result;
};
