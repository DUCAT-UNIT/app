import { address, networks, Transaction } from 'bitcoinjs-lib';
import { hash160 as hash160_bytes } from '@vbyte/crypto/hash';
import { derive_taproot_output_key, select_coins } from '@ducat-unit/core/lib';
import * as CorePSBT from '@ducat-unit/core/psbt';
import { create_vault_action_estimate, create_vault_action_quote, filter_price_contracts, get_price_commit_hashes } from './lib/index.js';
import { GuardianClient } from './module/guard/class/client.js';
import { ProtoWallet } from './module/wallet/class/wallet.js';
import { VaultActionAPI } from './module/vault/index.js';

const DEFAULT_UNIT_ASSET_ID = '3007902:1';

function resolveBitcoinNetwork(value, network) {
  if (network === 'mutiny' || network === 'mutinynet' || network === 'testnet') {
    return networks.testnet;
  }
  if (network === 'regtest') {
    return networks.regtest;
  }
  if (network === 'mainnet' || network === 'main' || network === 'bitcoin') {
    return networks.bitcoin;
  }

  const normalized = String(value).toLowerCase();
  if (
    normalized.startsWith('tb1') ||
    normalized.startsWith('m') ||
    normalized.startsWith('n') ||
    normalized.startsWith('2')
  ) {
    return networks.testnet;
  }
  if (normalized.startsWith('bcrt1')) {
    return networks.regtest;
  }
  return networks.bitcoin;
}

export const TX = {
  parse_address(value, network) {
    const script = address.toOutputScript(value, resolveBitcoinNetwork(value, network));
    const hex = Buffer.from(script).toString('hex');
    const meta = parse_script_hex(hex);
    return { hex, type: meta.type, key: meta.key?.hex };
  },
  parse_script_meta(value) {
    const hex = typeof value === 'string' ? value : Buffer.from(value).toString('hex');
    return parse_script_hex(hex);
  },
  get_txid(txhex) {
    return Transaction.fromHex(txhex).getId();
  },
};

export const PSBT = {
  decode(psbt) {
    return CorePSBT.parse_psbt(psbt);
  },
  parse(psbt) {
    return CorePSBT.parse_psbt(psbt);
  },
  encode(pdata) {
    return CorePSBT.encode_psbt(pdata);
  },
  get: {
    txhex(psbt) {
      return CorePSBT.parse_psbt(psbt).hex;
    },
  },
  extract: {
    utxo(pdata, index) {
      return CorePSBT.extract_utxo(pdata, index);
    },
  },
};

export function hash160(pubkey) {
  return hash160_bytes(pubkey).hex;
}

export function taptweak_pubkey(pubkey) {
  return derive_taproot_output_key(pubkey);
}

export function select_sat_utxos(utxos, amount) {
  return select_legacy_coin_utxos(utxos, amount);
}

export class GuardianSocket {
  constructor(host_url, network, pubkey) {
    this._client = new GuardianClient(host_url, network);
    this._pubkey = pubkey;
    this.network = network;
    this.pubkey = pubkey;
  }

  get socket() {
    return this._client.socket;
  }

  get req() {
    return {
      unit: {
        reserve: (request) => legacy_subscription(
          this._client.request.asset.reserve({
            asset_id: request.asset_id ?? globalThis.process?.env?.EXPO_PUBLIC_UNIT_ASSET_ID ?? DEFAULT_UNIT_ASSET_ID,
            asset_amount: request.unit_amount ?? request.asset_amount,
          }),
          (data) => ({
            mint_account: data,
            vault_action: request.vault_action,
            vault_pubkey: request.vault_pubkey,
          })
        ),
      },
      vault: {
        open: (request) => legacy_subscription(this._client.request.vault.open(request)),
        borrow: (request) => legacy_subscription(this._client.request.vault.borrow(request)),
        repay: (request) => legacy_subscription(this._client.request.vault.repay(request)),
        deposit: (request) => legacy_subscription(this._client.request.vault.deposit(request)),
        withdraw: (request) => legacy_subscription(this._client.request.vault.withdraw(request)),
        repo: (request) => legacy_subscription(this._client.request.vault.repo(request)),
      },
    };
  }

