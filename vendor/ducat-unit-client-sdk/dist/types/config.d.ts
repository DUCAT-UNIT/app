import type { CoreConfig } from '@cmdcode/core-cmd';
import type { ChainNetwork } from '@ducat-unit/core';
export interface ConfigProto {
    ANCHOR_ID: string;
    ANCHOR_INDEX: number;
    ANCHOR_TXID: string;
    ANCHOR_HEIGHT: number;
    BOOT_HEIGHT: number;
    CHAIN_HEIGHT: number;
    CHAIN_NETWORK: ChainNetwork;
    DOMAIN_HASH: string;
}
export interface ConfigHosts {
    EXPLORER: string;
    GUARDIAN: string;
    ORACLE: string;
    VALIDATOR: string;
}
export interface ConfigKeyPair {
    PUBKEY: string;
    SECKEY: string;
}
export interface ConfigSigners {
    GUARDIAN: ConfigKeyPair;
    MASTER: ConfigKeyPair;
    ORACLE: ConfigKeyPair;
}
export interface ConfigSettings {
    FUNDING_TYPE: string;
    MAX_VAULTS: number;
    POSTAGE_AMOUNT: number;
    TX_FEERATE: number;
    UNIT_PRICE: number;
    VAULT_LABEL: string;
    WALLET_LABEL: string;
}
export interface ConfigTerms {
    LIQUID_RESERVE_MIN: number;
    LIQUID_RESERVE_PUBKEY: string;
    LIQUID_SUBSIDY_STEP: number;
    LIQUID_SUBSIDY_THOLD: number;
    LIQUID_TAX_RATE: number;
    LIQUID_THOLD_RATE: number;
    UNIT_ASSET_ID: string;
    UNIT_BALANCE_MIN: number;
    VAULT_RATIO_MIN: number;
    VAULT_VALUE_MIN: number;
}
export interface MasterConfig {
    CORE: Partial<CoreConfig>;
    HOSTS: ConfigHosts;
    PROTO: ConfigProto;
    SETTINGS: ConfigSettings;
    SIGNERS: ConfigSigners;
    TERMS: ConfigTerms;
}
