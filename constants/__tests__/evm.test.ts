describe('EVM constants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL;
    delete process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL;
    delete process.env.EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS;
    delete process.env.EXPO_PUBLIC_WUNIT_ADDRESS;
    delete process.env.EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS;
    delete process.env.EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadConfig(): typeof import('../evm') {
    return require('../evm');
  }

  it('ships release-safe public Sepolia defaults when EAS env is empty', () => {
    const { EVM_CONFIG, isEvmBridgeConfigured, isSepoliaRpcConfigured } = loadConfig();

    expect(EVM_CONFIG.rpcUrl).toBe('https://ethereum-sepolia-rpc.publicnode.com');
    expect(EVM_CONFIG.usdcAddress).toBe('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');
    expect(EVM_CONFIG.wunitAddress).toBe('0x139a26fec4786c83888bB2b25E39f656371ed307');
    expect(EVM_CONFIG.bridgeRouterAddress).toBe('0x3Da2e4bb5e5539194259D34F9cbc6D2b426A7E6A');
    expect(EVM_CONFIG.stablePoolAddress).toBe('0x463A9C573f8843540045E077170ee920A091d017');
    expect(EVM_CONFIG.bridgeApiBaseUrl).toBe('https://v1mop1qqt8.execute-api.us-east-1.amazonaws.com');
    expect(isSepoliaRpcConfigured()).toBe(true);
    expect(isEvmBridgeConfigured()).toBe(true);
  });

  it('treats Sepolia RPC as configured only when it is a valid HTTP URL', () => {
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = 'not-a-url';
    expect(loadConfig().isSepoliaRpcConfigured()).toBe(false);

    jest.resetModules();
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = ' https://rpc.sepolia.example ';
    const { EVM_CONFIG, isSepoliaRpcConfigured } = loadConfig();
    expect(EVM_CONFIG.rpcUrl).toBe('https://rpc.sepolia.example');
    expect(isSepoliaRpcConfigured()).toBe(true);
  });

  it('does not enable bridge config for malformed contract addresses', () => {
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = 'https://rpc.sepolia.example';
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL = 'https://bridge.example';
    process.env.EXPO_PUBLIC_WUNIT_ADDRESS = 'not-an-address';
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS = '0x0000000000000000000000000000000000000004';
    process.env.EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS = '0x0000000000000000000000000000000000000003';

    expect(loadConfig().isEvmBridgeConfigured()).toBe(false);
  });

  it('enables bridge config only when URLs and all contracts are valid', () => {
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = 'https://rpc.sepolia.example';
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_API_URL = 'https://bridge.example';
    process.env.EXPO_PUBLIC_WUNIT_ADDRESS = '0x0000000000000000000000000000000000000002';
    process.env.EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS = '0x0000000000000000000000000000000000000004';
    process.env.EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS = '0x0000000000000000000000000000000000000003';

    const { isEvmBridgeConfigured, isValidEvmAddress, isValidHttpUrl } = loadConfig();
    expect(isEvmBridgeConfigured()).toBe(true);
    expect(isValidEvmAddress('0x0000000000000000000000000000000000000002')).toBe(true);
    expect(isValidEvmAddress('0xnotvalid')).toBe(false);
    expect(isValidHttpUrl('https://bridge.example')).toBe(true);
    expect(isValidHttpUrl('ftp://bridge.example')).toBe(false);
  });
});