  once(event, handler) {
    this.socket.once(event, handler);
    return this;
  }

  on(event, handler) {
    this.socket.on(event, handler);
    return this;
  }

  off(event, handler) {
    this.socket.off(event, handler);
    return this;
  }

  close() {
    this._client.close();
  }
}

export class VaultWallet {
  constructor(accounts, proto_profile, connector, config) {
    this._acct = accounts;
    this._ctx = proto_profile;
    this._conn = connector;
    this._conf = config;
    this._proto = new ProtoWallet({
      asset: { pubkey: accounts.runes.pubkey },
      funds: { pubkey: accounts.sats.pubkey, version: 0 },
      vault: { pubkey: accounts.vault.pubkey },
    }, {
      fetch: {
        funds: () => async () => to_coin_utxos(await connector.fetch.sats_utxos(this)()),
      },
      sign: {
        psbt: () => async (psbt, manifest) => connector.sign.psbt(this)(psbt, manifest),
        coins: () => async (psbt) => connector.sign.utxos(this)(psbt),
        batch: connector.sign.batch
          ? () => async (entries) => connector.sign.batch(this)(entries)
          : undefined,
      },
    }, {
      asset_postage: config?.postage?.unit ?? 1000,
      chain_network: config?.network ?? proto_profile.chain_network ?? 'mutiny',
      txfee_rate: config?.txfee_rate ?? 1,
      txfee_reserve: config?.txfee_reserve ?? 1000,
    });
    this.acct = {
      sats: this._proto.account.funds,
      runes: this._proto.account.asset,
      vault: this._proto.account.vault,
    };
  }

  get account() {
    return this._proto.account;
  }

  get config() {
    return this._conf;
  }

  get conn() {
    return this._conn;
  }

  get ctx() {
    return this._ctx;
  }

  get contract_id() {
    return this._ctx.contract_id;
  }

  get network() {
    return this._ctx.chain_network ?? this._conf?.network ?? 'mutiny';
  }

  get fetch() {
    return {
      balance: async () => this._conn.fetch.balance?.(this)?.() ?? null,
      sats_utxos: async (amount) => {
        const utxos = await this._conn.fetch.sats_utxos(this)();
        return typeof amount === 'number' ? select_legacy_coin_utxos(utxos, amount) : utxos;
      },
      rune_utxos: async (rune, amount) => {
        const fetcher = this._conn.fetch.rune_utxos(this);
        const result = await fetcher();
        const values = result instanceof Map ? [...result.values()] : result;
        const selected = typeof amount === 'number'
          ? select_rune_utxos(values, rune, amount)
          : values;
        return selected;
      },
      vault_tokens: async () => this._conn.fetch.vault_tokens?.(this)?.() ?? new Map(),
    };
  }

  get sign() {
    return {
      psbt: async (psbt, manifest) => {
        const resolved = manifest ?? await this._proto.fetch.manifest(psbt);
        return this._conn.sign.psbt(this)(psbt, resolved);
      },
      utxos: async (psbt) => this._conn.sign.utxos(this)(psbt),
      coins: async (psbt) => this._conn.sign.utxos(this)(psbt),
      batch: async (items) => {
        const entries = typeof items[0] === 'string'
          ? await Promise.all(items.map(async (psbt) => [psbt, await this._proto.fetch.manifest(psbt)]))
          : items;
        return this._conn.sign.batch(this)(entries);
      },
    };
  }

  get vault() {
    return {
      open: create_action_api(this, 'open'),
      borrow: create_action_api(this, 'borrow'),
      repay: create_action_api(this, 'repay'),
      repo: create_action_api(this, 'repo'),
      deposit: create_action_api(this, 'deposit'),
      withdraw: create_action_api(this, 'withdraw'),
    };
  }
}

