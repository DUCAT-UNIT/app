import { act, renderHook } from '@testing-library/react-native';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  STANDARD_ACCOUNT_DERIVATION_MODE,
  UNISAT_WALLET_DERIVATION_MODE,
  getWalletProfileForDerivationMode,
} from '../../../constants/bitcoin';
import {
  getQuantaMobileRewardStatus,
  getQuantaMobileRewardStatuses,
} from '../../../services/quantaRewardService';
import type { QuantaMobileMatchedAddressType } from '../../../services/quantaRewardService';
import { makeWalletAccountAddresses } from '../../../services/__tests__/testUtils';
import * as WalletService from '../../../services/walletService';
import type { WalletAccountAddresses } from '../../../services/walletService';
import type { DerivedAddresses } from '../../../utils/bitcoin';
import type { QuantaAccountCandidate, QuantaMobileWalletPayload } from '../quantaLinkUtils';
import { useQuantaAccountDiscovery } from '../useQuantaAccountDiscovery';

jest.mock('../../../services/quantaRewardService', () => ({
  getQuantaMobileRewardStatus: jest.fn(),
  getQuantaMobileRewardStatuses: jest.fn(),
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

function makeUniSatWalletAccountAddresses(accountIndex = 0): WalletAccountAddresses {
  const account = makeWalletAccountAddresses(accountIndex, {
    legacyAddress: `2Nunisat${accountIndex}`,
    segwitAddress: `tb1qunisat${accountIndex}`,
    taprootAddress: `tb1punisat${accountIndex}`,
  });

  return {
    ...account,
    derivationMode: UNISAT_WALLET_DERIVATION_MODE,
    walletProfile: getWalletProfileForDerivationMode(UNISAT_WALLET_DERIVATION_MODE),
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the broader delayed compatibility check before connected status is known', async () => {
    jest.useFakeTimers();
    const currentAccount = makeWalletAccountAddresses(0);
    const matchedAccount = makeWalletAccountAddresses(4);
    (WalletService.findAccountByWalletAddress as jest.Mock).mockResolvedValue({
      accountIndex: matchedAccount.accountIndex,
      derivationMode: matchedAccount.derivationMode,
      walletProfile: matchedAccount.walletProfile,
      addresses: matchedAccount.addresses,
      matchedAddressType: 'taproot',
    });

    renderHook(() =>
      useQuantaAccountDiscovery({
        canCheckAddress: true,
        currentAccount: 0,
        currentAddressMatches: false,
        currentDerivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        getQuantaWalletPayloadFromAddresses: getPayload,
        normalizedQuantaAddress: matchedAccount.addresses.taprootAddress,
        wallet: currentAccount.addresses,
      })
    );

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(WalletService.findAccountByWalletAddress).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(WalletService.findAccountByWalletAddress).toHaveBeenCalledWith(
      matchedAccount.addresses.taprootAddress,
      100
    );
  });

  it('checks only the current account once a connected Quanta address is loaded', async () => {
    jest.useFakeTimers();
    const currentAccount = makeWalletAccountAddresses(0);
    const matchedAccount = makeWalletAccountAddresses(4);

    const { result } = renderHook(() =>
      useQuantaAccountDiscovery({
        canCheckAddress: true,
        currentAccount: 0,
        currentAddressMatches: false,
        currentDerivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        getQuantaWalletPayloadFromAddresses: getPayload,
        normalizedQuantaAddress: matchedAccount.addresses.taprootAddress,
        wallet: currentAccount.addresses,
      })
    );

    act(() => {
      result.current.setConnectedCompatibilityMode(true);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(WalletService.findAccountByWalletAddress).not.toHaveBeenCalled();
    expect(result.current.hasCheckedAddress).toBe(true);
    expect(result.current.matchedAccountIndex).toBeNull();
    expect(result.current.accountCheckError).toBe(
      'No matching Quanta account found in the scanned wallet accounts.'
    );
  });

  it('continues scanning after the first Quanta match and returns all discovered candidates', async () => {
    const firstAccount = makeWalletAccountAddresses(0);
    const secondAccount = makeWalletAccountAddresses(1);
    (WalletService.deriveWalletAccounts as jest.Mock).mockResolvedValue([
      firstAccount,
      secondAccount,
    ]);
    (getQuantaMobileRewardStatuses as jest.Mock).mockImplementation(async (items) => {
      return {
        results: items.map(
          ({ requestId, quantaAddress }: { requestId: string; quantaAddress: string }) => {
            const status =
              quantaAddress === firstAccount.addresses.segwitAddress
                ? makeStatus(quantaAddress, 100, 1)
                : quantaAddress === secondAccount.addresses.taprootAddress
                  ? makeStatus(quantaAddress, 900, 2)
                  : makeEmptyStatus();

            return { requestId, quantaAddress, status };
          }
        ),
      };
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
    expect(WalletService.deriveWalletAccounts).toHaveBeenCalledWith(20, [
      DEFAULT_WALLET_DERIVATION_MODE,
      UNISAT_WALLET_DERIVATION_MODE,
      STANDARD_ACCOUNT_DERIVATION_MODE,
    ]);
    expect(getQuantaMobileRewardStatuses).toHaveBeenCalledTimes(3);
    expect(getQuantaMobileRewardStatus).not.toHaveBeenCalled();
  });

  it('discovers UniSat Taproot Quanta accounts even when the current profile is default', async () => {
    const currentAccount = makeWalletAccountAddresses(0);
    const unisatAccount = makeUniSatWalletAccountAddresses(0);
    (WalletService.deriveWalletAccounts as jest.Mock).mockResolvedValue([
      currentAccount,
      unisatAccount,
    ]);
    (getQuantaMobileRewardStatuses as jest.Mock).mockImplementation(async (items) => ({
      results: items.map(
        ({ requestId, quantaAddress }: { requestId: string; quantaAddress: string }) => ({
          requestId,
          quantaAddress,
          status:
            quantaAddress === unisatAccount.addresses.taprootAddress
              ? makeStatus(quantaAddress, 1200, 3)
              : makeEmptyStatus(),
        })
      ),
    }));

    const { result } = renderHook(() =>
      useQuantaAccountDiscovery({
        canCheckAddress: false,
        currentAccount: 0,
        currentAddressMatches: false,
        currentDerivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        getQuantaWalletPayloadFromAddresses: getPayload,
        normalizedQuantaAddress: '',
        wallet: currentAccount.addresses,
      })
    );

    let candidates: QuantaAccountCandidate[] = [];
    await act(async () => {
      candidates = await result.current.discoverQuantaAccountCandidates();
    });

    expect(WalletService.deriveWalletAccounts).toHaveBeenCalledWith(20, [
      DEFAULT_WALLET_DERIVATION_MODE,
      UNISAT_WALLET_DERIVATION_MODE,
      STANDARD_ACCOUNT_DERIVATION_MODE,
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      accountIndex: 0,
      derivationMode: UNISAT_WALLET_DERIVATION_MODE,
      walletProfile: 'unisat',
      addressType: 'taproot',
      quantaAddress: unisatAccount.addresses.taprootAddress,
    });
  });

  it('falls back to address-scoped discovery requests when the batch endpoint is unavailable', async () => {
    const account = makeWalletAccountAddresses(0);
    (WalletService.deriveWalletAccounts as jest.Mock).mockResolvedValue([account]);
    (getQuantaMobileRewardStatuses as jest.Mock).mockRejectedValue(new Error('404'));
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
