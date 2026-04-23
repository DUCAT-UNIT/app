jest.mock('../secureStorageService', () => ({
  withMnemonic: jest.fn(async (callback: (mnemonic: string) => Promise<unknown>) =>
    callback('test test test test test test test test test test test junk')),
}));

describe('evmWalletService', () => {
  const originalRpcUrl = process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = 'https://rpc.sepolia.example';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL = originalRpcUrl;
  });

  it('derives the Sepolia account from the same mnemonic and account index', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { HDNodeWallet } = require('ethers');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { deriveSepoliaAccount } = require('../evmWalletService');

    const account0 = await deriveSepoliaAccount(0);
    const account1 = await deriveSepoliaAccount(1);

    expect(account0.derivationPath).toBe(`m/44'/60'/0'/0/0`);
    expect(account1.derivationPath).toBe(`m/44'/60'/1'/0/0`);
    expect(account0.address).toBe(
      HDNodeWallet.fromPhrase(
        'test test test test test test test test test test test junk',
        undefined,
        `m/44'/60'/0'/0/0`,
      ).address,
    );
    expect(account1.address).not.toBe(account0.address);
  });
});
