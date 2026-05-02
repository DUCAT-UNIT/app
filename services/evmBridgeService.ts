import {
  Contract,
  EventLog,
  MaxUint256,
  formatEther,
  formatUnits,
  id,
  isAddress,
  parseUnits,
} from 'ethers';
import { EVM_CONFIG, EVM_DECIMALS } from '../constants/evm';
import { trackRedemption } from './bridgeApiService';
import { getSepoliaProvider, withSepoliaSigner } from './evmWalletService';
import type { SwapQuote, TrackRedemptionRequest } from '../shared/bridgeTypes';
import {
  useEvmTransactionCheckpointStore,
  type EvmTransactionCheckpointInput,
} from '../stores/evmTransactionCheckpointStore';
import type { DisplayAssetType } from '../types/assets';
import { getJSON } from '../utils/apiClient';
import { TAPROOT_ADDRESS_PREFIX, validateBitcoinAddress } from '../utils/bitcoin';
import { logger } from '../utils/logger';

export type SepoliaAsset = 'USDC' | 'wUNIT';
export type SepoliaTransferAsset = SepoliaAsset | 'ETH';
export type CrossChainSwapAsset = 'UNIT' | 'USDC';

export interface EvmBalances {
  address: string;
  eth: string;
  usdc: string;
  wunit: string;
}

export interface SwapExecutionResult {
  approvalTxHash?: string;
  swapTxHash: string;
  amountIn: string;
  amountOut: string;
  tokenIn: SepoliaAsset;
  tokenOut: SepoliaAsset;
}

export interface RedemptionExecutionResult {
  releaseId: string;
  burnTxHash: string;
  redeemedAmount: string;
  sourceAsset: SepoliaAsset;
  preparationSwap?: SwapExecutionResult;
  trackRedemptionError?: string;
}

export interface CrossChainSwapQuote {
  tokenIn: CrossChainSwapAsset;
  tokenOut: CrossChainSwapAsset;
  amountIn: string;
  amountOut: string;
  minimumAmountOut: string;
  intermediaryAsset: 'wUNIT';
  route: 'bridge_stable_pool' | 'stable_pool_redemption';
}

export interface CrossChainSwapLimit {
  maxInputAmount: string;
  reserveWunit: string;
  reserveUsdc: string;
}

export interface UnitUsdcPoolQuoteSample {
  amountIn: string;
  unitToUsdcOut: string;
  unitToUsdcImpactBps: number;
  usdcToUnitOut: string;
  usdcToUnitImpactBps: number;
}

export interface UnitUsdcPoolWalletState {
  address: string;
  eth: string;
  usdc: string;
  wunit: string;
  stablePoolUsdcAllowance: string;
  stablePoolWunitAllowance: string;
  bridgeRouterWunitAllowance: string;
  canSwapUsdcSample: boolean;
  canSwapUnitSample: boolean;
  canRedeemUnitSample: boolean;
}

export interface UnitUsdcPoolDashboard {
  checkedAt: number;
  status: 'ready' | 'degraded' | 'unconfigured' | 'error';
  readiness: {
    sepoliaRpc: boolean;
    bridgeApi: boolean;
    usdc: boolean;
    wunit: boolean;
    stablePool: boolean;
    bridgeRouter: boolean;
    poolContracts: boolean;
    bridgeContracts: boolean;
  };
  contracts: {
    usdcAddress: string;
    wunitAddress: string;
    stablePoolAddress: string;
    bridgeRouterAddress: string;
  };
  reserves: {
    usdc: string;
    wunit: string;
  } | null;
  impliedUnitPriceUsdc: string | null;
  imbalanceBps: number | null;
  maxInputAmount: string | null;
  quoteSamples: UnitUsdcPoolQuoteSample[];
  wallet: UnitUsdcPoolWalletState | null;
  error: string | null;
}

export interface CrossChainSwapExecutionEstimate {
  totalGasUnits: string;
  totalFeeEth: string;
  gasPriceGwei: string;
  feePaymentAsset: 'ETH';
  requiresUsdcApproval: boolean;
  requiresWunitApproval: boolean;
  walletAddress: string;
  ethBalance: string;
  requiredEth: string;
  usdcBalance: string;
  wunitBalance: string;
  requiredUsdcAmount: string;
  expectedWunitAmount: string;
  hasEnoughUsdc: boolean;
  hasEnoughEth: boolean;
  canExecute: boolean;
  blockingReasons: string[];
}

export interface SepoliaTokenTransferEstimate {
  gasUnits: string;
  totalFeeEth: string;
  gasPriceGwei: string;
  walletAddress: string;
  assetBalance: string;
  ethBalance: string;
  requiredAssetAmount: string;
  requiredEth: string;
  hasEnoughAsset: boolean;
  hasEnoughEth: boolean;
  canExecute: boolean;
  blockingReasons: string[];
}

export interface SepoliaTokenTransferResult {
  txHash: string;
  amount: string;
  token: SepoliaTransferAsset;
  recipient: string;
}

export interface RedemptionExecutionEstimate extends CrossChainSwapExecutionEstimate {
  sourceAsset: SepoliaAsset;
  requiredSourceAmount: string;
  sourceBalance: string;
  hasEnoughSource: boolean;
}

export interface SepoliaAssetHistoryItem {
  txid: string;
  status: {
    confirmed: boolean;
    block_time?: number;
    failed?: boolean;
  };
  txData: {
    amount: number;
    assetType: DisplayAssetType;
    isSent: boolean;
    isReceived: boolean;
  };
}

export type EvmExecutionErrorKind =
  | 'user_rejected'
  | 'insufficient_funds'
  | 'allowance_race'
  | 'replacement_transaction'
  | 'reverted'
  | 'timeout'
  | 'rpc_unavailable'
  | 'unknown';

