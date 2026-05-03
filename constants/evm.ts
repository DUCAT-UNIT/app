export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com' as const;
export const SEPOLIA_USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
export const SEPOLIA_WUNIT_ADDRESS = '0x139a26fec4786c83888bB2b25E39f656371ed307' as const;
export const SEPOLIA_BRIDGE_ROUTER_ADDRESS = '0x3Da2e4bb5e5539194259D34F9cbc6D2b426A7E6A' as const;
export const SEPOLIA_UNIT_USDC_STABLE_POOL_ADDRESS = '0x463A9C573f8843540045E077170ee920A091d017' as const;
export const SEPOLIA_UNIT_BRIDGE_API_URL = 'https://unit-bridge-sepolia-z6mcndbb6q-ue.a.run.app' as const;
export const SEPOLIA_CHAIN_ID = 11_155_111 as const;
export const EVM_DECIMALS = 6 as const;
export const DEFAULT_SWAP_SLIPPAGE_BPS = 100 as const;
export const DEFAULT_EVM_CONFIRMATIONS = 1 as const;

export const EVM_DERIVATION_PATH = (accountIndex: number): string =>
  `m/44'/60'/${accountIndex}'/0/0`;

export const isValidEvmAddress = (value: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(value.trim());

export const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const EVM_CONFIG = {
  chainId: SEPOLIA_CHAIN_ID,
  rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL?.trim() || SEPOLIA_RPC_URL,
  explorerBaseUrl: 'https://sepolia.etherscan.io',
  bridgeApiBaseUrl: process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL?.trim() || SEPOLIA_UNIT_BRIDGE_API_URL,
  wunitAddress: process.env.EXPO_PUBLIC_WUNIT_ADDRESS?.trim() || SEPOLIA_WUNIT_ADDRESS,
  bridgeRouterAddress: process.env.EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS?.trim() || SEPOLIA_BRIDGE_ROUTER_ADDRESS,
  stablePoolAddress: process.env.EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS?.trim()
    || SEPOLIA_UNIT_USDC_STABLE_POOL_ADDRESS,
  usdcAddress: process.env.EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS?.trim() || SEPOLIA_USDC_ADDRESS,
  confirmations: DEFAULT_EVM_CONFIRMATIONS,
  swapSlippageBps: DEFAULT_SWAP_SLIPPAGE_BPS,
} as const;

export const isEvmBridgeConfigured = (): boolean => {
  return Boolean(
    isSepoliaRpcConfigured() &&
    isValidHttpUrl(EVM_CONFIG.bridgeApiBaseUrl) &&
    isValidEvmAddress(EVM_CONFIG.usdcAddress) &&
    isValidEvmAddress(EVM_CONFIG.wunitAddress) &&
    isValidEvmAddress(EVM_CONFIG.bridgeRouterAddress) &&
    isValidEvmAddress(EVM_CONFIG.stablePoolAddress),
  );
};

export const isSepoliaRpcConfigured = (): boolean => isValidHttpUrl(EVM_CONFIG.rpcUrl);
