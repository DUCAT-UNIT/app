import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../../../constants/bitcoin';
import { makeWalletAccountAddresses } from '../../../services/__tests__/testUtils';
import { loadQuantaDiscoveryCache, saveQuantaDiscoveryCache } from '../quantaDiscoveryCache';
import type { QuantaAccountCandidate } from '../quantaLinkUtils';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

function makeCandidate(): QuantaAccountCandidate {
  const account = makeWalletAccountAddresses(0);
  const quantaAddress = account.addresses.taprootAddress;

  return {
    accountIndex: 0,
    derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
    walletProfile: account.walletProfile,
    addressType: 'taproot',
    quantaAddress,
    addresses: account.addresses,
    status: {
      status: 'not_connected',
      connected: false,
      points: 0,
      user: {
        user_id: 'user-1',
        test_net_wallet: quantaAddress,
      },
      task: null,
      claim: null,
      stats: {
        total_points: 100,
        tasks_completed: 2,
        rank: 42,
      },
    },
  };
}

describe('quantaDiscoveryCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads saved candidates for the same wallet scope', async () => {
    const candidate = makeCandidate();
    let storedValue = '';
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (_key, value) => {
      storedValue = value;
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => storedValue);

    await saveQuantaDiscoveryCache({
      accountIndex: 0,
      candidates: [candidate],
      derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
      hasNoQuantaInWallet: false,
      selectedCandidateKey: null,
      targetAddress: '',
      walletFingerprint: candidate.addresses.taprootAddress,
    });

    const cached = await loadQuantaDiscoveryCache({
      accountIndex: 0,
      derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
      targetAddress: '',
      walletFingerprint: candidate.addresses.taprootAddress,
    });

    expect(cached?.candidates).toHaveLength(1);
    expect(cached?.candidates[0]?.quantaAddress).toBe(candidate.quantaAddress);
    expect(cached?.hasNoQuantaInWallet).toBe(false);
  });

  it('does not load candidates for a different wallet fingerprint', async () => {
    const candidate = makeCandidate();
    let storedValue = '';
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (_key, value) => {
      storedValue = value;
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => storedValue);

    await saveQuantaDiscoveryCache({
      accountIndex: 0,
      candidates: [candidate],
      derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
      hasNoQuantaInWallet: false,
      selectedCandidateKey: null,
      targetAddress: '',
      walletFingerprint: candidate.addresses.taprootAddress,
    });

    const cached = await loadQuantaDiscoveryCache({
      accountIndex: 0,
      derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
      targetAddress: '',
      walletFingerprint: 'tb1pdifferentwallet',
    });

    expect(cached).toBeNull();
  });
});
