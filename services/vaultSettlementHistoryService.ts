import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VaultHistoryTransaction } from './vaultService';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@ducat/vault_settlement_history_v1';

export type VaultSettlementHistoryAction =
  | 'open_settled_to_usdc'
  | 'borrow_settled_to_usdc'
  | 'repay_from_usdc';

interface VaultSettlementHistoryRecord {
  id: string;
  vaultPubkey: string;
  action: VaultSettlementHistoryAction;
  amountUsd: number;
  txid: string;
  timestamp: number;
}

async function loadAllRecords(): Promise<VaultSettlementHistoryRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    return JSON.parse(stored) as VaultSettlementHistoryRecord[];
  } catch (error) {
    logger.warn('[VaultSettlementHistory] Failed to load settlement history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function saveAllRecords(records: VaultSettlementHistoryRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    logger.warn('[VaultSettlementHistory] Failed to persist settlement history', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function registerVaultSettlementHistory(input: {
  vaultPubkey: string;
  action: VaultSettlementHistoryAction;
  amountUsd: number;
  txid: string;
  timestamp?: number;
}): Promise<void> {
  const vaultPubkey = input.vaultPubkey?.trim();
  const txid = input.txid?.trim();
  if (!vaultPubkey || !txid || !Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return;
  }

  const records = await loadAllRecords();
  const id = `${vaultPubkey}:${input.action}:${txid}`;
  if (records.some((record) => record.id === id)) {
    return;
  }

  records.unshift({
    id,
    vaultPubkey,
    action: input.action,
    amountUsd: input.amountUsd,
    txid,
    timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
  });

  await saveAllRecords(records.slice(0, 200));
}

export async function loadVaultSettlementHistory(vaultPubkey: string | null | undefined): Promise<VaultHistoryTransaction[]> {
  if (!vaultPubkey) {
    return [];
  }

  const records = await loadAllRecords();
  return records
    .filter((record) => record.vaultPubkey === vaultPubkey)
    .sort((left, right) => right.timestamp - left.timestamp)
    .map((record) => ({
      amount_borrowed: 0,
      vault_amount: 0,
      btc_amt: 0,
      unit_amt: Math.round(record.amountUsd * 100),
      oracle_price: 0,
      timestamp: record.timestamp,
      action: record.action,
      transaction_id: record.txid,
      compositeSettlement: true,
    }));
}