export interface EvmExecutionErrorClassification {
  kind: EvmExecutionErrorKind;
  retryable: boolean;
  userMessage: string;
  rawMessage: string;
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const POOL_ABI = [
  'function quoteSwap(uint8 tokenIn, uint256 amountIn) view returns (uint256)',
  'function getBalances() view returns (uint256[2])',
  'function swap(uint8 tokenIn, uint256 amountIn, uint256 minAmountOut, address receiver) returns (uint256)',
];

const ROUTER_ABI = [
  'function requestRedemption(bytes32 releaseId, uint256 amount, string destinationTaprootAddress)',
];

const HISTORY_BLOCK_LOOKBACK = 300_000;
const HISTORY_QUERY_CHUNK_SIZE = 20_000;
const FALLBACK_USDC_APPROVAL_GAS = 55_000n;
const FALLBACK_SWAP_GAS = 240_000n;
const FALLBACK_WUNIT_APPROVAL_GAS = 55_000n;
const FALLBACK_REDEMPTION_GAS = 220_000n;
const FALLBACK_ERC20_TRANSFER_GAS = 65_000n;
const FALLBACK_ETH_TRANSFER_GAS = 21_000n;
const SEPOLIA_BLOCKSCOUT_API_BASE_URL = 'https://eth-sepolia.blockscout.com/api/v2';

interface BlockscoutAddressRef {
  hash?: string | null;
}

interface BlockscoutTransactionItem {
  hash?: string | null;
  status?: string | null;
  result?: string | null;
  value?: string | number | bigint | null;
  timestamp?: string | null;
  block_number?: number | null;
  block?: number | null;
  from?: BlockscoutAddressRef | null;
  to?: BlockscoutAddressRef | null;
}

interface BlockscoutTransactionsResponse {
  items?: BlockscoutTransactionItem[];
}

function assertBridgeContractsConfigured(): void {
  if (!EVM_CONFIG.wunitAddress || !EVM_CONFIG.bridgeRouterAddress || !EVM_CONFIG.stablePoolAddress) {
    throw new Error('Sepolia bridge contracts are not configured');
  }
}

function getTokenConfig(token: SepoliaAsset): { address: string; index: number; opposite: SepoliaAsset } {
  if (token === 'wUNIT') {
    if (!EVM_CONFIG.wunitAddress) {
      throw new Error('Sepolia wUNIT contract is not configured');
    }
    return { address: EVM_CONFIG.wunitAddress, index: 0, opposite: 'USDC' };
  }

  if (!EVM_CONFIG.usdcAddress) {
    throw new Error('Sepolia USDC contract is not configured');
  }

  return { address: EVM_CONFIG.usdcAddress, index: 1, opposite: 'wUNIT' };
}

async function queryTransferLogsInChunks(
  contract: Contract,
  filter: ReturnType<Contract['filters']['Transfer']>,
  fromBlock: number,
  toBlock: number,
): Promise<EventLog[]> {
  const results: EventLog[] = [];

  for (let start = fromBlock; start <= toBlock; start += HISTORY_QUERY_CHUNK_SIZE) {
    const end = Math.min(start + HISTORY_QUERY_CHUNK_SIZE - 1, toBlock);
    const events = await contract.queryFilter(filter, start, end) as EventLog[];
    results.push(...events);
  }

  return results;
}

async function ensureAllowance(
  accountIndex: number,
  token: SepoliaAsset,
  spender: string,
  amount: bigint,
): Promise<string | undefined> {
  return withSepoliaSigner(accountIndex, async (wallet) => {
    const tokenContract = new Contract(getTokenConfig(token).address, ERC20_ABI, wallet);
    const allowance = (await tokenContract.allowance(wallet.address, spender)) as bigint;
    logger.debug('[SepoliaBridge] Checking allowance', {
      token,
      owner: wallet.address,
      spender,
      allowance: formatUnits(allowance, EVM_DECIMALS),
      requiredAmount: formatUnits(amount, EVM_DECIMALS),
    });
    if (allowance >= amount) {
      return undefined;
    }

    logger.debug('[SepoliaBridge] Sending approval', {
      token,
      owner: wallet.address,
      spender,
    });
    const approval = await tokenContract.approve(spender, MaxUint256);
    recordSubmittedEvmTx({
      accountIndex,
      kind: 'approval',
      txHash: approval.hash,
      asset: token,
      amount: formatUnits(amount, EVM_DECIMALS),
      spender,
      recipient: null,
      tokenIn: null,
      tokenOut: null,
      releaseId: null,
      destinationTaprootAddress: null,
    });
    let receipt: { hash?: string } | null;
    try {
      receipt = await approval.wait(EVM_CONFIG.confirmations);
      markConfirmedEvmTx(approval.hash, receipt?.hash || approval.hash);
    } catch (error) {
      markFailedEvmTx(approval.hash, error);
      throw error;
    }
    logger.debug('[SepoliaBridge] Approval confirmed', {
      token,
      owner: wallet.address,
      spender,
      txHash: receipt?.hash || approval.hash,
    });
    return receipt?.hash || approval.hash;
  });
}

async function estimateGasOrFallback(
  estimate: () => Promise<bigint>,
  fallback: bigint,
): Promise<bigint> {
  try {
    return await estimate();
  } catch {
    return fallback;
  }
}

function parsePositiveAmountUnits(
  amount: string,
  decimals: number,
  asset: SepoliaTransferAsset,
): bigint {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Enter a valid ${asset} amount`);
  }

  let amountUnits: bigint;
  try {
    amountUnits = parseUnits(normalized, decimals);
  } catch {
    throw new Error(`Enter a valid ${asset} amount`);
  }

  if (amountUnits <= 0n) {
    throw new Error(`Enter a ${asset} amount greater than zero`);
  }

  return amountUnits;
}

function getTransferDecimals(asset: SepoliaTransferAsset): number {
  return asset === 'ETH' ? 18 : EVM_DECIMALS;
}

function formatTransferAmount(amountUnits: bigint, asset: SepoliaTransferAsset): string {
  return asset === 'ETH'
    ? formatEther(amountUnits)
    : formatUnits(amountUnits, EVM_DECIMALS);
}

function buildBlockingReasons(checks: Array<{ passed: boolean; message: string }>): string[] {
  return checks
    .filter((check) => !check.passed)
    .map((check) => check.message);
}

function assertCanExecutePreflight(
  canExecute: boolean,
  blockingReasons: string[],
  fallbackMessage: string,
): void {
  if (canExecute) {
    return;
  }

  throw new Error(blockingReasons.length > 0 ? blockingReasons.join(' ') : fallbackMessage);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' || typeof code === 'number' ? String(code) : '';
  }
  return '';
}

export function classifyEvmExecutionError(error: unknown): EvmExecutionErrorClassification {
  const rawMessage = getErrorMessage(error);
  const code = getErrorCode(error).toLowerCase();
  const message = rawMessage.toLowerCase();

  if (
    code === 'action_rejected' ||
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('request rejected')
  ) {
    return {
      kind: 'user_rejected',
      retryable: true,
      userMessage: 'Transaction was rejected before submission. Review and try again when ready.',
      rawMessage,
    };
  }

  if (
    message.includes('insufficient funds') ||
    message.includes('not enough sepolia eth') ||
    message.includes('not enough usdc') ||
    message.includes('not enough wunit')
  ) {
    return {
      kind: 'insufficient_funds',
      retryable: false,
      userMessage: rawMessage,
      rawMessage,
    };
  }

  if (
    message.includes('allowance') ||
    message.includes('transfer amount exceeds allowance') ||
    message.includes('erc20: insufficient allowance')
  ) {
    return {
      kind: 'allowance_race',
      retryable: true,
      userMessage: 'Token allowance changed while submitting. Refresh balances and retry the approval/swap.',
      rawMessage,
    };
  }

  if (
    message.includes('replacement transaction underpriced') ||
    message.includes('nonce too low') ||
    message.includes('already known') ||
    message.includes('transaction replaced')
  ) {
    return {
      kind: 'replacement_transaction',
      retryable: true,
      userMessage: 'Sepolia nonce state changed while submitting. Refresh the wallet state and retry.',
      rawMessage,
    };
  }

  if (
    code === 'call_exception' ||
    message.includes('execution reverted') ||
    message.includes('transaction reverted') ||
    message.includes('reverted on-chain')
  ) {
    return {
      kind: 'reverted',
      retryable: false,
      userMessage: 'Sepolia transaction reverted. Check pool liquidity, allowances, and contract readiness before retrying.',
      rawMessage,
    };
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      kind: 'timeout',
      retryable: true,
      userMessage: 'Sepolia RPC timed out. The transaction may still be pending; check pending activity before retrying.',
      rawMessage,
    };
  }

  if (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('rpc') ||
    message.includes('503') ||
    message.includes('429')
  ) {
    return {
      kind: 'rpc_unavailable',
      retryable: true,
      userMessage: 'Sepolia RPC is unavailable or rate limited. Wait briefly, check pending activity, and retry.',
      rawMessage,
    };
  }

  return {
    kind: 'unknown',
    retryable: true,
    userMessage: rawMessage || 'Sepolia execution failed. Check pending activity and retry.',
    rawMessage,
  };
}

function recordSubmittedEvmTx(input: EvmTransactionCheckpointInput): void {
  useEvmTransactionCheckpointStore.getState().recordSubmitted(input);
}

function markConfirmedEvmTx(txHash: string, receiptTxHash?: string | null): void {
  useEvmTransactionCheckpointStore.getState().markConfirmed(txHash, receiptTxHash);
}

function markFailedEvmTx(txHash: string, error: unknown): void {
  useEvmTransactionCheckpointStore.getState().markFailed(txHash, getErrorMessage(error));
}

function getEventLogIndex(event: EventLog): number | null {
  const eventWithIndexes = event as unknown as { index?: unknown; logIndex?: unknown };
  if (typeof eventWithIndexes.index === 'number') {
    return eventWithIndexes.index;
  }
  if (typeof eventWithIndexes.logIndex === 'number') {
    return eventWithIndexes.logIndex;
  }
  return null;
}

function getTransferEventKey(event: EventLog, from: string, to: string, amount: bigint): string {
  const logIndex = getEventLogIndex(event);
  if (logIndex !== null) {
    return `${event.transactionHash}:${logIndex}`;
  }

  return `${event.transactionHash}:${event.blockNumber}:${from}:${to}:${amount.toString()}`;
}

function parseBlockscoutTimestamp(timestamp?: string | null): number | undefined {
  if (!timestamp) {
    return undefined;
  }

  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis)) {
    return undefined;
  }

  return Math.floor(millis / 1000);
}

function getBlockscoutAddressHash(address?: BlockscoutAddressRef | null): string {
  return typeof address?.hash === 'string' ? address.hash.toLowerCase() : '';
}

function parseBlockscoutWei(value: BlockscoutTransactionItem['value']): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return 0n;
}

function assertMutinynetTaprootDestination(destinationTaprootAddress: string): string {
  const trimmed = destinationTaprootAddress.trim();
  const validation = validateBitcoinAddress(trimmed);
  if (!validation.valid) {
    throw new Error(validation.error || 'Enter a valid Mutinynet Taproot address');
  }
  if (validation.type !== 'taproot') {
    throw new Error(`Redemption destination must be a Mutinynet Taproot address (${TAPROOT_ADDRESS_PREFIX}...).`);
  }

  return trimmed;
}

function isConfiguredHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getUnitUsdcPoolReadiness(): UnitUsdcPoolDashboard['readiness'] {
  const sepoliaRpc = isConfiguredHttpUrl(EVM_CONFIG.rpcUrl);
  const bridgeApi = isConfiguredHttpUrl(EVM_CONFIG.bridgeApiBaseUrl);
  const usdc = isAddress(EVM_CONFIG.usdcAddress);
  const wunit = isAddress(EVM_CONFIG.wunitAddress);
  const stablePool = isAddress(EVM_CONFIG.stablePoolAddress);
  const bridgeRouter = isAddress(EVM_CONFIG.bridgeRouterAddress);
  const poolContracts = sepoliaRpc && usdc && wunit && stablePool;

  return {
    sepoliaRpc,
    bridgeApi,
    usdc,
    wunit,
    stablePool,
    bridgeRouter,
    poolContracts,
    bridgeContracts: poolContracts && bridgeApi && bridgeRouter,
  };
}

function getUnitUsdcPoolContracts(): UnitUsdcPoolDashboard['contracts'] {
  return {
    usdcAddress: EVM_CONFIG.usdcAddress,
    wunitAddress: EVM_CONFIG.wunitAddress,
    stablePoolAddress: EVM_CONFIG.stablePoolAddress,
    bridgeRouterAddress: EVM_CONFIG.bridgeRouterAddress,
  };
}

function formatDashboardNumber(value: number, decimals = 6): string {
  if (!Number.isFinite(value)) return '0';
  const trimmed = value.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed || '0';
}

function calculateQuoteImpactBps(amountInUnits: bigint, amountOutUnits: bigint): number {
  if (amountInUnits <= 0n) return 0;
  return Number(((amountInUnits - amountOutUnits) * 10_000n) / amountInUnits);
}

function calculateImbalanceBps(reserveWunit: bigint, reserveUsdc: bigint): number {
  const total = reserveWunit + reserveUsdc;
  if (total <= 0n) return 0;
  return Number(((reserveUsdc - reserveWunit) * 10_000n) / total);
}

function calculateImpliedUnitPriceUsdc(reserveWunit: bigint, reserveUsdc: bigint): string | null {
  if (reserveWunit <= 0n) return null;
  const wunit = Number(formatUnits(reserveWunit, EVM_DECIMALS));
  const usdc = Number(formatUnits(reserveUsdc, EVM_DECIMALS));
  return formatDashboardNumber(usdc / wunit, 6);
}

export async function getEvmBalances(accountIndex: number): Promise<EvmBalances> {
  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const usdc = EVM_CONFIG.usdcAddress
      ? new Contract(EVM_CONFIG.usdcAddress, ERC20_ABI, provider)
      : null;
    const wunit = EVM_CONFIG.wunitAddress
      ? new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, provider)
      : null;
    const [ethBalance, usdcBalance, wunitBalance] = await Promise.all([
      provider.getBalance(wallet.address),
      usdc ? usdc.balanceOf(wallet.address) as Promise<bigint> : Promise.resolve(0n),
      wunit ? wunit.balanceOf(wallet.address) as Promise<bigint> : Promise.resolve(0n),
    ]);

    return {
      address: wallet.address,
      eth: formatEther(ethBalance),
      usdc: formatUnits(usdcBalance, EVM_DECIMALS),
      wunit: formatUnits(wunitBalance, EVM_DECIMALS),
    };
  });
}

export async function quoteSwap(
  tokenIn: SepoliaAsset,
  amountIn: string,
): Promise<SwapQuote> {
  assertBridgeContractsConfigured();

  const amountInUnits = parsePositiveAmountUnits(amountIn, EVM_DECIMALS, tokenIn);
  const { index, opposite } = getTokenConfig(tokenIn);
  const provider = getSepoliaProvider();
  const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, provider);
  const rawAmountOut = (await pool.quoteSwap(index, amountInUnits)) as bigint;
  const minimumAmountOut =
    (rawAmountOut * BigInt(10_000 - EVM_CONFIG.swapSlippageBps)) / 10_000n;

  return {
    tokenIn,
    tokenOut: opposite,
    amountIn,
    amountOut: formatUnits(rawAmountOut, EVM_DECIMALS),
    minimumAmountOut: formatUnits(minimumAmountOut, EVM_DECIMALS),
    feeBps: 4,
    route: 'stable_pool',
  };
}

export async function quoteUnitUsdcSwap(
  tokenIn: CrossChainSwapAsset,
  amountIn: string,
): Promise<CrossChainSwapQuote> {
  const poolQuote = await quoteSwap(tokenIn === 'UNIT' ? 'wUNIT' : 'USDC', amountIn);

  return {
    tokenIn,
    tokenOut: tokenIn === 'UNIT' ? 'USDC' : 'UNIT',
    amountIn,
    amountOut: poolQuote.amountOut,
    minimumAmountOut: poolQuote.minimumAmountOut,
    intermediaryAsset: 'wUNIT',
    route: tokenIn === 'UNIT' ? 'bridge_stable_pool' : 'stable_pool_redemption',
  };
}

export async function getCrossChainSwapLimit(): Promise<CrossChainSwapLimit> {
  assertBridgeContractsConfigured();

  const provider = getSepoliaProvider();
  const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, provider);
  const balances = (await pool.getBalances()) as bigint[];
  const reserveWunit = balances[0];
  const reserveUsdc = balances[1];
  const conservativeMaxInput = reserveWunit < reserveUsdc ? reserveWunit : reserveUsdc;

  return {
    maxInputAmount: formatUnits(conservativeMaxInput, EVM_DECIMALS),
    reserveWunit: formatUnits(reserveWunit, EVM_DECIMALS),
    reserveUsdc: formatUnits(reserveUsdc, EVM_DECIMALS),
  };
}

export async function getUnitUsdcPoolDashboard(
  accountIndex?: number,
): Promise<UnitUsdcPoolDashboard> {
  const readiness = getUnitUsdcPoolReadiness();
  const contracts = getUnitUsdcPoolContracts();
  const checkedAt = Date.now();

  if (!readiness.poolContracts) {
    return {
      checkedAt,
      status: 'unconfigured',
      readiness,
      contracts,
      reserves: null,
      impliedUnitPriceUsdc: null,
      imbalanceBps: null,
      maxInputAmount: null,
      quoteSamples: [],
      wallet: null,
      error: 'Sepolia RPC, USDC, wUNIT, and stable pool contracts must be configured to read the UNIT/USDC pool.',
    };
  }

  try {
    const provider = getSepoliaProvider();
    const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, provider);
    const sampleAmounts = ['1', '10', '100'];
    const balances = (await pool.getBalances()) as bigint[];
    const reserveWunit = balances[0] ?? 0n;
    const reserveUsdc = balances[1] ?? 0n;

    const quoteSamples = await Promise.all(sampleAmounts.map(async (amountIn) => {
      const amountInUnits = parseUnits(amountIn, EVM_DECIMALS);
      const [unitToUsdcOut, usdcToUnitOut] = await Promise.all([
        pool.quoteSwap(0, amountInUnits) as Promise<bigint>,
        pool.quoteSwap(1, amountInUnits) as Promise<bigint>,
      ]);

      return {
        amountIn,
        unitToUsdcOut: formatUnits(unitToUsdcOut, EVM_DECIMALS),
        unitToUsdcImpactBps: calculateQuoteImpactBps(amountInUnits, unitToUsdcOut),
        usdcToUnitOut: formatUnits(usdcToUnitOut, EVM_DECIMALS),
        usdcToUnitImpactBps: calculateQuoteImpactBps(amountInUnits, usdcToUnitOut),
      };
    }));

    let wallet: UnitUsdcPoolWalletState | null = null;
    if (typeof accountIndex === 'number') {
      wallet = await withSepoliaSigner(accountIndex, async (signer, signerProvider) => {
        const usdc = new Contract(EVM_CONFIG.usdcAddress, ERC20_ABI, signer);
        const wunit = new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, signer);
        const sampleUnits = parseUnits(sampleAmounts[0], EVM_DECIMALS);
        const [
          ethBalance,
          usdcBalance,
          wunitBalance,
          stablePoolUsdcAllowance,
          stablePoolWunitAllowance,
          bridgeRouterWunitAllowance,
        ] = await Promise.all([
          signerProvider.getBalance(signer.address) as Promise<bigint>,
          usdc.balanceOf(signer.address) as Promise<bigint>,
          wunit.balanceOf(signer.address) as Promise<bigint>,
          usdc.allowance(signer.address, EVM_CONFIG.stablePoolAddress) as Promise<bigint>,
          wunit.allowance(signer.address, EVM_CONFIG.stablePoolAddress) as Promise<bigint>,
          EVM_CONFIG.bridgeRouterAddress
            ? wunit.allowance(signer.address, EVM_CONFIG.bridgeRouterAddress) as Promise<bigint>
            : Promise.resolve(0n),
        ]);

        return {
          address: signer.address,
          eth: formatEther(ethBalance),
          usdc: formatUnits(usdcBalance, EVM_DECIMALS),
          wunit: formatUnits(wunitBalance, EVM_DECIMALS),
          stablePoolUsdcAllowance: formatUnits(stablePoolUsdcAllowance, EVM_DECIMALS),
          stablePoolWunitAllowance: formatUnits(stablePoolWunitAllowance, EVM_DECIMALS),
          bridgeRouterWunitAllowance: formatUnits(bridgeRouterWunitAllowance, EVM_DECIMALS),
          canSwapUsdcSample: usdcBalance >= sampleUnits && stablePoolUsdcAllowance >= sampleUnits,
          canSwapUnitSample: wunitBalance >= sampleUnits && stablePoolWunitAllowance >= sampleUnits,
          canRedeemUnitSample: wunitBalance >= sampleUnits && bridgeRouterWunitAllowance >= sampleUnits,
        };
      });
    }

    return {
      checkedAt,
      status: readiness.bridgeContracts ? 'ready' : 'degraded',
      readiness,
      contracts,
      reserves: {
        wunit: formatUnits(reserveWunit, EVM_DECIMALS),
        usdc: formatUnits(reserveUsdc, EVM_DECIMALS),
      },
      impliedUnitPriceUsdc: calculateImpliedUnitPriceUsdc(reserveWunit, reserveUsdc),
      imbalanceBps: calculateImbalanceBps(reserveWunit, reserveUsdc),
      maxInputAmount: formatUnits(reserveWunit < reserveUsdc ? reserveWunit : reserveUsdc, EVM_DECIMALS),
      quoteSamples,
      wallet,
      error: readiness.bridgeContracts ? null : 'Pool is readable, but full bridge/redemption config is incomplete.',
    };
  } catch (error: unknown) {
    logger.warn('[SepoliaBridge] Failed to load UNIT/USDC pool dashboard', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      checkedAt,
      status: 'error',
      readiness,
      contracts,
      reserves: null,
      impliedUnitPriceUsdc: null,
      imbalanceBps: null,
      maxInputAmount: null,
      quoteSamples: [],
      wallet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeSwap(
  accountIndex: number,
  tokenIn: SepoliaAsset,
  amountIn: string,
  expectedMinimumAmountOut?: string,
): Promise<SwapExecutionResult> {
  assertBridgeContractsConfigured();

  const amountInUnits = parsePositiveAmountUnits(amountIn, EVM_DECIMALS, tokenIn);
  const quoted = await quoteSwap(tokenIn, amountIn);
  const { index, opposite } = getTokenConfig(tokenIn);
  const quotedAmountOutUnits = parseUnits(quoted.amountOut, EVM_DECIMALS);
  const quotedMinimumAmountOutUnits = parseUnits(quoted.minimumAmountOut, EVM_DECIMALS);
  const expectedMinimumAmountOutUnits = expectedMinimumAmountOut
    ? parsePositiveAmountUnits(expectedMinimumAmountOut, EVM_DECIMALS, opposite)
    : 0n;
  if (expectedMinimumAmountOutUnits > 0n && quotedAmountOutUnits < expectedMinimumAmountOutUnits) {
    throw new Error(
      `Swap quote changed. Expected at least ${formatUnits(expectedMinimumAmountOutUnits, EVM_DECIMALS)} ${opposite}, current quote returns ${quoted.amountOut} ${opposite}. Refresh the quote and try again.`,
    );
  }
  const minimumAmountOutUnits =
    expectedMinimumAmountOutUnits > quotedMinimumAmountOutUnits
      ? expectedMinimumAmountOutUnits
      : quotedMinimumAmountOutUnits;
  logger.debug('[SepoliaBridge] Starting swap', {
    accountIndex,
    tokenIn,
    amountIn,
    quotedAmountOut: quoted.amountOut,
    minimumAmountOut: quoted.minimumAmountOut,
  });

  await withSepoliaSigner(accountIndex, async (wallet) => {
    const tokenInContract = new Contract(getTokenConfig(tokenIn).address, ERC20_ABI, wallet);
    const tokenInBalance = (await tokenInContract.balanceOf(wallet.address)) as bigint;
    if (tokenInBalance < amountInUnits) {
      throw new Error(
        `Not enough ${tokenIn}. Need ${formatTransferAmount(amountInUnits, tokenIn)}, available ${formatTransferAmount(tokenInBalance, tokenIn)}.`,
      );
    }
  });

  const approvalTxHash = await ensureAllowance(
    accountIndex,
    tokenIn,
    EVM_CONFIG.stablePoolAddress,
    amountInUnits,
  );

  return withSepoliaSigner(accountIndex, async (wallet) => {
    const tokenOut = new Contract(getTokenConfig(opposite).address, ERC20_ABI, wallet);
    const beforeBalance = (await tokenOut.balanceOf(wallet.address)) as bigint;
    const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, wallet);
    const swapTx = await pool.swap(index, amountInUnits, minimumAmountOutUnits, wallet.address);
    recordSubmittedEvmTx({
      accountIndex,
      kind: 'swap',
      txHash: swapTx.hash,
      asset: null,
      amount: amountIn,
      spender: EVM_CONFIG.stablePoolAddress,
      recipient: wallet.address,
      tokenIn,
      tokenOut: opposite,
      releaseId: null,
      destinationTaprootAddress: null,
    });
    let receipt: { hash?: string } | null;
    try {
      receipt = await swapTx.wait(EVM_CONFIG.confirmations);
      markConfirmedEvmTx(swapTx.hash, receipt?.hash || swapTx.hash);
    } catch (error) {
      markFailedEvmTx(swapTx.hash, error);
      throw error;
    }
    const afterBalance = (await tokenOut.balanceOf(wallet.address)) as bigint;
    logger.debug('[SepoliaBridge] Swap confirmed', {
      accountIndex,
      wallet: wallet.address,
      tokenIn,
      tokenOut: opposite,
      approvalTxHash,
      swapTxHash: receipt?.hash || swapTx.hash,
      amountIn,
      amountOut: formatUnits(afterBalance - beforeBalance, EVM_DECIMALS),
    });

    return {
      approvalTxHash,
      swapTxHash: receipt?.hash || swapTx.hash,
      amountIn,
      amountOut: formatUnits(afterBalance - beforeBalance, EVM_DECIMALS),
      tokenIn,
      tokenOut: opposite,
    };
  });
}

export async function estimateUsdcToUnitSwapExecution(
  accountIndex: number,
  amountIn: string,
  destinationTaprootAddress: string,
): Promise<CrossChainSwapExecutionEstimate> {
  assertBridgeContractsConfigured();

  const normalizedDestination = assertMutinynetTaprootDestination(destinationTaprootAddress);
  const amountInUnits = parsePositiveAmountUnits(amountIn, EVM_DECIMALS, 'USDC');
  const quoted = await quoteSwap('USDC', amountIn);
  const minimumAmountOutUnits = parseUnits(quoted.minimumAmountOut, EVM_DECIMALS);
  const redemptionAmountUnits = parseUnits(quoted.amountOut, EVM_DECIMALS);

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const usdc = new Contract(EVM_CONFIG.usdcAddress, ERC20_ABI, wallet);
    const wunit = new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, wallet);
    const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, wallet);
    const router = new Contract(EVM_CONFIG.bridgeRouterAddress, ROUTER_ABI, wallet);
    const [usdcAllowance, wunitAllowance, usdcBalance, wunitBalance, ethBalance, feeData] = await Promise.all([
      usdc.allowance(wallet.address, EVM_CONFIG.stablePoolAddress) as Promise<bigint>,
      wunit.allowance(wallet.address, EVM_CONFIG.bridgeRouterAddress) as Promise<bigint>,
      usdc.balanceOf(wallet.address) as Promise<bigint>,
      wunit.balanceOf(wallet.address) as Promise<bigint>,
      provider.getBalance(wallet.address),
      provider.getFeeData(),
    ]);

    const requiresUsdcApproval = usdcAllowance < amountInUnits;
    const requiresWunitApproval = wunitAllowance < redemptionAmountUnits;
    const hasEnoughUsdcForDirectEstimate = usdcBalance >= amountInUnits;
    const hasEnoughWunitForDirectEstimate = wunitBalance >= redemptionAmountUnits;

    const gasSegments: bigint[] = [];

    if (requiresUsdcApproval) {
      gasSegments.push(
        await estimateGasOrFallback(
          () => usdc.approve.estimateGas(EVM_CONFIG.stablePoolAddress, MaxUint256) as Promise<bigint>,
          FALLBACK_USDC_APPROVAL_GAS,
        ),
      );
    }

    gasSegments.push(
      hasEnoughUsdcForDirectEstimate
        ? await estimateGasOrFallback(
            () => pool.swap.estimateGas(1, amountInUnits, minimumAmountOutUnits, wallet.address) as Promise<bigint>,
            FALLBACK_SWAP_GAS,
          )
        : FALLBACK_SWAP_GAS,
    );

    if (requiresWunitApproval) {
      gasSegments.push(
        await estimateGasOrFallback(
          () => wunit.approve.estimateGas(EVM_CONFIG.bridgeRouterAddress, MaxUint256) as Promise<bigint>,
          FALLBACK_WUNIT_APPROVAL_GAS,
        ),
      );
    }

    gasSegments.push(
      !requiresWunitApproval && hasEnoughWunitForDirectEstimate
        ? await estimateGasOrFallback(
            () =>
              router.requestRedemption.estimateGas(
                id(`${wallet.address}:${normalizedDestination}:estimate`),
                redemptionAmountUnits,
                normalizedDestination,
              ) as Promise<bigint>,
            FALLBACK_REDEMPTION_GAS,
          )
        : FALLBACK_REDEMPTION_GAS,
    );

    const totalGasUnits = gasSegments.reduce((sum, value) => sum + value, 0n);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeWei = totalGasUnits * feePerGas;
    const hasEnoughUsdc = usdcBalance >= amountInUnits;
    const hasEnoughEth = ethBalance >= totalFeeWei;
    const blockingReasons = buildBlockingReasons([
      {
        passed: hasEnoughUsdc,
        message: `Not enough USDC. Need ${formatUnits(amountInUnits, EVM_DECIMALS)}, available ${formatUnits(usdcBalance, EVM_DECIMALS)}.`,
      },
      {
        passed: hasEnoughEth,
        message: `Not enough Sepolia ETH for approvals, swap, and redemption gas. Need ${formatEther(totalFeeWei)} ETH, available ${formatEther(ethBalance)} ETH.`,
      },
    ]);

    return {
      totalGasUnits: totalGasUnits.toString(),
      totalFeeEth: formatEther(totalFeeWei),
      gasPriceGwei: formatUnits(feePerGas, 'gwei'),
      feePaymentAsset: 'ETH',
      requiresUsdcApproval,
      requiresWunitApproval,
      walletAddress: wallet.address,
      ethBalance: formatEther(ethBalance),
      requiredEth: formatEther(totalFeeWei),
      usdcBalance: formatUnits(usdcBalance, EVM_DECIMALS),
      wunitBalance: formatUnits(wunitBalance, EVM_DECIMALS),
      requiredUsdcAmount: formatUnits(amountInUnits, EVM_DECIMALS),
      expectedWunitAmount: formatUnits(redemptionAmountUnits, EVM_DECIMALS),
      hasEnoughUsdc,
      hasEnoughEth,
      canExecute: blockingReasons.length === 0,
      blockingReasons,
    };
  });
}

export async function quoteUsdcForExactWunit(amountOut: string): Promise<string> {
  assertBridgeContractsConfigured();

  const targetOutUnits = parsePositiveAmountUnits(amountOut, EVM_DECIMALS, 'wUNIT');
  let low = targetOutUnits;
  let high = targetOutUnits;

  while (true) {
    const quoted = parseUnits((await quoteSwap('USDC', formatUnits(high, EVM_DECIMALS))).amountOut, EVM_DECIMALS);
    if (quoted >= targetOutUnits) {
      break;
    }

    high *= 2n;
    if (high > parseUnits('1000000', EVM_DECIMALS)) {
      throw new Error('Unable to find a swap quote large enough to acquire the requested wUNIT');
    }
  }

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (low + high) / 2n;
    const quoted = parseUnits((await quoteSwap('USDC', formatUnits(mid, EVM_DECIMALS))).amountOut, EVM_DECIMALS);
    if (quoted >= targetOutUnits) {
      high = mid;
    } else {
      low = mid + 1n;
    }
  }

  return formatUnits(high, EVM_DECIMALS);
}

export async function requestRedemption(
  accountIndex: number,
  amount: string,
  destinationTaprootAddress: string,
  sourceAsset: SepoliaAsset = 'wUNIT',
  maxSourceAmount?: string,
): Promise<RedemptionExecutionResult> {
  assertBridgeContractsConfigured();

  const normalizedDestination = assertMutinynetTaprootDestination(destinationTaprootAddress);
  const redemptionAmountUnits = parsePositiveAmountUnits(amount, EVM_DECIMALS, 'wUNIT');
  let preparationSwap: SwapExecutionResult | undefined;
  let redeemAmountUnits = redemptionAmountUnits;
  let latestBalances: EvmBalances | undefined;
  const initialPreflight = await estimateRedemptionExecution(
    accountIndex,
    amount,
    normalizedDestination,
    sourceAsset,
  );
  assertCanExecutePreflight(
    initialPreflight.canExecute,
    initialPreflight.blockingReasons,
    'Redemption preflight failed. Refresh balances and try again.',
  );
  logger.debug('[SepoliaBridge] Starting redemption request', {
    accountIndex,
    amount,
    destinationTaprootAddress: normalizedDestination,
    sourceAsset,
    maxSourceAmount,
  });

  if (sourceAsset === 'USDC') {
    const usdcAmount = await quoteUsdcForExactWunit(amount);
    logger.debug('[SepoliaBridge] Quoted USDC for redemption', {
      accountIndex,
      requestedWunitAmount: amount,
      quotedUsdcAmount: usdcAmount,
      maxSourceAmount,
    });
    if (maxSourceAmount) {
      const maxSourceAmountUnits = parsePositiveAmountUnits(maxSourceAmount, EVM_DECIMALS, 'USDC');
      const quotedUsdcAmountUnits = parsePositiveAmountUnits(usdcAmount, EVM_DECIMALS, 'USDC');
      if (quotedUsdcAmountUnits > maxSourceAmountUnits) {
        throw new Error(
          `This redemption now needs ${usdcAmount} USDC, which exceeds your entered amount of ${maxSourceAmount} USDC. Refresh the quote or reduce the size.`,
        );
      }
    }
    preparationSwap = await executeSwap(accountIndex, 'USDC', usdcAmount);
    const postSwapBalances = await getEvmBalances(accountIndex);
    latestBalances = postSwapBalances;
    const postSwapWunitUnits = parseUnits(postSwapBalances.wunit, EVM_DECIMALS);
    logger.debug('[SepoliaBridge] Post-swap balances before redemption', {
      accountIndex,
      usdc: postSwapBalances.usdc,
      wunit: postSwapBalances.wunit,
      eth: postSwapBalances.eth,
      requiredWunit: amount,
    });
    if (postSwapWunitUnits < redemptionAmountUnits) {
      throw new Error('USDC to wUNIT swap did not return enough wUNIT for redemption');
    }
    redeemAmountUnits = redemptionAmountUnits;
  }

  latestBalances = latestBalances || await getEvmBalances(accountIndex);
  const availableWunitUnits = parseUnits(latestBalances.wunit, EVM_DECIMALS);
  if (availableWunitUnits < redeemAmountUnits) {
    throw new Error(
      `Not enough wUNIT. Need ${formatUnits(redeemAmountUnits, EVM_DECIMALS)}, available ${latestBalances.wunit}.`,
    );
  }

  const burnEstimate = sourceAsset === 'wUNIT'
    ? initialPreflight
    : await estimateRedemptionExecution(
        accountIndex,
        formatUnits(redeemAmountUnits, EVM_DECIMALS),
        normalizedDestination,
        'wUNIT',
      );
  const availableEthWei = parseUnits(latestBalances.eth, 18);
  const requiredFeeWei = parseUnits(burnEstimate.totalFeeEth, 18);
  if (availableEthWei < requiredFeeWei) {
    throw new Error(
      `Not enough Sepolia ETH for redemption gas. Need ${burnEstimate.totalFeeEth} ETH, available ${latestBalances.eth} ETH.`,
    );
  }

  const approvalTxHash = await ensureAllowance(
    accountIndex,
    'wUNIT',
    EVM_CONFIG.bridgeRouterAddress,
    redeemAmountUnits,
  );

  return withSepoliaSigner(accountIndex, async (wallet) => {
    const router = new Contract(EVM_CONFIG.bridgeRouterAddress, ROUTER_ABI, wallet);
    const releaseId = id(`${wallet.address}:${normalizedDestination}:${Date.now()}`);
    logger.debug('[SepoliaBridge] Broadcasting redemption', {
      accountIndex,
      wallet: wallet.address,
      releaseId,
      redeemAmount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      destinationTaprootAddress: normalizedDestination,
      approvalTxHash,
    });
    const requestTx = await router.requestRedemption(
      releaseId,
      redeemAmountUnits,
      normalizedDestination,
    );
    recordSubmittedEvmTx({
      accountIndex,
      kind: 'redemption',
      txHash: requestTx.hash,
      asset: 'wUNIT',
      amount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      spender: EVM_CONFIG.bridgeRouterAddress,
      recipient: null,
      tokenIn: 'wUNIT',
      tokenOut: 'UNIT',
      releaseId,
      destinationTaprootAddress: normalizedDestination,
    });
    let receipt: { hash?: string } | null;
    try {
      receipt = await requestTx.wait(EVM_CONFIG.confirmations);
      markConfirmedEvmTx(requestTx.hash, receipt?.hash || requestTx.hash);
    } catch (error) {
      markFailedEvmTx(requestTx.hash, error);
      throw error;
    }
    logger.debug('[SepoliaBridge] Redemption confirmed', {
      accountIndex,
      wallet: wallet.address,
      releaseId,
      burnTxHash: receipt?.hash || requestTx.hash,
    });

    const payload: TrackRedemptionRequest = {
      id: releaseId,
      requester: wallet.address,
      destinationTaprootAddress: normalizedDestination,
      amount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      sourceAsset,
      burnTxHash: receipt?.hash || requestTx.hash,
    };

    let trackRedemptionError: string | undefined;
    try {
      await trackRedemption(payload);
    } catch (error) {
      trackRedemptionError = getErrorMessage(error);
      logger.warn('[SepoliaBridge] Redemption burn confirmed but bridge API tracking failed', {
        accountIndex,
        wallet: wallet.address,
        releaseId,
        burnTxHash: payload.burnTxHash,
        error: trackRedemptionError,
      });
    }

    return {
      releaseId,
      burnTxHash: receipt?.hash || requestTx.hash,
      redeemedAmount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      sourceAsset,
      preparationSwap: preparationSwap
        ? { ...preparationSwap, approvalTxHash: preparationSwap.approvalTxHash || approvalTxHash }
        : undefined,
      trackRedemptionError,
    };
  });
}

export async function executeUsdcToUnitSwap(
  accountIndex: number,
  amountIn: string,
  destinationTaprootAddress: string,
  expectedMinimumWunitOut?: string,
): Promise<RedemptionExecutionResult> {
  const normalizedDestination = assertMutinynetTaprootDestination(destinationTaprootAddress);
  const preflight = await estimateUsdcToUnitSwapExecution(accountIndex, amountIn, normalizedDestination);
  assertCanExecutePreflight(
    preflight.canExecute,
    preflight.blockingReasons,
    'USDC to UNIT swap preflight failed. Refresh balances and try again.',
  );
  const preparationSwap = await executeSwap(accountIndex, 'USDC', amountIn, expectedMinimumWunitOut);
  const redemption = await requestRedemption(
    accountIndex,
    preparationSwap.amountOut,
    normalizedDestination,
    'wUNIT',
  );

  return {
    ...redemption,
    redeemedAmount: preparationSwap.amountOut,
    preparationSwap,
  };
}

export async function estimateRedemptionExecution(
  accountIndex: number,
  amount: string,
  destinationTaprootAddress: string,
  sourceAsset: SepoliaAsset = 'wUNIT',
): Promise<RedemptionExecutionEstimate> {
  assertBridgeContractsConfigured();

  const normalizedDestination = assertMutinynetTaprootDestination(destinationTaprootAddress);
  if (sourceAsset === 'USDC') {
    const requiredUsdcIn = await quoteUsdcForExactWunit(amount);
    const estimate = await estimateUsdcToUnitSwapExecution(
      accountIndex,
      requiredUsdcIn,
      normalizedDestination,
    );

    return {
      ...estimate,
      sourceAsset,
      requiredSourceAmount: requiredUsdcIn,
      sourceBalance: estimate.usdcBalance,
      hasEnoughSource: estimate.hasEnoughUsdc,
    };
  }

  const redemptionAmountUnits = parsePositiveAmountUnits(amount, EVM_DECIMALS, 'wUNIT');

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const wunit = new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, wallet);
    const router = new Contract(EVM_CONFIG.bridgeRouterAddress, ROUTER_ABI, wallet);
    const [wunitAllowance, wunitBalance, ethBalance, feeData] = await Promise.all([
      wunit.allowance(wallet.address, EVM_CONFIG.bridgeRouterAddress) as Promise<bigint>,
      wunit.balanceOf(wallet.address) as Promise<bigint>,
      provider.getBalance(wallet.address),
      provider.getFeeData(),
    ]);

    const requiresWunitApproval = wunitAllowance < redemptionAmountUnits;
    const gasSegments: bigint[] = [];

    if (requiresWunitApproval) {
      gasSegments.push(
        await estimateGasOrFallback(
          () => wunit.approve.estimateGas(EVM_CONFIG.bridgeRouterAddress, MaxUint256) as Promise<bigint>,
          FALLBACK_WUNIT_APPROVAL_GAS,
        ),
      );
    }

    gasSegments.push(
      !requiresWunitApproval && wunitBalance >= redemptionAmountUnits
        ? await estimateGasOrFallback(
            () =>
              router.requestRedemption.estimateGas(
                id(`${wallet.address}:${normalizedDestination}:estimate`),
                redemptionAmountUnits,
                normalizedDestination,
              ) as Promise<bigint>,
            FALLBACK_REDEMPTION_GAS,
          )
        : FALLBACK_REDEMPTION_GAS,
    );

    const totalGasUnits = gasSegments.reduce((sum, value) => sum + value, 0n);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeWei = totalGasUnits * feePerGas;
    const hasEnoughSource = wunitBalance >= redemptionAmountUnits;
    const hasEnoughEth = ethBalance >= totalFeeWei;
    const blockingReasons = buildBlockingReasons([
      {
        passed: hasEnoughSource,
        message: `Not enough wUNIT. Need ${formatUnits(redemptionAmountUnits, EVM_DECIMALS)}, available ${formatUnits(wunitBalance, EVM_DECIMALS)}.`,
      },
      {
        passed: hasEnoughEth,
        message: `Not enough Sepolia ETH for approval and redemption gas. Need ${formatEther(totalFeeWei)} ETH, available ${formatEther(ethBalance)} ETH.`,
      },
    ]);

    return {
      totalGasUnits: totalGasUnits.toString(),
      totalFeeEth: formatEther(totalFeeWei),
      gasPriceGwei: formatUnits(feePerGas, 'gwei'),
      feePaymentAsset: 'ETH',
      requiresUsdcApproval: false,
      requiresWunitApproval,
      walletAddress: wallet.address,
      ethBalance: formatEther(ethBalance),
      requiredEth: formatEther(totalFeeWei),
      usdcBalance: '0',
      wunitBalance: formatUnits(wunitBalance, EVM_DECIMALS),
      requiredUsdcAmount: '0',
      expectedWunitAmount: formatUnits(redemptionAmountUnits, EVM_DECIMALS),
      hasEnoughUsdc: true,
      hasEnoughEth,
      canExecute: blockingReasons.length === 0,
      blockingReasons,
      sourceAsset,
      requiredSourceAmount: amount,
      sourceBalance: formatUnits(wunitBalance, EVM_DECIMALS),
      hasEnoughSource,
    };
  });
}

export async function estimateSepoliaTokenTransfer(
  accountIndex: number,
  token: SepoliaTransferAsset,
  recipient: string,
  amount: string,
): Promise<SepoliaTokenTransferEstimate> {
  if (!isAddress(recipient)) {
    throw new Error('Enter a valid Ethereum address');
  }

  const amountUnits = parsePositiveAmountUnits(amount, getTransferDecimals(token), token);

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const tokenContract = token === 'ETH'
      ? null
      : new Contract(getTokenConfig(token).address, ERC20_ABI, wallet);
    const [gasEstimate, feeData, ethBalance, tokenBalance] = await Promise.all([
      token === 'ETH'
        ? estimateGasOrFallback(
            () => wallet.estimateGas({ to: recipient, value: amountUnits }),
            FALLBACK_ETH_TRANSFER_GAS,
          )
        : estimateGasOrFallback(
            () => tokenContract!.transfer.estimateGas(recipient, amountUnits) as Promise<bigint>,
            FALLBACK_ERC20_TRANSFER_GAS,
          ),
      provider.getFeeData(),
      provider.getBalance(wallet.address),
      token === 'ETH'
        ? Promise.resolve(amountUnits)
        : tokenContract!.balanceOf(wallet.address) as Promise<bigint>,
    ]);

    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeWei = gasEstimate * feePerGas;
    const requiredEthWei = token === 'ETH' ? amountUnits + totalFeeWei : totalFeeWei;
    const hasEnoughAsset = token === 'ETH' ? ethBalance >= amountUnits : tokenBalance >= amountUnits;
    const hasEnoughEth = ethBalance >= requiredEthWei;
    const blockingReasons = token === 'ETH'
      ? buildBlockingReasons([
          {
            passed: hasEnoughEth,
            message: `Not enough Sepolia ETH. Need ${formatEther(requiredEthWei)} ETH including gas, available ${formatEther(ethBalance)} ETH.`,
          },
        ])
      : buildBlockingReasons([
          {
            passed: hasEnoughAsset,
            message: `Not enough ${token}. Need ${formatTransferAmount(amountUnits, token)}, available ${formatTransferAmount(tokenBalance, token)}.`,
          },
          {
            passed: hasEnoughEth,
            message: `Not enough Sepolia ETH for gas. Need ${formatEther(totalFeeWei)} ETH, available ${formatEther(ethBalance)} ETH.`,
          },
        ]);

    return {
      gasUnits: gasEstimate.toString(),
      totalFeeEth: formatEther(totalFeeWei),
      gasPriceGwei: formatUnits(feePerGas, 'gwei'),
      walletAddress: wallet.address,
      assetBalance: token === 'ETH' ? formatEther(ethBalance) : formatTransferAmount(tokenBalance, token),
      ethBalance: formatEther(ethBalance),
      requiredAssetAmount: formatTransferAmount(amountUnits, token),
      requiredEth: formatEther(requiredEthWei),
      hasEnoughAsset,
      hasEnoughEth,
      canExecute: blockingReasons.length === 0,
      blockingReasons,
    };
  });
}

export async function sendSepoliaToken(
  accountIndex: number,
  token: SepoliaTransferAsset,
  recipient: string,
  amount: string,
): Promise<SepoliaTokenTransferResult> {
  if (!isAddress(recipient)) {
    throw new Error('Enter a valid Ethereum address');
  }

  const amountUnits = parsePositiveAmountUnits(amount, getTransferDecimals(token), token);

  if (token === 'ETH') {
    return withSepoliaSigner(accountIndex, async (wallet, provider) => {
      const [gasEstimate, feeData, ethBalance] = await Promise.all([
        estimateGasOrFallback(
          () => wallet.estimateGas({ to: recipient, value: amountUnits }),
          FALLBACK_ETH_TRANSFER_GAS,
        ),
        provider.getFeeData(),
        provider.getBalance(wallet.address),
      ]);
      const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const estimatedFeeWei = gasEstimate * feePerGas;
      const requiredWei = amountUnits + estimatedFeeWei;

      if (ethBalance < requiredWei) {
        throw new Error(
          `Not enough Sepolia ETH. Need ${formatEther(requiredWei)} ETH including estimated gas, available ${formatEther(ethBalance)} ETH.`,
        );
      }

      const transferTx = await wallet.sendTransaction({ to: recipient, value: amountUnits });
      recordSubmittedEvmTx({
        accountIndex,
        kind: 'transfer',
        txHash: transferTx.hash,
        asset: 'ETH',
        amount: formatTransferAmount(amountUnits, token),
        spender: null,
        recipient,
        tokenIn: 'ETH',
        tokenOut: null,
        releaseId: null,
        destinationTaprootAddress: null,
      });

      return {
        txHash: transferTx.hash,
        amount: formatTransferAmount(amountUnits, token),
        token,
        recipient,
      };
    });
  }

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const tokenContract = new Contract(getTokenConfig(token).address, ERC20_ABI, wallet);
    const [tokenBalance, gasEstimate, feeData, ethBalance] = await Promise.all([
      tokenContract.balanceOf(wallet.address) as Promise<bigint>,
      estimateGasOrFallback(
        () => tokenContract.transfer.estimateGas(recipient, amountUnits) as Promise<bigint>,
        FALLBACK_ERC20_TRANSFER_GAS,
      ),
      provider.getFeeData(),
      provider.getBalance(wallet.address),
    ]);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const estimatedFeeWei = gasEstimate * feePerGas;

    if (tokenBalance < amountUnits) {
      throw new Error(
        `Not enough ${token}. Need ${formatTransferAmount(amountUnits, token)}, available ${formatTransferAmount(tokenBalance, token)}.`,
      );
    }

    if (ethBalance < estimatedFeeWei) {
      throw new Error(
        `Not enough Sepolia ETH for gas. Need ${formatEther(estimatedFeeWei)} ETH, available ${formatEther(ethBalance)} ETH.`,
      );
    }

    const transferTx = await tokenContract.transfer(recipient, amountUnits);
    recordSubmittedEvmTx({
      accountIndex,
      kind: 'transfer',
      txHash: transferTx.hash,
      asset: token,
      amount: formatTransferAmount(amountUnits, token),
      spender: null,
      recipient,
      tokenIn: token,
      tokenOut: null,
      releaseId: null,
      destinationTaprootAddress: null,
    });

    return {
      txHash: transferTx.hash,
      amount: formatTransferAmount(amountUnits, token),
      token,
      recipient,
    };
  });
}

export async function fetchSepoliaTokenHistory(
  accountIndex: number,
  token: SepoliaAsset,
): Promise<SepoliaAssetHistoryItem[]> {
  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const tokenContract = new Contract(getTokenConfig(token).address, ERC20_ABI, provider);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(latestBlock - HISTORY_BLOCK_LOOKBACK, 0);
    const walletAddress = wallet.address.toLowerCase();

    const [incomingEvents, outgoingEvents] = await Promise.all([
      queryTransferLogsInChunks(tokenContract, tokenContract.filters.Transfer(null, wallet.address), fromBlock, latestBlock),
      queryTransferLogsInChunks(tokenContract, tokenContract.filters.Transfer(wallet.address, null), fromBlock, latestBlock),
    ]) as [EventLog[], EventLog[]];

    const grouped = new Map<string, { sent: bigint; received: bigint; blockNumber: number }>();
    const seenEventKeys = new Set<string>();

    [...incomingEvents, ...outgoingEvents].forEach((event) => {
      const from = String(event.args?.[0] ?? '').toLowerCase();
      const to = String(event.args?.[1] ?? '').toLowerCase();
      const value = event.args?.[2];
      const amount = typeof value === 'bigint' ? value : BigInt(String(value ?? '0'));
      const eventKey = getTransferEventKey(event, from, to, amount);

      if (seenEventKeys.has(eventKey)) {
        return;
      }
      seenEventKeys.add(eventKey);

      const current = grouped.get(event.transactionHash) ?? {
        sent: 0n,
        received: 0n,
        blockNumber: event.blockNumber,
      };

      if (from === walletAddress) {
        current.sent += amount;
      }

      if (to === walletAddress) {
        current.received += amount;
      }

      current.blockNumber = Math.max(current.blockNumber, event.blockNumber);
      grouped.set(event.transactionHash, current);
    });

    const blockNumbers = [...new Set([...grouped.values()].map((entry) => entry.blockNumber))];
    const blockTimes = new Map<number, number>();

    await Promise.all(
      blockNumbers.map(async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        if (block?.timestamp) {
          blockTimes.set(blockNumber, block.timestamp);
        }
      }),
    );

    const displayAssetType: DisplayAssetType = token === 'USDC' ? 'USDC' : 'UNIT';

    return [...grouped.entries()]
      .map(([txid, entry]) => {
        const netAmount = entry.received - entry.sent;
        const isSelfTransfer = entry.sent > 0n && entry.sent === entry.received;
        const displayAmount = isSelfTransfer
          ? entry.sent
          : netAmount < 0n ? -netAmount : netAmount;
        const absoluteAmount = Number(formatUnits(displayAmount, EVM_DECIMALS));
        return {
          txid,
          status: {
            confirmed: true,
            block_time: blockTimes.get(entry.blockNumber),
          },
          txData: {
            amount: absoluteAmount,
            assetType: displayAssetType,
            isSent: isSelfTransfer || entry.sent > entry.received,
            isReceived: isSelfTransfer || entry.received > entry.sent,
          },
        };
      })
      .filter((item) => item.txData.amount > 0)
      .sort((left, right) => (right.status.block_time ?? 0) - (left.status.block_time ?? 0));
  });
}

export async function fetchSepoliaEthHistory(accountIndex: number): Promise<SepoliaAssetHistoryItem[]> {
  return withSepoliaSigner(accountIndex, async (wallet) => {
    const walletAddress = wallet.address.toLowerCase();
    const url = `${SEPOLIA_BLOCKSCOUT_API_BASE_URL}/addresses/${wallet.address}/transactions`;
    const payload = await getJSON<BlockscoutTransactionsResponse>(url, {
      description: 'Fetch Sepolia ETH transaction history',
      timeout: 8_000,
      dedupeKey: `sepolia-eth-history:${accountIndex}:${wallet.address}`,
      cacheKey: `sepolia-eth-history:${accountIndex}:${wallet.address}`,
      cacheTtlMs: 20_000,
      staleOnError: true,
      circuitKey: 'blockscout:sepolia-eth-history',
    });
    const items = Array.isArray(payload.items) ? payload.items : [];

    return items
      .map((item): SepoliaAssetHistoryItem | null => {
        const txid = typeof item.hash === 'string' ? item.hash : '';
        const valueWei = parseBlockscoutWei(item.value);
        const from = getBlockscoutAddressHash(item.from);
        const to = getBlockscoutAddressHash(item.to);
        const isSent = from === walletAddress;
        const isReceived = to === walletAddress;

        if (!txid || valueWei <= 0n || (!isSent && !isReceived)) {
          return null;
        }

        const failed = item.status === 'error' || item.result === 'error';
        const blockNumber = typeof item.block_number === 'number'
          ? item.block_number
          : typeof item.block === 'number' ? item.block : null;

        return {
          txid,
          status: {
            confirmed: !failed && blockNumber !== null,
            block_time: parseBlockscoutTimestamp(item.timestamp),
          },
          txData: {
            amount: Number(formatEther(valueWei)),
            assetType: 'ETH',
            isSent,
            isReceived,
          },
        };
      })
      .filter((item): item is SepoliaAssetHistoryItem => item !== null)
      .sort((left, right) => (right.status.block_time ?? 0) - (left.status.block_time ?? 0));
  });
}
