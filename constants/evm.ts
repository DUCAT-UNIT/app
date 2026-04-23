export const SEPOLIA_USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
export const SEPOLIA_CHAIN_ID = 11_155_111 as const;
export const EVM_DECIMALS = 6 as const;
export const DEFAULT_SWAP_SLIPPAGE_BPS = 100 as const;
export const DEFAULT_EVM_CONFIRMATIONS = 1 as const;

export const EVM_DERIVATION_PATH = (accountIndex: number): string =>
  `m/44'/60'/${accountIndex}'/0/0`;

export const EVM_CONFIG = {
  chainId: SEPOLIA_CHAIN_ID,
  rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL?.trim() || '',
  explorerBaseUrl: 'https://sepolia.etherscan.io',
  bridgeApiBaseUrl: process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL?.trim() || '',
  wunitAddress: process.env.EXPO_PUBLIC_WUNIT_ADDRESS?.trim() || '',
  bridgeRouterAddress: process.env.EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS?.trim() || '',
  stablePoolAddress: process.env.EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS?.trim() || '',
  usdcAddress: process.env.EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS?.trim() || SEPOLIA_USDC_ADDRESS,
  confirmations: DEFAULT_EVM_CONFIRMATIONS,
  swapSlippageBps: DEFAULT_SWAP_SLIPPAGE_BPS,
} as const;

export const isEvmBridgeConfigured = (): boolean => {
  return Boolean(
    EVM_CONFIG.rpcUrl &&
    EVM_CONFIG.bridgeApiBaseUrl &&
    EVM_CONFIG.wunitAddress &&
    EVM_CONFIG.bridgeRouterAddress &&
    EVM_CONFIG.stablePoolAddress,
  );
};
