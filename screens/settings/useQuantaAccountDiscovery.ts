import React from 'react';
import { getQuantaMobileRewardStatus } from '../../services/quantaRewardService';
import * as WalletService from '../../services/walletService';
import type { DerivedAddresses } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import {
  ACCOUNT_CHECK_FAILURE_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_RESULT,
  ACCOUNT_COMPATIBILITY_TIMEOUT_MS,
  NO_MATCH_ACCOUNT_MESSAGE,
  QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY,
  QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT,
  QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT,
  getAccountAddressEntries,
  getCandidateKey,
  getCandidatePoints,
  mapWithConcurrency,
  sortAccountAddressEntries,
  sortAccountCandidates,
  type QuantaAccountCandidate,
  type QuantaMobileWalletPayload,
} from './quantaLinkUtils';

interface UseQuantaAccountDiscoveryParams {
  canCheckAddress: boolean;
  currentAccount: number;
  currentAddressMatches: boolean;
  getQuantaWalletPayloadFromAddresses: (
    address: string,
    addresses: DerivedAddresses
  ) => QuantaMobileWalletPayload;
  normalizedQuantaAddress: string;
  wallet: DerivedAddresses | null;
}

interface UseQuantaAccountDiscoveryResult {
  accountCandidates: QuantaAccountCandidate[];
  accountCheckError: string | null;
  discoverQuantaAccountCandidates: () => Promise<QuantaAccountCandidate[]>;
  handleSelectCandidate: (candidate: QuantaAccountCandidate) => void;
  hasCheckedAddress: boolean;
  isDiscoveringAccounts: boolean;
  markCandidateMatched: (candidate: QuantaAccountCandidate) => void;
  matchedAccountAddresses: DerivedAddresses | null;
  matchedAccountIndex: number | null;
  resetAccountDiscovery: () => void;
  selectedCandidate: QuantaAccountCandidate | undefined;
  selectedCandidateKey: string | null;
  setAccountCandidates: React.Dispatch<React.SetStateAction<QuantaAccountCandidate[]>>;
  setIsDiscoveringAccounts: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedCandidateKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useQuantaAccountDiscovery({
  canCheckAddress,
  currentAccount,
  currentAddressMatches,
  getQuantaWalletPayloadFromAddresses,
  normalizedQuantaAddress,
  wallet,
}: UseQuantaAccountDiscoveryParams): UseQuantaAccountDiscoveryResult {
  const [matchedAccountIndex, setMatchedAccountIndex] = React.useState<number | null>(null);
  const [matchedAccountAddresses, setMatchedAccountAddresses] =
    React.useState<DerivedAddresses | null>(null);
  const [hasCheckedAddress, setHasCheckedAddress] = React.useState(false);
  const [accountCheckError, setAccountCheckError] = React.useState<string | null>(null);
  const [accountCandidates, setAccountCandidates] = React.useState<QuantaAccountCandidate[]>([]);
  const [isDiscoveringAccounts, setIsDiscoveringAccounts] = React.useState(false);
  const [selectedCandidateKey, setSelectedCandidateKey] = React.useState<string | null>(null);

  const selectedCandidate = React.useMemo(
    () =>
      accountCandidates.find((candidate) => getCandidateKey(candidate) === selectedCandidateKey),
    [accountCandidates, selectedCandidateKey]
  );

  React.useEffect(() => {
    if (!canCheckAddress) {
      setMatchedAccountIndex(null);
      setMatchedAccountAddresses(null);
      setHasCheckedAddress(false);
      setAccountCheckError(null);
      setAccountCandidates([]);
      setSelectedCandidateKey(null);
      return;
    }

    if (currentAddressMatches) {
      setMatchedAccountIndex(currentAccount);
      setMatchedAccountAddresses(null);
      setHasCheckedAddress(true);
      setAccountCheckError(null);
      setAccountCandidates([]);
      return;
    }

    let isCancelled = false;
    setHasCheckedAddress(false);
    setAccountCheckError(null);

    const timeout = setTimeout(() => {
      type AccountCheckResult =
        | WalletService.FindWalletAccountResult
        | null
        | typeof ACCOUNT_CHECK_TIMEOUT_RESULT;

      withTimeout<AccountCheckResult>(
        WalletService.findAccountByWalletAddress(normalizedQuantaAddress, 100),
        ACCOUNT_COMPATIBILITY_TIMEOUT_MS,
        ACCOUNT_CHECK_TIMEOUT_RESULT,
        'quanta_account_compatibility_check'
      )
        .then((match) => {
          if (isCancelled) {
            return;
          }

          if (match && 'timedOut' in match) {
            setMatchedAccountIndex(null);
            setMatchedAccountAddresses(null);
            setAccountCheckError(ACCOUNT_CHECK_TIMEOUT_MESSAGE);
            setHasCheckedAddress(true);
            return;
          }

          setMatchedAccountIndex(match?.accountIndex ?? null);
          setMatchedAccountAddresses(match?.addresses ?? null);
          setAccountCheckError(match ? null : NO_MATCH_ACCOUNT_MESSAGE);
          setHasCheckedAddress(true);
        })
        .catch((error: unknown) => {
          if (isCancelled) {
            return;
          }
          logger.warn('[QuantaLinkScreen] Failed to check Quanta account compatibility', {
            error: error instanceof Error ? error.message : String(error),
          });
          setMatchedAccountIndex(null);
          setMatchedAccountAddresses(null);
          setAccountCheckError(ACCOUNT_CHECK_FAILURE_MESSAGE);
          setHasCheckedAddress(true);
        });
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [canCheckAddress, currentAccount, currentAddressMatches, normalizedQuantaAddress]);

  const getEnteredAddressAccount =
    React.useCallback(async (): Promise<WalletService.WalletAccountAddresses | null> => {
      if (!normalizedQuantaAddress) {
        return null;
      }

      if (matchedAccountIndex !== null) {
        const addresses =
          matchedAccountAddresses ?? (matchedAccountIndex === currentAccount ? wallet : null);

        if (addresses) {
          return {
            accountIndex: matchedAccountIndex,
            addresses,
          };
        }
      }

      const match = await WalletService.findAccountByWalletAddress(
        normalizedQuantaAddress,
        QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT
      );

      return match
        ? {
            accountIndex: match.accountIndex,
            addresses: match.addresses,
          }
        : null;
    }, [
      currentAccount,
      matchedAccountAddresses,
      matchedAccountIndex,
      normalizedQuantaAddress,
      wallet,
    ]);

  const discoverQuantaAccountCandidates = React.useCallback(async (): Promise<
    QuantaAccountCandidate[]
  > => {
    const normalizedTargetAddress = normalizedQuantaAddress.toLowerCase();
    const enteredAddressAccount = normalizedTargetAddress ? await getEnteredAddressAccount() : null;
    const accounts = enteredAddressAccount
      ? [enteredAddressAccount]
      : normalizedTargetAddress
        ? []
        : await WalletService.deriveWalletAccounts(QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT);
    const entries = accounts.flatMap(getAccountAddressEntries).sort((a, b) => {
      const aExact =
        normalizedTargetAddress.length > 0 && a.address.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      const bExact =
        normalizedTargetAddress.length > 0 && b.address.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      if (aExact !== bExact) {
        return aExact - bExact;
      }

      return sortAccountAddressEntries(a, b);
    });

    const results = await mapWithConcurrency(
      entries,
      QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY,
      async (entry) => {
        try {
          const status = await getQuantaMobileRewardStatus(
            {
              quantaAddress: entry.address,
              ...getQuantaWalletPayloadFromAddresses(entry.address, entry.addresses),
            },
            { storeConnectedAddress: false }
          );

          if (!status.user || !status.stats) {
            return null;
          }

          return {
            accountIndex: entry.accountIndex,
            addressType: entry.addressType,
            quantaAddress: entry.address,
            status,
            addresses: entry.addresses,
          } satisfies QuantaAccountCandidate;
        } catch (error: unknown) {
          logger.debug('[QuantaLinkScreen] Quanta account candidate check failed', {
            accountIndex: entry.accountIndex,
            addressType: entry.addressType,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }
    );

    const candidatesByAddress = new Map<string, QuantaAccountCandidate>();
    results.forEach((candidate) => {
      if (!candidate?.status.user) {
        return;
      }

      const key = `${candidate.status.user.user_id}:${candidate.quantaAddress.toLowerCase()}`;
      const existing = candidatesByAddress.get(key);
      const candidateIsExact =
        normalizedTargetAddress.length > 0 &&
        candidate.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 1
          : 0;
      const existingIsExact =
        normalizedTargetAddress.length > 0 &&
        existing?.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 1
          : 0;

      if (
        !existing ||
        candidateIsExact > existingIsExact ||
        getCandidatePoints(candidate) > getCandidatePoints(existing)
      ) {
        candidatesByAddress.set(key, candidate);
      }
    });

    const candidates = Array.from(candidatesByAddress.values()).sort((a, b) => {
      const aExact =
        normalizedTargetAddress.length > 0 &&
        a.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      const bExact =
        normalizedTargetAddress.length > 0 &&
        b.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      if (aExact !== bExact) {
        return aExact - bExact;
      }

      return sortAccountCandidates(a, b);
    });

    return candidates;
  }, [getEnteredAddressAccount, getQuantaWalletPayloadFromAddresses, normalizedQuantaAddress]);

  const handleSelectCandidate = React.useCallback((candidate: QuantaAccountCandidate) => {
    setSelectedCandidateKey(getCandidateKey(candidate));
  }, []);

  const markCandidateMatched = React.useCallback((candidate: QuantaAccountCandidate) => {
    setMatchedAccountIndex(candidate.accountIndex);
    setMatchedAccountAddresses(candidate.addresses);
    setHasCheckedAddress(true);
    setAccountCheckError(null);
  }, []);

  const resetAccountDiscovery = React.useCallback(() => {
    setMatchedAccountIndex(null);
    setMatchedAccountAddresses(null);
    setHasCheckedAddress(false);
    setAccountCheckError(null);
    setAccountCandidates([]);
    setSelectedCandidateKey(null);
  }, []);

  return {
    accountCandidates,
    accountCheckError,
    discoverQuantaAccountCandidates,
    handleSelectCandidate,
    hasCheckedAddress,
    isDiscoveringAccounts,
    markCandidateMatched,
    matchedAccountAddresses,
    matchedAccountIndex,
    resetAccountDiscovery,
    selectedCandidate,
    selectedCandidateKey,
    setAccountCandidates,
    setIsDiscoveringAccounts,
    setSelectedCandidateKey,
  };
}
