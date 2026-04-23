import { Contract, Interface, JsonRpcProvider, Wallet, formatUnits, id, parseUnits } from 'ethers';
import { BRIDGE_CONFIG } from './config';

const WUNIT_ABI = [
  'function totalSupply() view returns (uint256)',
];

const POOL_ABI = [
  'function quoteSwap(uint8 tokenIn, uint256 amountIn) view returns (uint256)',
  'function getPoolState() view returns (uint256 reserveWunit, uint256 reserveUsdc, uint256 amplification, uint256 swapFeeBps, uint256 totalLpSupply, bool paused)',
];

const ROUTER_ABI = [
  'event BridgeFulfilled(bytes32 indexed intentId, address indexed recipient, uint256 wunitAmount, bool autoSwapRequested, bool autoSwapSucceeded, uint256 payoutAmount, address payoutToken)',
  'event RedemptionRequested(bytes32 indexed releaseId, address indexed requester, string destinationTaprootAddress, uint256 amount, address indexed sourceAsset)',
  'function fulfillBridge(bytes32 intentId, address recipient, uint256 amount, bool autoSwap, uint256 minUsdcOut) returns (uint256 payoutAmount, address payoutToken)',
];

function getProvider(): JsonRpcProvider {
  if (!BRIDGE_CONFIG.sepolia.rpcUrl) {
    throw new Error('UNIT_BRIDGE_SEPOLIA_RPC_URL is not configured');
  }

  return new JsonRpcProvider(BRIDGE_CONFIG.sepolia.rpcUrl, BRIDGE_CONFIG.sepolia.chainId);
}

function getSigner(): Wallet {
  if (!BRIDGE_CONFIG.sepolia.privateKey) {
    throw new Error('UNIT_BRIDGE_SEPOLIA_PRIVATE_KEY is not configured');
  }

  return new Wallet(BRIDGE_CONFIG.sepolia.privateKey, getProvider());
}

export async function fulfillSepoliaIntent(
  intent: { id: string; sepoliaRecipient: string; amount: string; autoSwap: boolean },
): Promise<{
  txHash: string;
  payoutAsset: 'USDC' | 'wUNIT';
  payoutAmount: string;
  autoSwapSucceeded: boolean;
}> {
  const signer = getSigner();
  const router = new Contract(BRIDGE_CONFIG.sepolia.routerAddress, ROUTER_ABI, signer);
  const pool = new Contract(BRIDGE_CONFIG.sepolia.poolAddress, POOL_ABI, signer.provider);
  const amountUnits = parseUnits(intent.amount, 6);
  let minUsdcOut = 0n;

  if (intent.autoSwap) {
    const quote = await pool.quoteSwap(0, amountUnits) as bigint;
    minUsdcOut = (quote * BigInt(10_000 - BRIDGE_CONFIG.defaultSwapSlippageBps)) / 10_000n;
  }

  const tx = await router.fulfillBridge(
    id(intent.id),
    intent.sepoliaRecipient,
    amountUnits,
    intent.autoSwap,
    minUsdcOut,
  );
  const receipt = await tx.wait(BRIDGE_CONFIG.sepoliaConfirmations);
  const iface = new Interface(ROUTER_ABI);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'BridgeFulfilled') {
        const payoutToken = String(parsed.args.payoutToken).toLowerCase() === BRIDGE_CONFIG.sepoliaUsdcAddress.toLowerCase()
          ? 'USDC'
          : 'wUNIT';
        return {
          txHash: receipt.hash,
          payoutAsset: payoutToken,
          payoutAmount: formatUnits(parsed.args.payoutAmount, 6),
          autoSwapSucceeded: Boolean(parsed.args.autoSwapSucceeded),
        };
      }
    } catch {
      // ignore unrelated logs
    }
  }

  throw new Error(`BridgeFulfilled event not found for ${intent.id}`);
}

export async function syncSepoliaState(): Promise<{
  supply: bigint;
  pool: {
    reserveWunit: bigint;
    reserveUsdc: bigint;
    amplification: number;
    swapFeeBps: number;
    totalLpSupply: bigint;
    paused: boolean;
  };
}> {
  const provider = getProvider();
  const wunit = new Contract(BRIDGE_CONFIG.sepolia.wunitAddress, WUNIT_ABI, provider);
  const pool = new Contract(BRIDGE_CONFIG.sepolia.poolAddress, POOL_ABI, provider);
  const [supply, poolState] = await Promise.all([
    wunit.totalSupply() as Promise<bigint>,
    pool.getPoolState() as Promise<[bigint, bigint, bigint, bigint, bigint, boolean]>,
  ]);

  return {
    supply,
    pool: {
      reserveWunit: poolState[0],
      reserveUsdc: poolState[1],
      amplification: Number(poolState[2]),
      swapFeeBps: Number(poolState[3]),
      totalLpSupply: poolState[4],
      paused: poolState[5],
    },
  };
}

export async function fetchRedemptionEvents(fromBlock: number): Promise<{
  nextBlock: number;
  events: Array<{
    releaseId: string;
    requester: string;
    destinationTaprootAddress: string;
    amount: string;
    burnTxHash: string;
  }>;
}> {
  const provider = getProvider();
  const router = new Contract(BRIDGE_CONFIG.sepolia.routerAddress, ROUTER_ABI, provider);
  const latestBlock = await provider.getBlockNumber();
  const requestedFromBlock = Number.isFinite(Number(fromBlock)) ? Number(fromBlock) : BRIDGE_CONFIG.sepolia.startBlock;
  const startBlock = Math.max(0, requestedFromBlock);

  if (latestBlock < startBlock) {
    return {
      nextBlock: startBlock,
      events: [],
    };
  }

  const filter = router.filters.RedemptionRequested();
  const logs = await router.queryFilter(filter, startBlock, latestBlock);

  return {
    nextBlock: latestBlock + 1,
    events: logs.flatMap((log) => {
      if (!('args' in log)) {
        return [];
      }

      return [{
        releaseId: String(log.args.releaseId),
        requester: String(log.args.requester),
        destinationTaprootAddress: String(log.args.destinationTaprootAddress),
        amount: formatUnits(log.args.amount, 6),
        burnTxHash: log.transactionHash,
      }];
    }),
  };
}
