jest.mock('../../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const DEFAULT_MINT_URL = 'https://dev-cashu-mint.ducatprotocol.com';
const PROD_MINT_URL = 'https://cashu-mint.ducatprotocol.com';
const BACKUP_MINT_URL = 'https://backup-mint.ducatprotocol.com';

function loadMintConfig(): typeof import('../mintConfig') {
  jest.resetModules();
  return require('../mintConfig') as typeof import('../mintConfig');
}

describe('mintConfig', () => {
  const originalMintUrl = process.env.EXPO_PUBLIC_MINT_URL;

  afterEach(() => {
    if (originalMintUrl === undefined) {
      delete process.env.EXPO_PUBLIC_MINT_URL;
    } else {
      process.env.EXPO_PUBLIC_MINT_URL = originalMintUrl;
    }
    jest.clearAllMocks();
  });

  it('uses the default production mint when no env override is set', () => {
    delete process.env.EXPO_PUBLIC_MINT_URL;

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe(DEFAULT_MINT_URL);
    expect(config.MINT_URLS).toEqual([DEFAULT_MINT_URL, BACKUP_MINT_URL]);
    expect(config.CASHU_UNIT).toBe('unit');
    expect(config.RUNE_ID).toBe('1527352:1');
  });

  it('allows whitelisted mint URLs', () => {
    process.env.EXPO_PUBLIC_MINT_URL = PROD_MINT_URL;

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe(PROD_MINT_URL);
    expect(config.MINT_URLS).toEqual([PROD_MINT_URL, BACKUP_MINT_URL]);
  });

  it('allows the backup mint URL', () => {
    process.env.EXPO_PUBLIC_MINT_URL = BACKUP_MINT_URL;

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe(BACKUP_MINT_URL);
    expect(config.MINT_URLS).toEqual([BACKUP_MINT_URL, BACKUP_MINT_URL]);
  });

  it('allows local development mint URLs in dev mode', () => {
    process.env.EXPO_PUBLIC_MINT_URL = 'http://127.0.0.1:3338';

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe('http://127.0.0.1:3338');
  });

  it('falls back to the default mint for non-whitelisted remote URLs', () => {
    process.env.EXPO_PUBLIC_MINT_URL = 'https://attacker.example.com';

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe(DEFAULT_MINT_URL);
  });

  it('falls back to the default mint for malformed URLs', () => {
    process.env.EXPO_PUBLIC_MINT_URL = 'not a url';

    const config = loadMintConfig();

    expect(config.MINT_URL).toBe(DEFAULT_MINT_URL);
  });
});