export const VaultAPI = {
  ...VaultActionAPI,
  open: with_legacy_action('open', VaultActionAPI.open),
  borrow: with_legacy_action('borrow', VaultActionAPI.borrow),
  repay: with_legacy_action('repay', VaultActionAPI.repay),
  deposit: with_legacy_action('deposit', VaultActionAPI.deposit),
  withdraw: with_legacy_action('withdraw', VaultActionAPI.withdraw),
  repo: with_legacy_action('repo', VaultActionAPI.repo),
};

export const OracleAPI = {
  proto: {
    fetch_master_ctx: async () => ({ ok: false, error: 'legacy proto fetch is not supported; use /api/proto/latest' }),
  },
  wallet: {
    fetch_address_bal: async () => ({ ok: true, data: null }),
    fetch_vault_tokens: async () => ({ ok: true, data: new Map() }),
  },
  vault: {
    fetch_vault_prevout: async () => ({ ok: false, error: 'legacy vault prevout fetch is not supported' }),
  },
};

function create_action_api(wallet, action) {
  return {
    ctx: (...args) => create_legacy_ctx(wallet, action, args),
    quote: (ctx, liquid_count) => ctx.__quote(liquid_count),
    req: async (ctx, ...args) => ctx.__request(...args),
    liquidation: VaultAPI.repo.liquidation,
  };
}

function create_legacy_ctx(wallet, action, args) {
  const [first, second, third, fourth] = args;
  const data = { wallet, action };
  if (action === 'open') {
    Object.assign(data, { issue_account: first, price_quote: second, config: third });
  } else if (action === 'borrow') {
    Object.assign(data, { issue_account: first, price_quote: second, vault_profile: third, config: fourth });
  } else if (action === 'repay') {
    Object.assign(data, { issue_account: first, price_quote: second, vault_profile: third, config: fourth });
  } else if (action === 'repo' || action === 'deposit' || action === 'withdraw') {
    Object.assign(data, { price_quote: first, vault_profile: second, config: third });
  }
  const ctx = {
    ...data.config,
    vault_action: action,
    vault_quote: data.price_quote,
    vault_profile: data.vault_profile,
    __legacy: data,
  };
  ctx.__base_config = (overrides = {}) => build_action_config(ctx, overrides);
  ctx.__quote = () => {
    try {
      const estimate = create_vault_action_estimate(ctx.__base_config());
      return {
        ...estimate,
        total_cost: estimate.action_value,
        tx_cost: estimate.action_fees,
        tx_vsize: estimate.action_vsize,
      };
    } catch {
      return { total_cost: 0, tx_cost: 0, tx_vsize: 0 };
    }
  };
  ctx.__create_psbts = (fund_inputs = [], extra = {}) => create_unsigned_psbts(ctx, fund_inputs, extra);
  ctx.__request = (...request_args) => create_signed_request(ctx, request_args);
  return ctx;
}

