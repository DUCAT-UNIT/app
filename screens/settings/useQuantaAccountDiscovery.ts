import React from 'react';
import {
  getQuantaMobileRewardStatus,
  getQuantaMobileRewardStatuses,
} from '../../services/quantaRewardService';
import * as WalletService from '../../services/walletService';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  STANDARD_ACCOUNT_DERIVATION_MODE,
  UNISAT_WALLET_DERIVATION_MODE,
  getWalletProfileForDerivationMode,
  type WalletDerivationMode,
} from '../../constants/bitcoin';
import type { DerivedAddresses } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import {
  ACCOUNT_CHECK_FAILURE_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_RESULT,
  ACCOUNT_COMPATIBILITY_TIMEOUT_MS,
  NO_MATCH_ACCOUNT_MESSAGE,
  QUANTA_ACCOUNT_DISCOVERY_BATCH_SIZE,
  QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY,
  QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT,
  QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT,
  QUANTA_DISCOVERY_STATUS_CACHE_TTL_MS,
  QUANTA_DISCOVERY_STATUS_CIRCUIT_KEY,
  QUANTA_DISCOVERY_STATUS_TIMEOUT_MS,
  getAccountAddressEntries,
  getCandidateKey,
  getCandidatePoints,
  mapWithConcurrency,
  sortAccountAddressEntries,
  sortAccountCandidates,
  type AccountAddressEntry,
  type QuantaAccountCandidate,
  type QuantaMobileWalletPayload,
} from './quantaLinkUtils';

function getAddressEntryRequestId(entry: AccountAddressEntry): string {
  return `${entry.derivationMode}:${entry.accountIndex}:${entry.addressType}:${entry.address.toLowerCase()}`;
}

function getPrimaryQuantaAddressType(
  derivationMode: WalletDerivationMode
): AccountAddressEntry['addressType'] {
  return derivationMode === UNISAT_WALLET_DERIVATION_MODE ||
    derivationMode === STANDARD_ACCOUNT_DERIVATION_MODE
    ? 'taproot'
    : 'legacy';
}

function getQuantaDiscoveryDerivationModes(
  currentDerivationMode: WalletDerivationMode
): WalletDerivationMode[] {
  return Array.from(
    new Set([
      currentDerivationMode,
      DEFAULT_WALLET_DERIVATION_MODE,
      UNISAT_WALLET_DERIVATION_MODE,
      STANDARD_ACCOUNT_DERIVATION_MODE,
    ])
  );
}

