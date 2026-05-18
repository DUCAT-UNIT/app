import { act, renderHook } from '@testing-library/react-native';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../../../constants/bitcoin';
import { getQuantaMobileRewardStatus } from '../../../services/quantaRewardService';
import type { QuantaMobileMatchedAddressType } from '../../../services/quantaRewardService';
import { makeWalletAccountAddresses } from '../../../services/__tests__/testUtils';
import * as WalletService from '../../../services/walletService';
import type { DerivedAddresses } from '../../../utils/bitcoin';
import type {
  QuantaAccountCandidate,
  QuantaMobileWalletPayload,
} from '../quantaLinkUtils';
import { useQuantaAccountDiscovery } from '../useQuantaAccountDiscovery';

jest.mock('../../../services/quantaRewardService', () => ({
  getQuantaMobileRewardStatus: jest.fn(),
}));

jest.mock('../../../services/walletService', () => ({
  deriveWalletAccounts: jest.fn(),
  findAccountByWalletAddress: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

function makeStatus(address: string, points: number, tasks = 1) {
  return {
    status: 'not_connected' as const,
    connected: false,
    points: 0,
    user: {
      user_id: `user-${address}`,
      test_net_wallet: address,
    },
    task: {
      task_id: 255,
      name: 'Link Ducat Mobile App',
      points: 10000,
      completed: false,
    },
    claim: null,
    stats: {
      total_points: points,
      tasks_completed: tasks,
      rank: 1000,
    },
  };
}

function makeEmptyStatus() {
  return {
    status: 'not_connected' as const,
    connected: false,
    points: 0,
    user: null,
    task: null,
    claim: null,
    stats: null,
  };
}

function getPayload(address: string, addresses: DerivedAddresses): QuantaMobileWalletPayload {
  const normalizedAddress = address.toLowerCase();
  const matchedAddressType: QuantaMobileMatchedAddressType | null =
    addresses.legacyAddress?.toLowerCase() === normalizedAddress
      ? 'legacy'
      : addresses.segwitAddress.toLowerCase() === normalizedAddress
        ? 'segwit'
        : addresses.taprootAddress.toLowerCase() === normalizedAddress
          ? 'taproot'
          : null;

  return {
    mobileWalletAddress: address,
    mobileLegacyAddress: addresses.legacyAddress ?? null,
    mobileTaprootAddress: addresses.taprootAddress,
    mobileSegwitAddress: addresses.segwitAddress,
    matchedAddressType,
  };
}

describe('useQuantaAccountDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WalletService.findAccountByWalletAddress as jest.Mock).mockResolvedValue(null);
  });

  it('continues scanning after the first Quanta match and returns all discovered candidates', async () => {
    const firstAccount = makeWalletAccountAddresses(0);
    const secondAccount = makeWalletAccountAddresses(1);
    (WalletService.deriveWalletAccounts as jest.Mock).mockResolvedValue([
      firstAccount,
      secondAccount,
    ]);
    (getQuantaMobileRewardStatus as jest.Mock).mockImplementation(async ({ quantaAddress }) => {
      if (quantaAddress === firstAccount.addresses.segwitAddress) {
        return makeStatus(quantaAddress, 100, 1);
      }
      if (quantaAddress === secondAccount.addresses.taprootAddress) {
        return makeStatus(quantaAddress, 900, 2);
      }
      return makeEmptyStatus();
    });

    const { result } = renderHook(() =>
      useQuantaAccountDiscovery({
        canCheckAddress: false,
        currentAccount: 0,
        currentAddressMatches: false,
        currentDerivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        getQuantaWalletPayloadFromAddresses: getPayload,
        normalizedQuantaAddress: '',
        wallet: firstAccount.addresses,
      })
    );

    let candidates: QuantaAccountCandidate[] = [];
    await act(async () => {
      candidates = await result.current.discoverQuantaAccountCandidates();
    });

    expect(
      candidates.map((candidate) => `${candidate.accountIndex}:${candidate.addressType}`)
    ).toEqual(['0:segwit', '1:taproot']);
    expect(result.current.accountCandidates).toHaveLength(2);
    expect(result.current.selectedCandidateKey).toContain(
      `${DEFAULT_WALLET_DERIVATION_MODE}:0:segwit`
    );
    expect(getQuantaMobileRewardStatus).toHaveBeenCalledTimes(6);
  });

  it('uses an address-scoped circuit key for each discovery request', async () => {
    const account = makeWalletAccountAddresses(0);
    (WalletService.deriveWalletAccounts as jest.Mock).mockResolvedValue([account]);
    (getQuantaMobileRewardStatus as jest.Mock).mockResolvedValue(makeEmptyStatus());

    const { result } = renderHook(() =>
      useQuantaAccountDiscovery({
        canCheckAddress: false,
        currentAccount: 0,
        currentAddressMatches: false,
        currentDerivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        getQuantaWalletPayloadFromAddresses: getPayload,
        normalizedQuantaAddress: '',
        wallet: account.addresses,
      })
    );

    await act(async () => {
      await result.current.discoverQuantaAccountCandidates();
    });

    const circuitKeys = (getQuantaMobileRewardStatus as jest.Mock).mock.calls.map(
      ([, options]) => options.circuitKey
    );
    expect(circuitKeys).toHaveLength(3);
    expect(new Set(circuitKeys).size).toBe(3);
    expect(circuitKeys.every((key) => key.startsWith('quanta-mobile-reward-discovery:'))).toBe(
      true
    );
  });
});
