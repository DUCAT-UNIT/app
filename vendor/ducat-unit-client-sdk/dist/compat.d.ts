import type {
  AssetAccount,
  ChainNetwork,
  PriceQuote,
  ProtoProfile,
  VaultProfile,
} from '@ducat-unit/core';

export type CompatCoinUtxo = Omit<import('@ducat-unit/core').CoinUtxo, 'script_pk'> & {
  script: string;
  script_pk?: string;
};

export declare const TX: any;
export declare const PSBT: any;
export declare function hash160(pubkey: string): string;
export declare function taptweak_pubkey(pubkey: string): string;
export declare function select_sat_utxos<T extends CompatCoinUtxo>(utxos: T[], amount: number): T[];

export declare class GuardianSocket {
  constructor(host_url: string, network: ChainNetwork, pubkey: string);
  readonly network: ChainNetwork;
  readonly pubkey: string;
  readonly socket: any;
  readonly req: any;
  once(event: string, handler: (...args: any[]) => void): this;
  on(event: string, handler: (...args: any[]) => void): this;
  off(event: string, handler: (...args: any[]) => void): this;
  close(): void;
}

export interface LegacyWalletAccounts {
  sats: { address: string; pubkey: string };
  runes: { address: string; pubkey: string };
  vault: { address: string; pubkey: string };
}

export interface LegacyWalletConfig {
  network: ChainNetwork;
  postage: { unit: number; vault: number };
  txfee_rate?: number;
  txfee_reserve?: number;
}

export declare class VaultWallet {
  constructor(accounts: LegacyWalletAccounts, proto_profile: ProtoProfile, connector: any, config: LegacyWalletConfig);
  readonly acct: LegacyWalletAccounts;
  readonly account: any;
  readonly config: LegacyWalletConfig;
  readonly conn: any;
  readonly ctx: ProtoProfile;
  readonly contract_id: string;
  readonly network: ChainNetwork;
  readonly fetch: {
    balance: () => Promise<unknown>;
    sats_utxos: (amount?: number) => Promise<CompatCoinUtxo[]>;
    rune_utxos: (rune: string, amount?: number) => Promise<any[]>;
    vault_tokens: () => Promise<Map<string, unknown>>;
  };
  readonly sign: {
    psbt: (psbt: string, manifest?: Record<string, number[]>) => Promise<string>;
    utxos: (psbt: string) => Promise<string>;
    coins: (psbt: string) => Promise<string>;
    batch: (items: string[] | [string, Record<string, number[]>][]) => Promise<string[]>;
  };
  readonly vault: any;
}

export declare const VaultAPI: any;
export declare const OracleAPI: {
  proto: {
    fetch_master_ctx: (ordUrl: string, masterId: string) => Promise<{ ok: boolean; data?: ProtoProfile; error?: string }>;
  };
  wallet: {
    fetch_address_bal: (ordUrl: string, address: string) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
    fetch_vault_tokens: (esploraUrl: string, ordUrl: string, address: string, postage: number) => Promise<{ ok: boolean; data?: Map<string, unknown>; error?: string }>;
  };
  vault: {
    fetch_vault_prevout: (ordUrl: string, txid: string) => Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }>;
  };
};

export type LegacyPriceQuote = PriceQuote & {
  contracts?: unknown[];
  latest_price?: number;
  latest_stamp?: number;
};
export type LegacyVaultProfile = VaultProfile | Record<string, any>;
export type LegacyUnitAccountResponse = {
  mint_account: AssetAccount;
  vault_action: string;
  vault_pubkey: string;
};