interface UseQuantaAccountDiscoveryParams {
  canCheckAddress: boolean;
  currentAccount: number;
  currentAddressMatches: boolean;
  currentDerivationMode: WalletDerivationMode;
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
  discoverQuantaAccountCandidates: (signal?: AbortSignal) => Promise<QuantaAccountCandidate[]>;
  handleSelectCandidate: (candidate: QuantaAccountCandidate) => void;
  hasCheckedAddress: boolean;
  isDiscoveringAccounts: boolean;
  markCandidateMatched: (candidate: QuantaAccountCandidate) => void;
  matchedAccountAddresses: DerivedAddresses | null;
  matchedAccountDerivationMode: WalletDerivationMode | null;
  matchedAccountIndex: number | null;
  resetAccountDiscovery: () => void;
  selectedCandidate: QuantaAccountCandidate | undefined;
  selectedCandidateKey: string | null;
  setAccountCandidates: React.Dispatch<React.SetStateAction<QuantaAccountCandidate[]>>;
  setConnectedCompatibilityMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDiscoveringAccounts: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedCandidateKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useQuantaAccountDiscovery({
  canCheckAddress,
  currentAccount,
  currentAddressMatches,
  currentDerivationMode,
  getQuantaWalletPayloadFromAddresses,
  normalizedQuantaAddress,
  wallet,
}: UseQuantaAccountDiscoveryParams): UseQuantaAccountDiscoveryResult {
  const [matchedAccountIndex, setMatchedAccountIndex] = React.useState<number | null>(null);
  const [matchedAccountAddresses, setMatchedAccountAddresses] =
    React.useState<DerivedAddresses | null>(null);
  const [matchedAccountDerivationMode, setMatchedAccountDerivationMode] =
    React.useState<WalletDerivationMode | null>(null);
  const [hasCheckedAddress, setHasCheckedAddress] = React.useState(false);
  const [accountCheckError, setAccountCheckError] = React.useState<string | null>(null);
  const [accountCandidates, setAccountCandidates] = React.useState<QuantaAccountCandidate[]>([]);
  const [isDiscoveringAccounts, setIsDiscoveringAccounts] = React.useState(false);
  const [selectedCandidateKey, setSelectedCandidateKey] = React.useState<string | null>(null);
  const [connectedCompatibilityMode, setConnectedCompatibilityMode] = React.useState(false);
  const batchStatusUnavailableRef = React.useRef(false);

  const selectedCandidate = React.useMemo(
    () =>
      accountCandidates.find((candidate) => getCandidateKey(candidate) === selectedCandidateKey),
    [accountCandidates, selectedCandidateKey]
  );

  React.useEffect(() => {
    if (!canCheckAddress) {
      setMatchedAccountIndex(null);
      setMatchedAccountAddresses(null);
      setMatchedAccountDerivationMode(null);
      setHasCheckedAddress(false);
      setAccountCheckError(null);
      setAccountCandidates([]);
      setSelectedCandidateKey(null);
      return;
    }

    if (currentAddressMatches) {
      setMatchedAccountIndex(currentAccount);
      setMatchedAccountAddresses(null);
      setMatchedAccountDerivationMode(currentDerivationMode);
      setHasCheckedAddress(true);
      setAccountCheckError(null);
      setAccountCandidates([]);
      return;
    }

    if (connectedCompatibilityMode) {
      setMatchedAccountIndex(null);
      setMatchedAccountAddresses(null);
      setMatchedAccountDerivationMode(null);
      setHasCheckedAddress(true);
      setAccountCheckError(NO_MATCH_ACCOUNT_MESSAGE);
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
        WalletService.findAccountByWalletAddress(
          normalizedQuantaAddress,
          QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT
        ),
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
            setMatchedAccountDerivationMode(null);
            setAccountCheckError(ACCOUNT_CHECK_TIMEOUT_MESSAGE);
            setHasCheckedAddress(true);
            return;
          }

          setMatchedAccountIndex(match?.accountIndex ?? null);
          setMatchedAccountAddresses(match?.addresses ?? null);
          setMatchedAccountDerivationMode(match?.derivationMode ?? null);
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
          setMatchedAccountDerivationMode(null);
          setAccountCheckError(ACCOUNT_CHECK_FAILURE_MESSAGE);
          setHasCheckedAddress(true);
        });
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [
    canCheckAddress,
    connectedCompatibilityMode,
    currentAccount,
    currentAddressMatches,
    currentDerivationMode,
    normalizedQuantaAddress,
  ]);

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
            derivationMode: matchedAccountDerivationMode ?? DEFAULT_WALLET_DERIVATION_MODE,
            walletProfile: getWalletProfileForDerivationMode(
              matchedAccountDerivationMode ?? DEFAULT_WALLET_DERIVATION_MODE
            ),
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
            derivationMode: match.derivationMode,
            walletProfile: match.walletProfile,
            addresses: match.addresses,
          }
        : null;
    }, [
      currentAccount,
      matchedAccountAddresses,
      matchedAccountDerivationMode,
      matchedAccountIndex,
      normalizedQuantaAddress,
      wallet,
    ]);

  const discoverQuantaAccountCandidates = React.useCallback(
    async (signal?: AbortSignal): Promise<QuantaAccountCandidate[]> => {
      if (signal?.aborted) {
        return [];
      }

      const normalizedTargetAddress = normalizedQuantaAddress.toLowerCase();
      const enteredAddressAccount = normalizedTargetAddress
        ? await getEnteredAddressAccount()
        : null;
      if (signal?.aborted) {
        return [];
      }

      const accounts = enteredAddressAccount
        ? [enteredAddressAccount]
        : normalizedTargetAddress
          ? []
          : await WalletService.deriveWalletAccounts(
              QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT,
              getQuantaDiscoveryDerivationModes(currentDerivationMode)
            );
      if (signal?.aborted) {
        return [];
      }

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

      const normalizeCandidates = (
        results: Array<QuantaAccountCandidate | null>
      ): QuantaAccountCandidate[] => {
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

        return Array.from(candidatesByAddress.values()).sort((a, b) => {
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
      };

      const checkEntries = async (
        entriesToCheck: AccountAddressEntry[]
      ): Promise<QuantaAccountCandidate[]> => {
        if (entriesToCheck.length === 0) {
          return [];
        }

        const entryByRequestId = new Map(
          entriesToCheck.map((entry) => [getAddressEntryRequestId(entry), entry])
        );
        const batchRequestKey = `quanta-discovery-batch:${entriesToCheck
          .map(getAddressEntryRequestId)
          .join('|')}`;

        if (!batchStatusUnavailableRef.current) {
          try {
            const batchResult = await getQuantaMobileRewardStatuses(
              entriesToCheck.map((entry) => ({
                requestId: getAddressEntryRequestId(entry),
                quantaAddress: entry.address,
                ...getQuantaWalletPayloadFromAddresses(entry.address, entry.addresses),
              })),
              {
                storeConnectedAddress: false,
                dedupeKey: batchRequestKey,
                cacheKey: batchRequestKey,
                cacheTtlMs: QUANTA_DISCOVERY_STATUS_CACHE_TTL_MS,
                staleOnError: true,
                circuitKey: QUANTA_DISCOVERY_STATUS_CIRCUIT_KEY,
                timeout: QUANTA_DISCOVERY_STATUS_TIMEOUT_MS,
                signal,
              }
            );

            if (signal?.aborted) {
              return [];
            }

            return normalizeCandidates(
              batchResult.results.map((result) => {
                const entry = entryByRequestId.get(result.requestId);
                if (!entry || !result.status.user || !result.status.stats) {
                  return null;
                }

                return {
                  accountIndex: entry.accountIndex,
                  derivationMode: entry.derivationMode,
                  walletProfile: entry.walletProfile,
                  addressType: entry.addressType,
                  quantaAddress: entry.address,
                  status: result.status,
                  addresses: entry.addresses,
                } satisfies QuantaAccountCandidate;
              })
            );
          } catch (error: unknown) {
            if (signal?.aborted) {
              return [];
            }

            batchStatusUnavailableRef.current = true;
            logger.debug('[QuantaLinkScreen] Quanta account batch check failed; falling back', {
              entries: entriesToCheck.length,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const results = await mapWithConcurrency(
          entriesToCheck,
          QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY,
          async (entry) => {
            if (signal?.aborted) {
              return null;
            }

            try {
              const normalizedEntryAddress = entry.address.toLowerCase();
              const requestKey = `quanta-discovery:${normalizedEntryAddress}`;
              const status = await getQuantaMobileRewardStatus(
                {
                  quantaAddress: entry.address,
                  ...getQuantaWalletPayloadFromAddresses(entry.address, entry.addresses),
                },
                {
                  storeConnectedAddress: false,
                  dedupeKey: requestKey,
                  cacheKey: requestKey,
                  cacheTtlMs: QUANTA_DISCOVERY_STATUS_CACHE_TTL_MS,
                  staleOnError: true,
                  circuitKey: `${QUANTA_DISCOVERY_STATUS_CIRCUIT_KEY}:${normalizedEntryAddress}`,
                  timeout: QUANTA_DISCOVERY_STATUS_TIMEOUT_MS,
                  signal,
                }
              );

              if (signal?.aborted) {
                return null;
              }

              if (!status.user || !status.stats) {
                return null;
              }

              return {
                accountIndex: entry.accountIndex,
                derivationMode: entry.derivationMode,
                walletProfile: entry.walletProfile,
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

        return normalizeCandidates(results);
      };

      const priorityEntries = normalizedTargetAddress
        ? entries
        : entries.filter(
            (entry) =>
              entry.accountIndex === currentAccount &&
              entry.derivationMode === currentDerivationMode
          );
      const priorityKeys = new Set(priorityEntries.map(getAddressEntryRequestId));
      const primaryEntries = normalizedTargetAddress
        ? []
        : entries.filter(
            (entry) =>
              !priorityKeys.has(getAddressEntryRequestId(entry)) &&
              entry.addressType === getPrimaryQuantaAddressType(entry.derivationMode)
          );
      const primaryKeys = new Set(primaryEntries.map(getAddressEntryRequestId));
      const remainingEntries = normalizedTargetAddress
        ? []
        : entries.filter(
            (entry) =>
              !priorityKeys.has(getAddressEntryRequestId(entry)) &&
              !primaryKeys.has(getAddressEntryRequestId(entry))
          );
      const batches: AccountAddressEntry[][] = normalizedTargetAddress ? [entries] : [];

      if (!normalizedTargetAddress && priorityEntries.length > 0) {
        batches.push(priorityEntries);
      }

      for (
        let index = 0;
        index < primaryEntries.length;
        index += QUANTA_ACCOUNT_DISCOVERY_BATCH_SIZE
      ) {
        batches.push(primaryEntries.slice(index, index + QUANTA_ACCOUNT_DISCOVERY_BATCH_SIZE));
      }

      for (
        let index = 0;
        index < remainingEntries.length;
        index += QUANTA_ACCOUNT_DISCOVERY_BATCH_SIZE
      ) {
        batches.push(remainingEntries.slice(index, index + QUANTA_ACCOUNT_DISCOVERY_BATCH_SIZE));
      }

      let discoveredCandidates: QuantaAccountCandidate[] = [];
      for (const batch of batches) {
        if (signal?.aborted) {
          return discoveredCandidates;
        }

        if (batch.length === 0) {
          continue;
        }

        const batchCandidates = await checkEntries(batch);
        if (batchCandidates.length > 0) {
          discoveredCandidates = normalizeCandidates([...discoveredCandidates, ...batchCandidates]);
          setAccountCandidates(discoveredCandidates);
          setSelectedCandidateKey(
            (currentKey) => currentKey ?? getCandidateKey(discoveredCandidates[0]!)
          );
        }
      }

      return discoveredCandidates;
    },
    [
      currentAccount,
      currentDerivationMode,
      getEnteredAddressAccount,
      getQuantaWalletPayloadFromAddresses,
      normalizedQuantaAddress,
    ]
  );

  const handleSelectCandidate = React.useCallback((candidate: QuantaAccountCandidate) => {
    setSelectedCandidateKey(getCandidateKey(candidate));
  }, []);

  const markCandidateMatched = React.useCallback((candidate: QuantaAccountCandidate) => {
    setMatchedAccountIndex(candidate.accountIndex);
    setMatchedAccountAddresses(candidate.addresses);
    setMatchedAccountDerivationMode(candidate.derivationMode);
    setHasCheckedAddress(true);
    setAccountCheckError(null);
  }, []);

  const resetAccountDiscovery = React.useCallback(() => {
    setMatchedAccountIndex(null);
    setMatchedAccountAddresses(null);
    setMatchedAccountDerivationMode(null);
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
    matchedAccountDerivationMode,
    matchedAccountIndex,
    resetAccountDiscovery,
    selectedCandidate,
    selectedCandidateKey,
    setAccountCandidates,
    setConnectedCompatibilityMode,
    setIsDiscoveringAccounts,
    setSelectedCandidateKey,
  };
}
