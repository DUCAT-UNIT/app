describe('networkConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_APP_NETWORK;
    delete process.env.EXPO_PUBLIC_UNIT_RUNE_BLOCK;
    delete process.env.EXPO_PUBLIC_UNIT_RUNE_TX;
    delete process.env.EXPO_PUBLIC_VALIDATOR_URL;
    delete process.env.EXPO_PUBLIC_ESPLORA_API_URL;
    delete process.env.EXPO_PUBLIC_VAULT_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadConfig(): typeof import('../networkConfig') {
    // networkConfig resolves env at module import time.
    return require('../networkConfig');
  }

  it('defaults to Mutinynet and testnet derivation settings', () => {
    const { APP_NETWORK_CONFIG } = loadConfig();

    expect(APP_NETWORK_CONFIG.id).toBe('mutinynet');
    expect(APP_NETWORK_CONFIG.displayName).toBe('Mutinynet');
    expect(APP_NETWORK_CONFIG.isTestNetwork).toBe(true);
    expect(APP_NETWORK_CONFIG.bitcoinjs.bech32).toBe('tb');
    expect(APP_NETWORK_CONFIG.coinType).toBe(1);
    expect(APP_NETWORK_CONFIG.vaultSdkNetwork).toBe('mutiny');
  });

  it('allows an explicit mutinynet network value', () => {
    process.env.EXPO_PUBLIC_APP_NETWORK = 'mutinynet';

    const { APP_NETWORK_CONFIG } = loadConfig();

    expect(APP_NETWORK_CONFIG.id).toBe('mutinynet');
  });

  it('rejects mainnet as an app network', () => {
    process.env.EXPO_PUBLIC_APP_NETWORK = 'mainnet';

    expect(() => loadConfig()).toThrow('Mutinynet-only');
  });

  it('rejects sepolia as an app network while allowing Sepolia EVM support elsewhere', () => {
    process.env.EXPO_PUBLIC_APP_NETWORK = 'sepolia';

    expect(() => loadConfig()).toThrow('Unsupported EXPO_PUBLIC_APP_NETWORK value "sepolia"');
  });

  it('trims optional endpoint overrides without changing the network id', () => {
    process.env.EXPO_PUBLIC_ESPLORA_API_URL = ' https://mutinynet.example/api ';

    const { APP_NETWORK_CONFIG } = loadConfig();

    expect(APP_NETWORK_CONFIG.id).toBe('mutinynet');
    expect(APP_NETWORK_CONFIG.api.esploraApiUrl).toBe('https://mutinynet.example/api');
  });

  it('uses the reachable Mutinynet validator by default', () => {
    const { APP_NETWORK_CONFIG } = loadConfig();

    expect(APP_NETWORK_CONFIG.api.validatorUrl).toBe(
      'https://validator-mutinynet.dev.ducatprotocol.com'
    );
    expect(APP_NETWORK_CONFIG.api.vaultUrl).toBe(
      'https://validator-mutinynet.dev.ducatprotocol.com/api'
    );
  });

  it('uses the live Mutinynet UNIT rune by default', () => {
    const { APP_NETWORK_CONFIG } = loadConfig();

    expect(APP_NETWORK_CONFIG.runes.unitId).toEqual({ block: 1527352n, tx: 1n });
    expect(APP_NETWORK_CONFIG.runes.unitLabel).toBe('DUCAT•UNIT•RUNE');
  });

  it('rejects insecure vault API overrides', () => {
    process.env.EXPO_PUBLIC_VAULT_API_URL = 'http://validator.example/api';

    expect(() => loadConfig()).toThrow('EXPO_PUBLIC_VAULT_API_URL must use HTTPS');
  });

  it('fails fast on invalid bigint protocol overrides', () => {
    process.env.EXPO_PUBLIC_UNIT_RUNE_BLOCK = 'not-a-number';

    expect(() => loadConfig()).toThrow('Invalid bigint value for EXPO_PUBLIC_UNIT_RUNE_BLOCK');
  });
});
