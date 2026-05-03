import { z } from 'zod';
import Schema from '../schema/index.js';
import type { AccountRecord, ExchangeRecord, GuardContract, GuardianRecord, MasterContract, OracleContract, RuneRecord, ValueArray, TermsContract } from '../module/oracle/types/index.js';
export type VaultActionFlag = z.infer<typeof Schema.proto.vault_flag>;
export type VaultActionLabel = z.infer<typeof Schema.proto.vault_action>;
export interface LiquidationTerms {
    liquidation_thold: number;
    reserve_pubkey: string;
    reserve_sats_min: number;
    liquid_tax_rate: number;
    subsidy_inc_rate: number;
    subsidy_inc_thold: number;
}
export interface VaultTerms {
    collateral_min: number;
    internal_key: string;
    sats_balance_min: number;
    unit_balance_min: number;
}
export type GuardianTopic = '/unit/reserve' | '/vault/borrow' | '/vault/deposit' | '/vault/open' | '/vault/repay' | '/vault/repo' | '/vault/withdraw';
export interface PostageTypes {
    10001: MasterContract;
    10002: GuardianRecord;
    10003: GuardContract;
    10004: AccountRecord;
    10005: RuneRecord;
    10006: ValueArray;
    10007: TermsContract;
    10008: ExchangeRecord;
    10009: OracleContract;
}
export interface EntryTypes {
    10101: [number];
    10102: [number];
    10103: [number];
    10104: [number, number];
}
