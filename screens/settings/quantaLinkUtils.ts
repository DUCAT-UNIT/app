import type {
  QuantaMobileMatchedAddressType,
  QuantaRewardClaimResult,
  QuantaRewardStatusResult,
} from '../../services/quantaRewardService';
import type { WalletAccountAddresses, WalletAddressMatchType } from '../../services/walletService';
import type { DerivedAddresses } from '../../utils/bitcoin';

export const ACCOUNT_COMPATIBILITY_TIMEOUT_MS = 5000;
export const ACCOUNT_CHECK_TIMEOUT_RESULT = { timedOut: true } as const;
export const NO_MATCH_ACCOUNT_MESSAGE =
  'No matching Quanta account found in the first 100 wallet accounts.';
export const ACCOUNT_CHECK_TIMEOUT_MESSAGE = 'Account compatibility check timed out. Try again.';
export const ACCOUNT_CHECK_FAILURE_MESSAGE = 'Could not check wallet accounts. Try again.';
export const CONNECT_QUANTA_ERROR_MESSAGE = 'Could not connect Quanta. Try again.';
export const QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT = 100;
export const QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT = 20;
export const QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY = 6;
export const QUANTA_ACCOUNT_PICKER_OPEN_DELAY_MS = 80;

export interface QuantaMobileWalletPayload {
  mobileWalletAddress: string | null;
  mobileLegacyAddress: string | null;
  mobileTaprootAddress: string | null;
  mobileSegwitAddress: string | null;
  matchedAddressType: QuantaMobileMatchedAddressType | null;
}

export interface QuantaAccountCandidate {
  accountIndex: number;
  addressType: WalletAddressMatchType;
  quantaAddress: string;
  status: QuantaRewardStatusResult;
  addresses: DerivedAddresses;
}

export interface AccountAddressEntry {
  accountIndex: number;
  addressType: WalletAddressMatchType;
  address: string;
  addresses: DerivedAddresses;
}

export function formatAddressPreview(address: string | undefined, maxLength: number): string {
  if (!address) {
    return '--';
  }

  if (address.length <= maxLength) {
    return address;
  }

  const visibleLength = Math.max(maxLength - 3, 8);
  const prefixLength = Math.ceil(visibleLength / 2);
  const suffixLength = Math.floor(visibleLength / 2);

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

export function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

export function getAddressTypeLabel(addressType: WalletAddressMatchType): string {
  if (addressType === 'legacy') {
    return 'p2sh';
  }

  if (addressType === 'segwit') {
    return 'SegWit';
  }

  return 'Taproot';
}

function getAddressTypeSortRank(addressType: WalletAddressMatchType): number {
  if (addressType === 'legacy') {
    return 0;
  }

  if (addressType === 'segwit') {
    return 1;
  }

  return 2;
}

export function getCandidateKey(candidate: QuantaAccountCandidate): string {
  return `${candidate.accountIndex}:${candidate.addressType}:${candidate.quantaAddress.toLowerCase()}`;
}

export function getCandidatePoints(candidate: QuantaAccountCandidate): number {
  return candidate.status.stats?.total_points ?? candidate.status.points ?? 0;
}

export function sortAccountAddressEntries(a: AccountAddressEntry, b: AccountAddressEntry): number {
  if (a.accountIndex !== b.accountIndex) {
    return a.accountIndex - b.accountIndex;
  }

  return getAddressTypeSortRank(a.addressType) - getAddressTypeSortRank(b.addressType);
}

export function sortAccountCandidates(
  a: QuantaAccountCandidate,
  b: QuantaAccountCandidate
): number {
  if (a.accountIndex !== b.accountIndex) {
    return a.accountIndex - b.accountIndex;
  }

  const pointDiff = getCandidatePoints(b) - getCandidatePoints(a);
  if (pointDiff !== 0) {
    return pointDiff;
  }

  const addressTypeDiff =
    getAddressTypeSortRank(a.addressType) - getAddressTypeSortRank(b.addressType);
  if (addressTypeDiff !== 0) {
    return addressTypeDiff;
  }

  return a.quantaAddress.localeCompare(b.quantaAddress);
}

export function getAccountAddressEntries(account: WalletAccountAddresses): AccountAddressEntry[] {
  const entries: AccountAddressEntry[] = [];

  if (account.addresses.legacyAddress) {
    entries.push({
      accountIndex: account.accountIndex,
      addressType: 'legacy',
      address: account.addresses.legacyAddress,
      addresses: account.addresses,
    });
  }

  entries.push(
    {
      accountIndex: account.accountIndex,
      addressType: 'taproot',
      address: account.addresses.taprootAddress,
      addresses: account.addresses,
    },
    {
      accountIndex: account.accountIndex,
      addressType: 'segwit',
      address: account.addresses.segwitAddress,
      addresses: account.addresses,
    }
  );

  return entries;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]!);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function getRewardAlertCopy(result: QuantaRewardClaimResult): {
  title: string;
  message: string;
} {
  if (result.status === 'awarded') {
    return {
      title: 'Quanta connected',
      message: `Your Ducat mobile wallet is now linked to Quanta. +${formatPoints(
        result.points
      )} points were awarded.`,
    };
  }

  if (result.status === 'already_claimed') {
    return {
      title: 'Already connected',
      message: 'This Quanta wallet has already claimed the Ducat mobile reward.',
    };
  }

  return {
    title: 'Reward already used',
    message: 'This app install has already been used to claim a Ducat mobile reward.',
  };
}

export function getConnectedStatusFromClaim(
  result: QuantaRewardClaimResult,
  candidate: QuantaAccountCandidate | undefined,
  claimAddress: string
): QuantaRewardStatusResult {
  const candidateStats = candidate?.status.stats ?? null;
  const awardedPoints = result.status === 'awarded' ? result.points : 0;
  const candidateTaskCompleted = candidate?.status.task?.completed === true;

  return {
    status: 'connected',
    connected: true,
    points: result.status === 'awarded' ? result.points : result.task.points,
    user: {
      user_id: result.user.user_id,
      test_net_wallet: result.user.test_net_wallet || claimAddress,
    },
    task: {
      task_id: result.task.task_id,
      name: result.task.name,
      points: result.task.points,
      completed: true,
      completed_at: result.claim?.claimed_at ?? null,
    },
    claim: result.claim,
    stats: candidateStats
      ? {
          total_points: candidateStats.total_points + awardedPoints,
          tasks_completed:
            candidateStats.tasks_completed + (awardedPoints > 0 && !candidateTaskCompleted ? 1 : 0),
          rank: candidateStats.rank,
        }
      : null,
  };
}
