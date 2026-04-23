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
import type { DisplayAssetType } from '../types/assets';
import { logger } from '../utils/logger';

export type SepoliaAsset = 'USDC' | 'wUNIT';
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

export interface CrossChainSwapExecutionEstimate {
  totalGasUnits: string;
  totalFeeEth: string;
  gasPriceGwei: string;
  feePaymentAsset: 'ETH';
  requiresUsdcApproval: boolean;
  requiresWunitApproval: boolean;
}

export interface SepoliaTokenTransferEstimate {
  gasUnits: string;
  totalFeeEth: string;
  gasPriceGwei: string;
}

export interface SepoliaTokenTransferResult {
  txHash: string;
  amount: string;
  token: SepoliaAsset;
  recipient: string;
}

export interface SepoliaAssetHistoryItem {
  txid: string;
  status: {
    confirmed: boolean;
    block_time?: number;
  };
  txData: {
    amount: number;
    assetType: DisplayAssetType;
    isSent: boolean;
    isReceived: boolean;
  };
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

function assertBridgeContractsConfigured(): void {
  if (!EVM_CONFIG.wunitAddress || !EVM_CONFIG.bridgeRouterAddress || !EVM_CONFIG.stablePoolAddress) {
    throw new Error('Sepolia bridge contracts are not configured');
  }
}

function getTokenConfig(token: SepoliaAsset): { address: string; index: number; opposite: SepoliaAsset } {
  if (token === 'wUNIT') {
    return { address: EVM_CONFIG.wunitAddress, index: 0, opposite: 'USDC' };
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
    const receipt = await approval.wait(EVM_CONFIG.confirmations);
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

export async function getEvmBalances(accountIndex: number): Promise<EvmBalances> {
  assertBridgeContractsConfigured();

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const usdc = new Contract(EVM_CONFIG.usdcAddress, ERC20_ABI, provider);
    const wunit = new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, provider);
    const [ethBalance, usdcBalance, wunitBalance] = await Promise.all([
      provider.getBalance(wallet.address),
      usdc.balanceOf(wallet.address) as Promise<bigint>,
      wunit.balanceOf(wallet.address) as Promise<bigint>,
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

  const amountInUnits = parseUnits(amountIn, EVM_DECIMALS);
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

export async function executeSwap(
  accountIndex: number,
  tokenIn: SepoliaAsset,
  amountIn: string,
): Promise<SwapExecutionResult> {
  assertBridgeContractsConfigured();

  const amountInUnits = parseUnits(amountIn, EVM_DECIMALS);
  const quoted = await quoteSwap(tokenIn, amountIn);
  const minimumAmountOutUnits = parseUnits(quoted.minimumAmountOut, EVM_DECIMALS);
  const { index, opposite } = getTokenConfig(tokenIn);
  logger.debug('[SepoliaBridge] Starting swap', {
    accountIndex,
    tokenIn,
    amountIn,
    quotedAmountOut: quoted.amountOut,
    minimumAmountOut: quoted.minimumAmountOut,
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
    const receipt = await swapTx.wait(EVM_CONFIG.confirmations);
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

  const amountInUnits = parseUnits(amountIn, EVM_DECIMALS);
  const quoted = await quoteSwap('USDC', amountIn);
  const minimumAmountOutUnits = parseUnits(quoted.minimumAmountOut, EVM_DECIMALS);
  const redemptionAmountUnits = parseUnits(quoted.amountOut, EVM_DECIMALS);

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const usdc = new Contract(EVM_CONFIG.usdcAddress, ERC20_ABI, wallet);
    const wunit = new Contract(EVM_CONFIG.wunitAddress, ERC20_ABI, wallet);
    const pool = new Contract(EVM_CONFIG.stablePoolAddress, POOL_ABI, wallet);
    const router = new Contract(EVM_CONFIG.bridgeRouterAddress, ROUTER_ABI, wallet);
    const [usdcAllowance, wunitAllowance, usdcBalance, wunitBalance, feeData] = await Promise.all([
      usdc.allowance(wallet.address, EVM_CONFIG.stablePoolAddress) as Promise<bigint>,
      wunit.allowance(wallet.address, EVM_CONFIG.bridgeRouterAddress) as Promise<bigint>,
      usdc.balanceOf(wallet.address) as Promise<bigint>,
      wunit.balanceOf(wallet.address) as Promise<bigint>,
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
                id(`${wallet.address}:${destinationTaprootAddress}:estimate`),
                redemptionAmountUnits,
                destinationTaprootAddress,
              ) as Promise<bigint>,
            FALLBACK_REDEMPTION_GAS,
          )
        : FALLBACK_REDEMPTION_GAS,
    );

    const totalGasUnits = gasSegments.reduce((sum, value) => sum + value, 0n);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeWei = totalGasUnits * feePerGas;

    return {
      totalGasUnits: totalGasUnits.toString(),
      totalFeeEth: formatEther(totalFeeWei),
      gasPriceGwei: formatUnits(feePerGas, 'gwei'),
      feePaymentAsset: 'ETH',
      requiresUsdcApproval,
      requiresWunitApproval,
    };
  });
}

export async function quoteUsdcForExactWunit(amountOut: string): Promise<string> {
  assertBridgeContractsConfigured();

  const targetOutUnits = parseUnits(amountOut, EVM_DECIMALS);
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

  const redemptionAmountUnits = parseUnits(amount, EVM_DECIMALS);
  let preparationSwap: SwapExecutionResult | undefined;
  let redeemAmountUnits = redemptionAmountUnits;
  logger.debug('[SepoliaBridge] Starting redemption request', {
    accountIndex,
    amount,
    destinationTaprootAddress,
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
      const maxSourceAmountUnits = parseUnits(maxSourceAmount, EVM_DECIMALS);
      const quotedUsdcAmountUnits = parseUnits(usdcAmount, EVM_DECIMALS);
      if (quotedUsdcAmountUnits > maxSourceAmountUnits) {
        throw new Error(
          `This redemption now needs ${usdcAmount} USDC, which exceeds your entered amount of ${maxSourceAmount} USDC. Refresh the quote or reduce the size.`,
        );
      }
    }
    preparationSwap = await executeSwap(accountIndex, 'USDC', usdcAmount);
    const postSwapBalances = await getEvmBalances(accountIndex);
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

  const approvalTxHash = await ensureAllowance(
    accountIndex,
    'wUNIT',
    EVM_CONFIG.bridgeRouterAddress,
    redeemAmountUnits,
  );

  return withSepoliaSigner(accountIndex, async (wallet) => {
    const router = new Contract(EVM_CONFIG.bridgeRouterAddress, ROUTER_ABI, wallet);
    const releaseId = id(`${wallet.address}:${destinationTaprootAddress}:${Date.now()}`);
    logger.debug('[SepoliaBridge] Broadcasting redemption', {
      accountIndex,
      wallet: wallet.address,
      releaseId,
      redeemAmount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      destinationTaprootAddress,
      approvalTxHash,
    });
    const requestTx = await router.requestRedemption(
      releaseId,
      redeemAmountUnits,
      destinationTaprootAddress,
    );
    const receipt = await requestTx.wait(EVM_CONFIG.confirmations);
    logger.debug('[SepoliaBridge] Redemption confirmed', {
      accountIndex,
      wallet: wallet.address,
      releaseId,
      burnTxHash: receipt?.hash || requestTx.hash,
    });

    const payload: TrackRedemptionRequest = {
      id: releaseId,
      requester: wallet.address,
      destinationTaprootAddress,
      amount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      sourceAsset,
      burnTxHash: receipt?.hash || requestTx.hash,
    };

    await trackRedemption(payload);

    return {
      releaseId,
      burnTxHash: receipt?.hash || requestTx.hash,
      redeemedAmount: formatUnits(redeemAmountUnits, EVM_DECIMALS),
      sourceAsset,
      preparationSwap: preparationSwap
        ? { ...preparationSwap, approvalTxHash: preparationSwap.approvalTxHash || approvalTxHash }
        : undefined,
    };
  });
}

export async function executeUsdcToUnitSwap(
  accountIndex: number,
  amountIn: string,
  destinationTaprootAddress: string,
): Promise<RedemptionExecutionResult> {
  const preparationSwap = await executeSwap(accountIndex, 'USDC', amountIn);
  const redemption = await requestRedemption(
    accountIndex,
    preparationSwap.amountOut,
    destinationTaprootAddress,
    'wUNIT',
  );

  return {
    ...redemption,
    redeemedAmount: preparationSwap.amountOut,
    preparationSwap,
  };
}

export async function estimateSepoliaTokenTransfer(
  accountIndex: number,
  token: SepoliaAsset,
  recipient: string,
  amount: string,
): Promise<SepoliaTokenTransferEstimate> {
  assertBridgeContractsConfigured();

  if (!isAddress(recipient)) {
    throw new Error('Enter a valid Ethereum address');
  }

  const amountUnits = parseUnits(amount, EVM_DECIMALS);

  return withSepoliaSigner(accountIndex, async (wallet, provider) => {
    const tokenContract = new Contract(getTokenConfig(token).address, ERC20_ABI, wallet);
    const [gasEstimate, feeData] = await Promise.all([
      tokenContract.transfer.estimateGas(recipient, amountUnits) as Promise<bigint>,
      provider.getFeeData(),
    ]);

    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeWei = gasEstimate * feePerGas;

    return {
      gasUnits: gasEstimate.toString(),
      totalFeeEth: formatEther(totalFeeWei),
      gasPriceGwei: formatUnits(feePerGas, 'gwei'),
    };
  });
}

export async function sendSepoliaToken(
  accountIndex: number,
  token: SepoliaAsset,
  recipient: string,
  amount: string,
): Promise<SepoliaTokenTransferResult> {
  assertBridgeContractsConfigured();

  if (!isAddress(recipient)) {
    throw new Error('Enter a valid Ethereum address');
  }

  const amountUnits = parseUnits(amount, EVM_DECIMALS);

  return withSepoliaSigner(accountIndex, async (wallet) => {
    const tokenContract = new Contract(getTokenConfig(token).address, ERC20_ABI, wallet);
    const transferTx = await tokenContract.transfer(recipient, amountUnits);
    const receipt = await transferTx.wait(EVM_CONFIG.confirmations);

    return {
      txHash: receipt?.hash || transferTx.hash,
      amount,
      token,
      recipient,
    };
  });
}

export async function fetchSepoliaTokenHistory(
  accountIndex: number,
  token: SepoliaAsset,
): Promise<SepoliaAssetHistoryItem[]> {
  assertBridgeContractsConfigured();

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

    [...incomingEvents, ...outgoingEvents].forEach((event) => {
      const from = String(event.args?.[0] ?? '').toLowerCase();
      const to = String(event.args?.[1] ?? '').toLowerCase();
      const value = event.args?.[2];
      const amount = typeof value === 'bigint' ? value : BigInt(String(value ?? '0'));
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
        const absoluteAmount = Number(formatUnits(netAmount < 0n ? -netAmount : netAmount, EVM_DECIMALS));
        return {
          txid,
          status: {
            confirmed: true,
            block_time: blockTimes.get(entry.blockNumber),
          },
          txData: {
            amount: absoluteAmount,
            assetType: displayAssetType,
            isSent: entry.sent > entry.received,
            isReceived: entry.received > entry.sent,
          },
        };
      })
      .filter((item) => item.txData.amount > 0)
      .sort((left, right) => (right.status.block_time ?? 0) - (left.status.block_time ?? 0));
  });
}