async function create_signed_request(ctx, request_args) {
  const { action, wallet } = ctx.__legacy;
  if (action === 'open' || action === 'borrow') {
    const [fund_inputs] = request_args;
    const unsigned = create_unsigned_psbts(ctx, fund_inputs);
    const signed = await wallet.sign.batch(unsigned);
    return latest_api(action).create_request(ctx.__latest_ctx, signed);
  }
  if (action === 'repay') {
    const [fund_inputs, unit_utxos] = request_args;
    const asset_inputs = rune_utxos_to_asset_accounts(unit_utxos, get_unit_asset_id(ctx.__legacy.wallet.ctx));
    const unsigned = create_unsigned_psbts(ctx, fund_inputs, { asset_inputs });
    const signed = await wallet.sign.batch(unsigned);
    return latest_api(action).create_request(ctx.__latest_ctx, signed);
  }
  if (action === 'deposit') {
    const [fund_inputs] = request_args;
    let [psbt] = create_unsigned_psbts(ctx, fund_inputs);
    psbt = await wallet.sign.utxos(psbt);
    psbt = await wallet.sign.psbt(psbt);
    return latest_api(action).create_request(ctx.__latest_ctx, psbt);
  }
  if (action === 'withdraw') {
    let [psbt] = create_unsigned_psbts(ctx, []);
    psbt = await wallet.sign.coins(psbt);
    psbt = await wallet.sign.psbt(psbt);
    return latest_api(action).create_request(ctx.__latest_ctx, psbt);
  }
  if (action === 'repo') {
    const [liquid_ctx, _vault_ctx, fund_inputs] = request_args.length >= 3 ? request_args : [null, null, []];
    const liquid_profiles = liquid_ctx?.liquid_vaults ?? ctx.__legacy.config?.liquid_profiles ?? [];
    let [psbt] = create_unsigned_psbts(ctx, fund_inputs, { liquid_profiles });
    psbt = await wallet.sign.psbt(psbt);
    return latest_api(action).create_request(ctx.__latest_ctx, psbt);
  }
  throw new Error(`unsupported vault action: ${action}`);
}

function create_unsigned_psbts(ctx, fund_inputs = [], extra = {}) {
  const api = latest_api(ctx.__legacy.action);
  const config = ctx.__base_config({ fund_inputs: to_coin_utxos(fund_inputs), ...extra });
  const quote = create_vault_action_quote(config);
  config.price_contracts = select_price_contracts(ctx.__legacy.wallet.ctx, quote, ctx.__legacy.price_quote);
  ctx.__latest_ctx = api.create_ctx(config);
  if (ctx.__legacy.action === 'deposit' || ctx.__legacy.action === 'withdraw' || ctx.__legacy.action === 'repo') {
    return [api.create_psbt(ctx.__latest_ctx)];
  }
  return api.create_psbts(ctx.__latest_ctx);
}

function build_action_config(ctx, overrides = {}) {
  const { action, wallet, config, issue_account, price_quote, vault_profile } = ctx.__legacy;
  const proto_profile = wallet.ctx;
  const base = {
    proto_profile,
    price_quotes: [core_price_quote(price_quote)],
    txfee_rate: config?.tx_feerate ?? wallet._proto.config.txfee_rate,
    txfee_reserve: wallet._proto.config.txfee_reserve,
    unit_postage: wallet._proto.config.asset_postage,
    vault_action: action,
    change_address: wallet.acct.sats.address,
    guard_pubkey: vault_profile?.guard_pubkey ?? vault_profile?.guard_pk ?? issue_account?.guard_pubkey ?? first_guard_pubkey(proto_profile),
    ...overrides,
  };
  if (action === 'open') {
    Object.assign(base, {
      borrow_amount: config.borrow_amount,
      deposit_amount: config.deposit_amount,
      client_pubkey: wallet.acct.vault.pubkey,
      guard_members: [base.guard_pubkey].filter(Boolean),
      issue_account,
      unit_address: wallet.acct.runes.address,
      unit_postage: wallet._proto.config.asset_postage,
      vault_config: { label: config.vault_label },
    });
  } else {
    Object.assign(base, {
      vault_profile: to_latest_vault_profile(vault_profile, proto_profile),
    });
  }
  if (action === 'borrow') {
    Object.assign(base, {
      borrow_amount: config.borrow_amount,
      deposit_amount: config.deposit_amount ?? 0,
      issue_account,
      unit_address: wallet.acct.runes.address,
      unit_postage: wallet._proto.config.asset_postage,
    });
  }
  if (action === 'repay') {
    Object.assign(base, {
      deposit_amount: config.deposit_amount ?? 0,
      repay_amount: config.repay_amount,
      unit_address: wallet.acct.runes.address,
      unit_postage: wallet._proto.config.asset_postage,
    });
  }
  if (action === 'deposit') {
    base.deposit_amount = config.deposit_amount;
  }
  if (action === 'withdraw') {
    base.withdraw_amount = config.withdraw_amount ?? config.change_amount;
  }
  if (action === 'repo') {
    base.deposit_amount = config.deposit_amount ?? 0;
    base.liquid_profiles = overrides.liquid_profiles ?? config.liquid_profiles ?? [];
  }
  return base;
}

