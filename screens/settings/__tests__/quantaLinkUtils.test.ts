import type { QuantaRewardClaimResult } from '../../../services/quantaRewardService';
import { makeDerivedAddresses } from '../../../services/__tests__/testUtils';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  getWalletProfileForDerivationMode,
} from '../../../constants/bitcoin';
import {
  formatAddressPreview,
  getAccountAddressEntries,
  getConnectedStatusFromClaim,
  sortAccountAddressEntries,
  sortAccountCandidates,
  type QuantaAccountCandidate,
} from '../quantaLinkUtils';

function makeCandidate(
  accountIndex: number,
  addressType: QuantaAccountCandidate['addressType'],
  points: number
): QuantaAccountCandidate {
  const addresses = makeDerivedAddresses(accountIndex);
  const quantaAddress =
    addressType === 'legacy'
      ? addresses.legacyAddress!
      : addressType === 'segwit'
        ? addresses.segwitAddress
        : addresses.taprootAddress;

  return {
    accountIndex,
    derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
    walletProfile: getWalletProfileForDerivationMode(DEFAULT_WALLET_DERIVATION_MODE),
    addressType,
    quantaAddress,
    addresses,
    status: {
      status: 'not_connected',
      connected: false,
      points,
      user: {
        user_id: `user-${accountIndex}-${addressType}`,
        test_net_wallet: quantaAddress,
      },
      task: {
        task_id: 54,
        name: 'Download Ducat mobile app',
        points: 10000,
        completed: false,
      },
      claim: null,
      stats: {
        total_points: points,
        tasks_completed: accountIndex,
        rank: 1000 + accountIndex,
      },
    },
  };
}

describe('quantaLinkUtils', () => {
  it('formats long addresses by preserving both ends', () => {
    expect(formatAddressPreview('tb1qabcdefghijklmnopqrstuvwxyz1234567890', 16)).toBe(
      'tb1qabc...567890'
    );
  });

  it('sorts account address entries by account first, then p2sh, segwit, taproot', () => {
    const entries = [makeDerivedAddresses(2), makeDerivedAddresses(1)]
      .map((addresses, index) => ({
        accountIndex: index === 0 ? 2 : 1,
        derivationMode: DEFAULT_WALLET_DERIVATION_MODE,
        walletProfile: getWalletProfileForDerivationMode(DEFAULT_WALLET_DERIVATION_MODE),
        addresses,
      }))
      .flatMap(getAccountAddressEntries)
      .sort(sortAccountAddressEntries);

    expect(entries.map((entry) => `${entry.accountIndex}:${entry.addressType}`)).toEqual([
      '1:legacy',
      '1:segwit',
      '1:taproot',
      '2:legacy',
      '2:segwit',
      '2:taproot',
    ]);
  });

  it('sorts candidates by account before point balance', () => {
    const candidates = [
      makeCandidate(2, 'segwit', 90000),
      makeCandidate(1, 'taproot', 100),
      makeCandidate(1, 'legacy', 200),
      makeCandidate(1, 'segwit', 200),
    ].sort(sortAccountCandidates);

    expect(
      candidates.map((candidate) => `${candidate.accountIndex}:${candidate.addressType}`)
    ).toEqual(['1:legacy', '1:segwit', '1:taproot', '2:segwit']);
  });

  it('hydrates connected status from a claim and increments incomplete candidate stats', () => {
    const candidate = makeCandidate(0, 'taproot', 52300);
    const result: QuantaRewardClaimResult = {
      status: 'awarded',
      awarded: true,
      points: 10000,
      user: {
        user_id: 'user-0-taproot',
        test_net_wallet: candidate.quantaAddress,
      },
      task: {
        task_id: 54,
        name: 'Download Ducat mobile app',
        points: 10000,
      },
      claim: {
        claimed_at: '2026-05-14T00:00:00.000Z',
      },
    };

    expect(getConnectedStatusFromClaim(result, candidate, candidate.quantaAddress).stats).toEqual({
      total_points: 62300,
      tasks_completed: 1,
      rank: 1000,
    });
  });
});
