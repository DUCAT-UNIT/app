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
    envValue(env, 'EXPO_PUBLIC_ESPLORA_API_URL', 'https://mutinynet.com/api')
  ).replace(/\/+$/, '');
}

function getSepoliaRpcUrl(env) {
  return envValue(env, 'DUCAT_LIVE_SEPOLIA_RPC_URL', envValue(env, 'EXPO_PUBLIC_SEPOLIA_RPC_URL'));
}

function getLiquidationValidatorUrl(env) {
  const configured = envValue(env, 'EXPO_PUBLIC_LIQ_VALIDATOR_URL');
  if (configured) return configured.replace(/\/+$/, '');

  const vaultApi = envValue(
    env,
    'EXPO_PUBLIC_VAULT_API_URL',
    'https://validator.ducatprotocol.com/api'
  );
  return vaultApi.replace(/\/api\/?$/, '/liq').replace(/\/+$/, '');
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
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
  const vaults = await fetchJson(`${liquidationUrl}/api/liquidated`);
  if (!Array.isArray(vaults)) {
    throw new Error('Liquidation validator returned a non-array liquidated vault response.');
  }

  return {
    id: 'liquidation-availability',
    passed: vaults.length > 0,
    liquidationUrl,
    availableVaults: vaults.length,
    error:
      vaults.length > 0
        ? null
        : 'Liquidation validator has no liquidatable vaults available for a live claim.',
  };
}