function with_legacy_action(action, api) {
  const wrapped = { ...api };
  wrapped.get_quote = (ctx) => ctx?.__quote ? ctx.__quote() : { total_cost: 0, tx_cost: 0, tx_vsize: 0 };
  wrapped.get_change = (ctx, utxos) => {
    if (!ctx?.__base_config) return 0;
    const quote = create_vault_action_quote(ctx.__base_config({ fund_inputs: to_coin_utxos(utxos) }));
    return quote.change_value;
  };
  wrapped.create_psbt1 = (ctx, fund_inputs, unit_inputs) => ctx.__create_psbts(fund_inputs, unit_inputs ? { asset_inputs: rune_utxos_to_asset_accounts(unit_inputs, get_unit_asset_id(ctx.__legacy.wallet.ctx)) } : {})[0];
  wrapped.create_psbt2 = (ctx, first_psbt) => ctx.__latest_ctx ? (api.create_psbts ? api.create_psbts(ctx.__latest_ctx)[1] : api.create_psbt(ctx.__latest_ctx)) : first_psbt;
  wrapped.create_req = (...args) => api.create_request(...args);
  if (action === 'repo') {
    wrapped.liquidation = {
      get_ctx: (liquid_vaults) => ({
        liquid_vaults,
        vault_count: liquid_vaults.length,
        claimed_sats: liquid_vaults.reduce((sum, item) => sum + (item.claimed_sats ?? item.deficit_sats ?? 0), 0),
        claimed_unit: liquid_vaults.reduce((sum, item) => sum + (item.claimed_unit ?? item.unit_balance ?? 0), 0),
      }),
      get_quote: (...args) => args[0],
      get_profile: (...args) => args[1],
    };
    wrapped.get_tx_quote = wrapped.get_quote;
  }
  return wrapped;
}

function latest_api(action) {
  return VaultActionAPI[action];
}

function select_price_contracts(proto_profile, action_quote, price_quote) {
  const contracts = price_quote?.contracts ?? price_quote?.price_contracts ?? [];
  if (contracts.length === 0) return [];
  const hashes = get_price_commit_hashes(proto_profile, action_quote, [core_price_quote(price_quote)]);
  const filtered = filter_price_contracts(contracts, hashes);
  return filtered.length > 0 ? filtered : contracts;
}

function core_price_quote(quote) {
  const { base_price, base_stamp, chain_network, oracle_pubkey, rate_min, rate_max, rate_thold, step_size } = quote;
  return { base_price, base_stamp, chain_network, oracle_pubkey, rate_min, rate_max, rate_thold, step_size };
}

function to_latest_vault_profile(profile, proto_profile) {
  if (!profile) return profile;
  if ('coin_id' in profile && 'client_pubkey' in profile) return profile;
  const rdata = profile.rdata ?? {};
  const utxo = profile.utxo ?? {};
  const action = vault_action_label(rdata.vault_action);
  return {
    coin_id: utxo.txid !== undefined && utxo.vout !== undefined ? `${utxo.txid}:${utxo.vout}` : null,
    client_pubkey: profile.vault_pk,
    contract_id: proto_profile.contract_id,
    guard_members: [profile.guard_pk].filter(Boolean),
    guard_pubkey: profile.guard_pk,
    price_commits: rdata.thold_hash ? [{
      base_price: rdata.unit_price ?? 0,
      oracle_pubkey: first_oracle_pubkey(proto_profile),
      oracle_sig: '',
      thold_hash: rdata.thold_hash,
      thold_price: rdata.thold_price ?? 0,
    }] : [],
    price_stamp: rdata.unit_stamp ?? null,
    root_txid: utxo.txid ?? '',
    thold_price: rdata.thold_price ?? null,
    unit_balance: rdata.unit_balance ?? 0,
    unit_price: rdata.unit_price ?? null,
    vault_action: action,
    vault_balance: utxo.value ?? 0,
    vault_config: null,
    vault_ratio: null,
    vault_script: utxo.script ?? null,
    vault_value: utxo.value ?? null,
    vault_version: 3,
  };
}

