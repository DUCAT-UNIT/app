describe('mintConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_CASHU_MINT_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the advertised Ducat Cashu mint by default', () => {
    const config = require('../mintConfig') as typeof import('../mintConfig');

    expect(config.MINT_URL).toBe('https://dev-cashu-mint.ducatprotocol.com');
    expect(config.CASHU_UNIT).toBe('unit');
    expect(config.RUNE_ID).toBe('1527352:1');
  });

  it('rejects insecure mint URL overrides', () => {
    process.env.EXPO_PUBLIC_CASHU_MINT_URL = 'http://mint.example.com';

    expect(() => require('../mintConfig')).toThrow('EXPO_PUBLIC_CASHU_MINT_URL must use HTTPS');
  });
});
