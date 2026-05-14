export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const POOL_ABI = [
  'function quoteSwap(uint8 tokenIn, uint256 amountIn) view returns (uint256)',
  'function getBalances() view returns (uint256[2])',
  'function swap(uint8 tokenIn, uint256 amountIn, uint256 minAmountOut, address receiver) returns (uint256)',
];

export const ROUTER_ABI = [
  'function requestRedemption(bytes32 releaseId, uint256 amount, string destinationTaprootAddress)',
];

export const HISTORY_BLOCK_LOOKBACK = 300_000;
export const HISTORY_QUERY_CHUNK_SIZE = 20_000;
export const FALLBACK_USDC_APPROVAL_GAS = 55_000n;
export const FALLBACK_SWAP_GAS = 240_000n;
export const FALLBACK_WUNIT_APPROVAL_GAS = 55_000n;
export const FALLBACK_REDEMPTION_GAS = 220_000n;
export const FALLBACK_ERC20_TRANSFER_GAS = 65_000n;
export const FALLBACK_ETH_TRANSFER_GAS = 21_000n;
export const SEPOLIA_BLOCKSCOUT_API_BASE_URL = 'https://eth-sepolia.blockscout.com/api/v2';