function vault_action_label(action) {
  const map = { o: 'open', b: 'borrow', r: 'repay', d: 'deposit', w: 'withdraw', l: 'repo', x: 'close' };
  return map[action] ?? action ?? 'open';
}

function first_guard_pubkey(proto_profile) {
  return proto_profile.proto_members?.find((member) => member.group === 21)?.pubkey ?? proto_profile.proto_members?.[0]?.pubkey;
}

function first_oracle_pubkey(proto_profile) {
  return proto_profile.proto_members?.find((member) => member.group === 22)?.pubkey ?? proto_profile.proto_members?.[0]?.pubkey ?? '';
}

function get_unit_asset_id(proto_profile) {
  return proto_profile.proto_assets?.[0]?.id ?? globalThis.process?.env?.EXPO_PUBLIC_UNIT_ASSET_ID ?? DEFAULT_UNIT_ASSET_ID;
}

function rune_utxos_to_asset_accounts(utxos = [], asset_id) {
  return utxos.map((utxo) => ({
    asset_id,
    asset_balance: rune_amount(utxo, asset_id),
    asset_reserve: 0,
    coin_id: `${utxo.txid}:${utxo.vout}`,
    coin_script: utxo.script ?? utxo.script_pk,
    coin_value: utxo.value,
  }));
}

function rune_amount(utxo, asset_id) {
  if (utxo.runes instanceof Map) {
    return utxo.runes.get(asset_id)?.amount ?? [...utxo.runes.values()][0]?.amount ?? 0;
  }
  return utxo.amount ?? 0;
}

function to_coin_utxos(utxos = []) {
  return utxos.map((utxo) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    script_pk: utxo.script_pk ?? utxo.script,
  }));
}

function select_legacy_coin_utxos(utxos = [], amount) {
  const original = new Map(utxos.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo]));
  return select_coins(to_coin_utxos(utxos), amount).map((coin) => (
    original.get(`${coin.txid}:${coin.vout}`) ?? {
      ...coin,
      script: coin.script_pk,
    }
  ));
}

function select_rune_utxos(utxos, rune, amount) {
  let total = 0;
  const selected = [];
  for (const utxo of utxos) {
    selected.push(utxo);
    total += rune_amount(utxo, rune);
    if (total >= amount) return selected;
  }
  throw new Error(`insufficient funds for asset: ${total} < ${amount}`);
}

function legacy_subscription(sub, map = (value) => value) {
  const compat = {
    on: (...args) => {
      sub.on(...args);
      return compat;
    },
    once: (...args) => {
      sub.once(...args);
      return compat;
    },
    resolve: async (timeout) => {
      const res = await sub.send(timeout);
      if (!res.ok) throw new Error(String(res.reason));
      return map(res.data);
    },
    send: async (timeout) => {
      const res = await sub.send(timeout);
      if (!res.ok) throw new Error(String(res.reason));
      return map(res.data);
    },
  };
  return compat;
}

function parse_script_hex(hex) {
  if (hex.startsWith('0014')) return { type: 'p2w-pkh', key: { hex: hex.slice(4) } };
  if (hex.startsWith('5120')) return { type: 'p2tr', key: { hex: hex.slice(4) } };
  if (hex.startsWith('a914')) return { type: 'p2sh', key: { hex: hex.slice(4, -2) } };
  return { type: 'unknown', key: undefined };
}
