import { Buffer } from 'node:buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  Contract,
  formatEther,
  formatUnits,
  HDNodeWallet,
  JsonRpcProvider,
  parseEther,
  parseUnits,
} from 'ethers';

export const DEFAULT_REVIEWER_MNEMONIC =
  'pool token pledge wagon rebuild vast bracket denial fashion cattle pave royal';

const MUTINYNET_NETWORK = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const bip32 = BIP32Factory(ecc);
const LIQ_PAGE_SIZE = 250;
const LIQ_MAX_PAGES = 10;
const DEFAULT_BTC_FAUCET_ADDRESS = 'tb1q0t5r06dxahch4ft7phkhmgdhqtx060t4lkd7cy';
const DEFAULT_BTC_FAUCET_CLAIM_SATS = 10_000_000;
const DEFAULT_BTC_FAUCET_FEE_SATS = 1_000;
const DEFAULT_BTC_FAUCET_ORD_URL = 'https://ord-mutinynet.ducatprotocol.com';
const DEFAULT_BTC_FAUCET_MEMPOOL_URL = 'https://mutinynet.com/api';

if (typeof bitcoin.initEccLib === 'function') {
  bitcoin.initEccLib(ecc);
}

function envValue(env, name, fallback = '') {
  const value = env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function defaultReviewerMnemonic(env) {
  return envValue(env, 'DUCAT_LIVE_E2E_SEED_PHRASE', DEFAULT_REVIEWER_MNEMONIC);
}

function getEsploraUrl(env) {
  return envValue(
    env,
    'DUCAT_LIVE_ESPLORA_API_URL',
    envValue(env, 'EXPO_PUBLIC_ESPLORA_API_URL', 'https://explorer-mutinynet.dev.ducatprotocol.com/api')
  ).replace(/\/+$/, '');
}

function getSepoliaRpcUrl(env) {
  return envValue(env, 'DUCAT_LIVE_SEPOLIA_RPC_URL', envValue(env, 'EXPO_PUBLIC_SEPOLIA_RPC_URL'));
}

function getLiquidationValidatorUrl(env) {
  const configured = envValue(
    env,
    'EXPO_PUBLIC_LIQ_VALIDATOR_URL',
    envValue(env, 'EXPO_PUBLIC_VALIDATOR_URL', 'https://validator-mutinynet.dev.ducatprotocol.com')
  );
  return configured.replace(/\/api\/?$/, '').replace(/\/liq\/?$/, '').replace(/\/+$/, '');
}

function getRequiredEvmAddress(env, name) {
  const value = envValue(env, name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} is required and must be a 20-byte Ethereum address`);
  }
  return value;
}

export function deriveReviewerFixture(env = process.env) {
  const mnemonic = defaultReviewerMnemonic(env);
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('DUCAT live reviewer mnemonic is not a valid BIP39 seed phrase.');
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  const segwitChild = root.derivePath("m/84'/1'/0'/0/0");
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(segwitChild.publicKey),
    network: MUTINYNET_NETWORK,
  });

  const taprootChild = root.derivePath("m/86'/1'/0'/0/0");
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(taprootChild.publicKey.slice(1, 33)),
    network: MUTINYNET_NETWORK,
  });

  const evmDerivationPath = "m/44'/60'/0'/0/0";
  const evmWallet = HDNodeWallet.fromPhrase(mnemonic, undefined, evmDerivationPath);

  if (!segwitPayment.address || !taprootPayment.address) {
    throw new Error('Failed to derive live reviewer wallet addresses.');
  }

  return {
    segwitAddress: segwitPayment.address,
    taprootAddress: taprootPayment.address,
    evmAddress: evmWallet.address,
    evmDerivationPath,
  };
}

async function fetchJson(url, init = undefined) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function liquidationPageRows(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function liquidationNextCursor(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data.has_more === true && typeof data.next_cursor === 'string' && data.next_cursor
    ? data.next_cursor
    : null;
}

function isExpiredSnapshotPaginationError(response, body) {
  return response.status === 400 && body.toLowerCase().includes('expired snapshot');
}

function liquidationAction(row) {
  return row?.stone?.action ?? row?.vault_action ?? row?.latest_profile?.vault_action;
}

function isTerminalLiquidationAction(action) {
  const normalized = typeof action === 'string' ? action.trim().toLowerCase() : '';
  return (
    normalized === 'liquidation' ||
    normalized === 'liquidate' ||
    normalized === 'repo' ||
    normalized === 'l'
  );
}

function isClaimableLiquidationRow(row) {
  return row?.quote?.is_expired !== true && !isTerminalLiquidationAction(liquidationAction(row));
}

async function fetchLiquidationFeed(liquidationUrl) {
  const rows = [];
  let cursor = null;
  let pageCount = 0;
  let stoppedAtExpiredSnapshot = false;
  let stoppedAtPageGuard = false;

  do {
    const url = new URL(`${liquidationUrl}/api/liquid/vaults`);
    url.searchParams.set('page_size', String(LIQ_PAGE_SIZE));
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (rows.length > 0 && isExpiredSnapshotPaginationError(response, body)) {
        stoppedAtExpiredSnapshot = true;
        break;
      }

      throw new Error(`${url.toString()} returned HTTP ${response.status} ${body.slice(0, 160)}`);
    }

    const pageData = await response.json();
    rows.push(...liquidationPageRows(pageData));
    pageCount += 1;
    const nextCursor = liquidationNextCursor(pageData);
    stoppedAtPageGuard = pageCount >= LIQ_MAX_PAGES && nextCursor !== null;
    cursor = stoppedAtPageGuard ? null : nextCursor;
  } while (cursor);

  const expiredQuoteCount = rows.filter((row) => row?.quote?.is_expired === true).length;
  const terminalActionCount = rows.filter((row) =>
    isTerminalLiquidationAction(liquidationAction(row))
  ).length;
  const claimableCount = rows.filter(isClaimableLiquidationRow).length;

  return {
    endpoint: `${liquidationUrl}/api/liquid/vaults`,
    pageSize: LIQ_PAGE_SIZE,
    pageCount,
    rawCount: rows.length,
    claimableCount,
    expiredQuoteCount,
    terminalActionCount,
    paginationIncomplete: stoppedAtExpiredSnapshot || stoppedAtPageGuard,
    stoppedAtExpiredSnapshot,
    stoppedAtPageGuard,
  };
}

async function addressUtxoSats(esploraUrl, address) {
  const utxos = await fetchJson(`${esploraUrl}/address/${address}/utxo`);
  if (!Array.isArray(utxos)) {
    throw new Error(`Esplora UTXO response for ${address} was not an array.`);
  }
  return {
    address,
    utxos: utxos.length,
    sats: utxos.reduce((sum, utxo) => sum + Number(utxo?.value || 0), 0),
  };
}

async function faucetAddressUtxos(ordUrl, mempoolUrl, address) {
  const addressData = await fetchJson(`${ordUrl}/address/${address}`, {
    headers: { Accept: 'application/json' },
  });
  const outputs = Array.isArray(addressData?.outputs) ? addressData.outputs : [];
  const rows = await Promise.all(
    outputs.map(async (outpoint) => {
      const [txid, voutText] = String(outpoint).split(':');
      if (!txid || voutText === undefined) return null;

      const [outputData, spendInfo] = await Promise.all([
        fetchJson(`${ordUrl}/output/${outpoint}`, { headers: { Accept: 'application/json' } }),
        fetchJson(`${mempoolUrl}/tx/${txid}/outspend/${voutText}`),
      ]);
      if (spendInfo?.spent === true) return null;

      return {
        outpoint,
        value: Number(outputData?.value || 0),
      };
    })
  );

  return rows.filter((row) => row && row.value > 0).sort((a, b) => b.value - a.value);
}

export async function checkBtcFaucetLiquidity(env = process.env, options = {}) {
  const address = envValue(env, 'DUCAT_LIVE_BTC_FAUCET_ADDRESS', DEFAULT_BTC_FAUCET_ADDRESS);
  const ordUrl = envValue(env, 'DUCAT_LIVE_BTC_FAUCET_ORD_URL', DEFAULT_BTC_FAUCET_ORD_URL)
    .replace(/\/+$/, '');
  const mempoolUrl = envValue(
    env,
    'DUCAT_LIVE_BTC_FAUCET_MEMPOOL_URL',
    DEFAULT_BTC_FAUCET_MEMPOOL_URL
  ).replace(/\/+$/, '');
  const claimSats = positiveNumber(
    options.claimSats ?? envValue(env, 'DUCAT_LIVE_BTC_FAUCET_CLAIM_SATS'),
    DEFAULT_BTC_FAUCET_CLAIM_SATS
  );
  const feeSats = positiveNumber(
    options.feeSats ?? envValue(env, 'DUCAT_LIVE_BTC_FAUCET_FEE_SATS'),
    DEFAULT_BTC_FAUCET_FEE_SATS
  );
  const requiredClaims = Math.ceil(
    positiveNumber(options.claims ?? envValue(env, 'DUCAT_LIVE_BTC_FAUCET_REQUIRED_CLAIMS'), 1)
  );
  const minSats = positiveNumber(
    options.minSats ?? envValue(env, 'DUCAT_LIVE_BTC_FAUCET_MIN_SATS'),
    (claimSats + feeSats) * requiredClaims
  );

  const utxos = await faucetAddressUtxos(ordUrl, mempoolUrl, address);
  const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const largestUtxoSats = utxos[0]?.value ?? 0;
  const passed = totalSats >= minSats && largestUtxoSats >= claimSats + feeSats;

  return {
    id: 'btc-faucet-liquidity',
    passed,
    address,
    requiredClaims,
    minSats,
    claimSats,
    feeSats,
    totalSats,
    utxoCount: utxos.length,
    largestUtxoSats,
    error: passed
      ? null
      : `BTC faucet has ${totalSats} sats across ${utxos.length} UTXOs; need at least ${minSats} sats and one UTXO >= ${claimSats + feeSats}.`,
  };
}

export async function checkMutinynetReviewerFunding(env = process.env, options = {}) {
  const reviewer = deriveReviewerFixture(env);
  const esploraUrl = getEsploraUrl(env);
  const minSats = Number(
    options.minSats ?? envValue(env, 'DUCAT_LIVE_MIN_MUTINYNET_SATS', '50000')
  );
  const addressResults = await Promise.all([
    addressUtxoSats(esploraUrl, reviewer.segwitAddress),
    addressUtxoSats(esploraUrl, reviewer.taprootAddress),
  ]);
  const totalSats = addressResults.reduce((sum, result) => sum + result.sats, 0);

  return {
    id: 'reviewer-mutinynet-funding',
    passed: totalSats >= minSats,
    minSats,
    totalSats,
    addresses: addressResults,
    error:
      totalSats >= minSats
        ? null
        : `Reviewer Mutinynet fixture has ${totalSats} sats; need at least ${minSats}.`,
  };
}

export async function checkSepoliaReviewerFunding(env = process.env, options = {}) {
  const reviewer = deriveReviewerFixture(env);
  const rpcUrl = getSepoliaRpcUrl(env);
  if (!rpcUrl) {
    throw new Error('Sepolia RPC URL is required for live Sepolia fixture funding checks.');
  }

  const provider = new JsonRpcProvider(rpcUrl, 11155111);
  const usdc = new Contract(
    getRequiredEvmAddress(env, 'EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS'),
    ERC20_ABI,
    provider
  );
  const wunit = new Contract(
    getRequiredEvmAddress(env, 'EXPO_PUBLIC_WUNIT_ADDRESS'),
    ERC20_ABI,
    provider
  );

  const minEth = parseEther(
    String(options.minEth ?? envValue(env, 'DUCAT_LIVE_MIN_SEPOLIA_ETH', '0.005'))
  );
  const minUsdc = parseUnits(
    String(options.minUsdc ?? envValue(env, 'DUCAT_LIVE_MIN_SEPOLIA_USDC', '0.01')),
    6
  );
  const minWunit = parseUnits(
    String(options.minWunit ?? envValue(env, 'DUCAT_LIVE_MIN_SEPOLIA_WUNIT', '0')),
    6
  );
  const [eth, usdcBalance, wunitBalance] = await Promise.all([
    provider.getBalance(reviewer.evmAddress),
    usdc.balanceOf(reviewer.evmAddress),
    wunit.balanceOf(reviewer.evmAddress),
  ]);

  const failures = [];
  if (eth < minEth) {
    failures.push(`ETH ${formatEther(eth)} < ${formatEther(minEth)}`);
  }
  if (usdcBalance < minUsdc) {
    failures.push(`USDC ${formatUnits(usdcBalance, 6)} < ${formatUnits(minUsdc, 6)}`);
  }
  if (wunitBalance < minWunit) {
    failures.push(`wUNIT ${formatUnits(wunitBalance, 6)} < ${formatUnits(minWunit, 6)}`);
  }

  return {
    id: 'reviewer-sepolia-funding',
    passed: failures.length === 0,
    address: reviewer.evmAddress,
    balances: {
      eth: formatEther(eth),
      usdc: formatUnits(usdcBalance, 6),
      wunit: formatUnits(wunitBalance, 6),
    },
    minimums: {
      eth: formatEther(minEth),
      usdc: formatUnits(minUsdc, 6),
      wunit: formatUnits(minWunit, 6),
    },
    error:
      failures.length === 0
        ? null
        : `Reviewer Sepolia fixture underfunded: ${failures.join(', ')}.`,
  };
}

export async function checkBridgePoolLiquidity(env = process.env) {
  const rpcUrl = getSepoliaRpcUrl(env);
  if (!rpcUrl) {
    throw new Error('Sepolia RPC URL is required for bridge pool liquidity checks.');
  }

  const provider = new JsonRpcProvider(rpcUrl, 11155111);
  const poolAddress = getRequiredEvmAddress(env, 'EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS');
  const usdc = new Contract(
    getRequiredEvmAddress(env, 'EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS'),
    ERC20_ABI,
    provider
  );
  const wunit = new Contract(
    getRequiredEvmAddress(env, 'EXPO_PUBLIC_WUNIT_ADDRESS'),
    ERC20_ABI,
    provider
  );
  const [usdcReserve, wunitReserve] = await Promise.all([
    usdc.balanceOf(poolAddress),
    wunit.balanceOf(poolAddress),
  ]);
  const passed = usdcReserve > 0n && wunitReserve > 0n;

  return {
    id: 'bridge-pool-liquidity',
    passed,
    poolAddress,
    reserves: {
      usdc: formatUnits(usdcReserve, 6),
      wunit: formatUnits(wunitReserve, 6),
    },
    error: passed
      ? null
      : `Bridge pool liquidity is empty or unavailable: USDC=${formatUnits(usdcReserve, 6)}, wUNIT=${formatUnits(wunitReserve, 6)}.`,
  };
}

export async function checkLiquidationAvailability(env = process.env) {
  const liquidationUrl = getLiquidationValidatorUrl(env);
  let statsTotalCount = null;
  let statsError = null;
  try {
    const stats = await fetchJson(`${liquidationUrl}/api/liquid/stats`);
    statsTotalCount = Number(stats?.data?.total_count ?? stats?.total_count ?? 0);
  } catch (error) {
    statsError = error instanceof Error ? error.message : String(error);
  }

  let feed;
  try {
    feed = await fetchLiquidationFeed(liquidationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: 'liquidation-availability',
      passed: false,
      liquidationUrl,
      availableVaults: 0,
      statsTotalCount,
      statsError,
      feed: null,
      error: `Liquidation validator feed is unavailable: ${message}`,
    };
  }

  const availableVaults = feed.claimableCount;
  const passed = availableVaults > 0;

  return {
    id: 'liquidation-availability',
    passed,
    liquidationUrl,
    availableVaults,
    statsTotalCount,
    statsError,
    feed,
    error:
      passed
        ? null
        : `Liquidation validator feed has no claimable vaults: raw=${feed.rawCount}, terminal=${feed.terminalActionCount}, expired=${feed.expiredQuoteCount}, stats=${statsTotalCount ?? 'unknown'}.`,
  };
}
