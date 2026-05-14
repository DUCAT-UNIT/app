/**
 * QuantaLinkScreen Component
 * Minimal Quanta tab surface.
 */

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../../constants/bitcoin';
import { useAccountSwitcherContext } from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import type { RootNavigatorParamList } from '../../navigation/types';
import {
  claimQuantaMobileReward,
  clearStoredQuantaAddress,
  disconnectQuantaMobileReward,
  getQuantaMobileRewardStatus,
  getStoredQuantaAddress,
  type QuantaMobileMatchedAddressType,
  type QuantaRewardStatusResult,
} from '../../services/quantaRewardService';
import { setWalletDerivationMode } from '../../services/walletDerivationService';
import * as WalletService from '../../services/walletService';
import { COLORS } from '../../theme';
import { validateBitcoinAddress, type DerivedAddresses } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import { QuantaAccountPickerModal } from './QuantaAccountPickerModal';
import { QuantaMismatchWarningModal } from './QuantaMismatchWarningModal';
import { quantaLinkStyles as localStyles } from './quantaLinkStyles';
import { QUANTA_POINTS } from './quantaLinkAssets';
import {
  CheckCircleIcon,
  ErrorXIcon,
  StatusIconFrame,
  WarningTriangleIcon,
  AnimatedStars,
} from './quantaLinkVisuals';
import {
  ACCOUNT_CHECK_FAILURE_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_MESSAGE,
  ACCOUNT_CHECK_TIMEOUT_RESULT,
  ACCOUNT_COMPATIBILITY_TIMEOUT_MS,
  CONNECT_QUANTA_ERROR_MESSAGE,
  NO_MATCH_ACCOUNT_MESSAGE,
  QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY,
  QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT,
  QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT,
  QUANTA_ACCOUNT_PICKER_OPEN_DELAY_MS,
  formatAddressPreview,
  formatPoints,
  getAccountAddressEntries,
  getAddressTypeLabel,
  getCandidateKey,
  getCandidatePoints,
  getConnectedStatusFromClaim,
  getRewardAlertCopy,
  mapWithConcurrency,
  sortAccountAddressEntries,
  sortAccountCandidates,
  type QuantaAccountCandidate,
  type QuantaMobileWalletPayload,
} from './quantaLinkUtils';

interface QuantaLinkScreenProps {
  showBackButton?: boolean;
}

export default function QuantaLinkScreen({
  showBackButton = true,
}: QuantaLinkScreenProps): React.ReactElement {
  const navigation = useNavigation<NavigationProp<RootNavigatorParamList>>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { currentAccount, wallet } = useWallet();
  const { switchAccount: switchWholeAppAccount } = useAccountSwitcherContext();
  const [quantaAddress, setQuantaAddress] = React.useState('');
  const [isAddressFocused, setIsAddressFocused] = React.useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = React.useState(false);
  const [isClaimingReward, setIsClaimingReward] = React.useState(false);
  const [isDisconnectingReward, setIsDisconnectingReward] = React.useState(false);
  const [rewardStatus, setRewardStatus] = React.useState<QuantaRewardStatusResult | null>(null);
  const [showMismatchProceedModal, setShowMismatchProceedModal] = React.useState(false);
  const [showAccountPickerModal, setShowAccountPickerModal] = React.useState(false);
  const [accountPickerError, setAccountPickerError] = React.useState<string | null>(null);
  const [matchedAccountIndex, setMatchedAccountIndex] = React.useState<number | null>(null);
  const [matchedAccountAddresses, setMatchedAccountAddresses] =
    React.useState<DerivedAddresses | null>(null);
  const [hasCheckedAddress, setHasCheckedAddress] = React.useState(false);
  const [accountCheckError, setAccountCheckError] = React.useState<string | null>(null);
  const [accountCandidates, setAccountCandidates] = React.useState<QuantaAccountCandidate[]>([]);
  const [isDiscoveringAccounts, setIsDiscoveringAccounts] = React.useState(false);
  const [selectedCandidateKey, setSelectedCandidateKey] = React.useState<string | null>(null);
  const accountDiscoveryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenOffset = useSharedValue(0);
  const logoSize = Math.min(width * 0.58, 252);
  const topOffset = height * 0.05;
  const addressMaxLength = Math.max(Math.floor((width - 64) / 7.2), 14);
  const normalizedQuantaAddress = quantaAddress.trim();
  const addressValidation = normalizedQuantaAddress
    ? validateBitcoinAddress(normalizedQuantaAddress)
    : null;
  const addressValidationMessage =
    normalizedQuantaAddress.length === 0
      ? null
      : !addressValidation?.valid
        ? (addressValidation?.error ?? 'Enter a valid testnet Bitcoin address.')
        : addressValidation.type === 'unknown'
          ? 'Enter a valid Mutinynet wallet address.'
          : null;
  const canCheckAddress = normalizedQuantaAddress.length > 0 && addressValidationMessage === null;
  const currentWalletAddresses =
    matchedAccountIndex === currentAccount && matchedAccountAddresses
      ? matchedAccountAddresses
      : wallet;
  const normalizedWalletLegacyAddress = currentWalletAddresses?.legacyAddress?.toLowerCase();
  const normalizedWalletSegwitAddress = currentWalletAddresses?.segwitAddress.toLowerCase();
  const normalizedWalletTaprootAddress = currentWalletAddresses?.taprootAddress.toLowerCase();
  const normalizedQuantaWalletAddress = normalizedQuantaAddress.toLowerCase();
  const currentAddressMatchType: QuantaMobileMatchedAddressType | null =
    !!normalizedWalletLegacyAddress &&
    normalizedWalletLegacyAddress === normalizedQuantaWalletAddress
      ? 'legacy'
      : !!normalizedWalletSegwitAddress &&
          normalizedWalletSegwitAddress === normalizedQuantaWalletAddress
        ? 'segwit'
        : !!normalizedWalletTaprootAddress &&
            normalizedWalletTaprootAddress === normalizedQuantaWalletAddress
          ? 'taproot'
          : null;
  const currentAddressMatches = currentAddressMatchType !== null;
  const displayedWalletAddressType =
    addressValidation?.type === 'legacy'
      ? 'legacy'
      : addressValidation?.type === 'segwit'
        ? 'segwit'
        : 'taproot';
  const displayedWalletAddress =
    displayedWalletAddressType === 'legacy'
      ? (currentWalletAddresses?.legacyAddress ?? currentWalletAddresses?.taprootAddress)
      : displayedWalletAddressType === 'segwit'
        ? currentWalletAddresses?.segwitAddress
        : currentWalletAddresses?.taprootAddress;
  const displayedWalletAddressPreview = formatAddressPreview(
    displayedWalletAddress,
    addressMaxLength
  );
  const displayedWalletAddressLabel =
    displayedWalletAddressType === 'legacy'
      ? 'Current payment address:'
      : displayedWalletAddressType === 'segwit'
        ? 'Current native SegWit address:'
        : 'Current taproot address:';
  const getQuantaMobileWalletPayload = React.useCallback(
    (address?: string | null): QuantaMobileWalletPayload => {
      const normalizedAddress = address?.trim().toLowerCase();
      const matchedAddressType: QuantaMobileMatchedAddressType | null =
        normalizedAddress &&
        currentWalletAddresses?.legacyAddress?.toLowerCase() === normalizedAddress
          ? 'legacy'
          : normalizedAddress &&
              currentWalletAddresses?.segwitAddress.toLowerCase() === normalizedAddress
            ? 'segwit'
            : normalizedAddress &&
                currentWalletAddresses?.taprootAddress.toLowerCase() === normalizedAddress
              ? 'taproot'
              : null;

      const mobileWalletAddress =
        matchedAddressType === 'legacy'
          ? (currentWalletAddresses?.legacyAddress ?? null)
          : matchedAddressType === 'segwit'
            ? (currentWalletAddresses?.segwitAddress ?? null)
            : matchedAddressType === 'taproot'
              ? (currentWalletAddresses?.taprootAddress ?? null)
              : (currentWalletAddresses?.legacyAddress ??
                currentWalletAddresses?.taprootAddress ??
                currentWalletAddresses?.segwitAddress ??
                null);

      return {
        mobileWalletAddress,
        mobileLegacyAddress: currentWalletAddresses?.legacyAddress ?? null,
        mobileTaprootAddress: currentWalletAddresses?.taprootAddress ?? null,
        mobileSegwitAddress: currentWalletAddresses?.segwitAddress ?? null,
        matchedAddressType,
      };
    },
    [
      currentWalletAddresses?.legacyAddress,
      currentWalletAddresses?.segwitAddress,
      currentWalletAddresses?.taprootAddress,
    ]
  );
  const getQuantaWalletPayloadFromAddresses = React.useCallback(
    (address: string, addresses: DerivedAddresses): QuantaMobileWalletPayload => {
      const normalizedAddress = address.trim().toLowerCase();
      const matchedAddressType: QuantaMobileMatchedAddressType | null =
        addresses.legacyAddress?.toLowerCase() === normalizedAddress
          ? 'legacy'
          : addresses.segwitAddress.toLowerCase() === normalizedAddress
            ? 'segwit'
            : addresses.taprootAddress.toLowerCase() === normalizedAddress
              ? 'taproot'
              : null;

      const mobileWalletAddress =
        matchedAddressType === 'legacy'
          ? (addresses.legacyAddress ?? null)
          : matchedAddressType === 'segwit'
            ? addresses.segwitAddress
            : matchedAddressType === 'taproot'
              ? addresses.taprootAddress
              : (addresses.legacyAddress ?? addresses.taprootAddress ?? addresses.segwitAddress);

      return {
        mobileWalletAddress,
        mobileLegacyAddress: addresses.legacyAddress ?? null,
        mobileTaprootAddress: addresses.taprootAddress,
        mobileSegwitAddress: addresses.segwitAddress,
        matchedAddressType,
      };
    },
    []
  );
  const isCheckingAddress = canCheckAddress && !hasCheckedAddress;
  const hasAccountCheckFailure =
    canCheckAddress &&
    hasCheckedAddress &&
    matchedAccountIndex === null &&
    accountCheckError !== null &&
    accountCheckError !== NO_MATCH_ACCOUNT_MESSAGE;
  const matchedAccountIsCurrent = matchedAccountIndex === currentAccount;
  const hasAddressMismatch =
    canCheckAddress && hasCheckedAddress && matchedAccountIndex === null && !hasAccountCheckFailure;
  const hasMatchedDifferentAccount =
    canCheckAddress &&
    hasCheckedAddress &&
    matchedAccountIndex !== null &&
    !matchedAccountIsCurrent &&
    !currentAddressMatches;
  const hasMatchedCurrentAccount =
    canCheckAddress && hasCheckedAddress && (currentAddressMatches || matchedAccountIsCurrent);
  const hasInvalidEnteredAddress =
    normalizedQuantaAddress.length > 0 && addressValidationMessage !== null;
  const canConnectQuanta =
    !hasInvalidEnteredAddress &&
    !isDiscoveringAccounts &&
    !isSwitchingAccount &&
    !isClaimingReward &&
    !isDisconnectingReward;
  const isQuantaConnected = rewardStatus?.connected === true;
  const connectedPoints = rewardStatus?.stats?.total_points ?? 0;
  const connectedTasks = rewardStatus?.stats?.tasks_completed ?? 0;
  const connectedRank = rewardStatus?.stats?.rank ?? null;
  const connectedAddress = rewardStatus?.user?.test_net_wallet;
  const connectedRankLabel = connectedRank !== null ? `#${formatPoints(connectedRank)}` : '--';
  const hasVisibleStatus =
    !!addressValidationMessage ||
    isCheckingAddress ||
    hasAccountCheckFailure ||
    hasMatchedCurrentAccount ||
    hasMatchedDifferentAccount ||
    hasAddressMismatch ||
    isDiscoveringAccounts;
  const hasConnectedStatus =
    isCheckingAddress || hasAccountCheckFailure || hasMatchedDifferentAccount || hasAddressMismatch;
  const canShowAccountCandidates = false;
  const selectedCandidate = React.useMemo(
    () =>
      accountCandidates.find((candidate) => getCandidateKey(candidate) === selectedCandidateKey),
    [accountCandidates, selectedCandidateKey]
  );
  const accountPickerStatusText = normalizedQuantaAddress
    ? 'Checking this wallet account...'
    : 'Checking the first 20 wallet accounts...';

  React.useEffect(
    () => () => {
      if (accountDiscoveryTimerRef.current) {
        clearTimeout(accountDiscoveryTimerRef.current);
      }
    },
    []
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
      const aExact = normalizedTargetAddress
        ? a.address.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1
        : 1;
      const bExact = normalizedTargetAddress
        ? b.address.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1
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
        normalizedTargetAddress && candidate.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 1
          : 0;
      const existingIsExact =
        normalizedTargetAddress && existing?.quantaAddress.toLowerCase() === normalizedTargetAddress
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
        normalizedTargetAddress && a.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      const bExact =
        normalizedTargetAddress && b.quantaAddress.toLowerCase() === normalizedTargetAddress
          ? 0
          : 1;
      if (aExact !== bExact) {
        return aExact - bExact;
      }

      return sortAccountCandidates(a, b);
    });

    return candidates;
  }, [getEnteredAddressAccount, getQuantaWalletPayloadFromAddresses, normalizedQuantaAddress]);

  React.useEffect(() => {
    screenOffset.value = withTiming(isAddressFocused ? -height * 0.08 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [height, isAddressFocused, screenOffset]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: screenOffset.value }],
  }));

  const fetchQuantaRewardStatus = React.useCallback(
    async (
      preferredAddress?: string | null
    ): Promise<{ status: QuantaRewardStatusResult; displayAddress: string | null }> => {
      const storedAddress = preferredAddress ?? (await getStoredQuantaAddress());
      const status = await getQuantaMobileRewardStatus({
        quantaAddress: storedAddress,
        ...getQuantaMobileWalletPayload(storedAddress),
      });

      return {
        status,
        displayAddress: storedAddress ?? status.user?.test_net_wallet ?? null,
      };
    },
    [getQuantaMobileWalletPayload]
  );

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      fetchQuantaRewardStatus()
        .then(({ status, displayAddress }) => {
          if (!isActive) {
            return;
          }

          if (status.connected) {
            setRewardStatus(status);
          } else {
            setRewardStatus(null);
            clearStoredQuantaAddress().catch((error: unknown) => {
              logger.warn('[QuantaLinkScreen] Failed to clear stale Quanta link', {
                error: error instanceof Error ? error.message : String(error),
              });
            });
          }
          if (displayAddress) {
            setQuantaAddress(displayAddress);
          }
        })
        .catch((error: unknown) => {
          if (!isActive) {
            return;
          }

          logger.warn('[QuantaLinkScreen] Failed to load Quanta reward status', {
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return () => {
        isActive = false;
      };
    }, [fetchQuantaRewardStatus])
  );

  const handlePasteAddress = React.useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setQuantaAddress(text.trim());
    }
  }, []);

  const handleShowMismatchHelp = React.useCallback(() => {
    navigation.navigate('QuantaSeedPhraseGuide');
  }, [navigation]);

  const handleClaimQuantaReward = React.useCallback(
    async (candidate?: QuantaAccountCandidate) => {
      const claimAddress = candidate?.quantaAddress ?? normalizedQuantaAddress;
      const mobileWalletPayload = candidate
        ? getQuantaWalletPayloadFromAddresses(candidate.quantaAddress, candidate.addresses)
        : getQuantaMobileWalletPayload(claimAddress);

      if (isClaimingReward || !claimAddress || !mobileWalletPayload.mobileWalletAddress) {
        return;
      }

      setIsClaimingReward(true);
      if (candidate) {
        setShowAccountPickerModal(false);
      }

      try {
        const result = await claimQuantaMobileReward({
          quantaAddress: claimAddress,
          ...mobileWalletPayload,
          addressesMatch: candidate ? true : hasMatchedCurrentAccount,
        });
        const connectedStatus = getConnectedStatusFromClaim(result, candidate, claimAddress);
        const copy = candidate ? null : getRewardAlertCopy(result);
        setShowMismatchProceedModal(false);
        setShowAccountPickerModal(false);
        setRewardStatus(connectedStatus);
        setQuantaAddress(claimAddress);
        if (candidate) {
          setMatchedAccountIndex(candidate.accountIndex);
          setMatchedAccountAddresses(candidate.addresses);
          setHasCheckedAddress(true);
          setAccountCheckError(null);
        }

        try {
          const { status, displayAddress } = await fetchQuantaRewardStatus(claimAddress);
          setRewardStatus(status.connected ? status : connectedStatus);
          if (displayAddress) {
            setQuantaAddress(displayAddress);
          }
        } catch (statusError: unknown) {
          logger.warn('[QuantaLinkScreen] Failed to refresh Quanta reward status after claim', {
            error: statusError instanceof Error ? statusError.message : String(statusError),
          });
          setRewardStatus(connectedStatus);
        }

        if (copy) {
          Alert.alert(copy.title, copy.message);
        }
      } catch (error: unknown) {
        logger.warn('[QuantaLinkScreen] Failed to claim Quanta mobile reward', {
          error: error instanceof Error ? error.message : String(error),
        });
        Alert.alert(
          'Quanta connection failed',
          error instanceof Error ? error.message : CONNECT_QUANTA_ERROR_MESSAGE
        );
      } finally {
        setIsClaimingReward(false);
      }
    },
    [
      getQuantaMobileWalletPayload,
      getQuantaWalletPayloadFromAddresses,
      hasMatchedCurrentAccount,
      fetchQuantaRewardStatus,
      isClaimingReward,
      normalizedQuantaAddress,
    ]
  );

  const handleConnectQuanta = React.useCallback(() => {
    if (!canConnectQuanta) {
      return;
    }

    setShowAccountPickerModal(true);
    setAccountPickerError(null);
    setAccountCandidates([]);
    setSelectedCandidateKey(null);
    setIsDiscoveringAccounts(true);

    if (accountDiscoveryTimerRef.current) {
      clearTimeout(accountDiscoveryTimerRef.current);
    }

    accountDiscoveryTimerRef.current = setTimeout(() => {
      accountDiscoveryTimerRef.current = null;
      discoverQuantaAccountCandidates()
        .then((candidates) => {
          setAccountCandidates(candidates);
          setSelectedCandidateKey(candidates[0] ? getCandidateKey(candidates[0]) : null);

          if (candidates.length === 0) {
            setAccountPickerError(
              normalizedQuantaAddress
                ? 'No Quanta accounts were found for that wallet account.'
                : 'No Quanta accounts were found in the first 20 wallet accounts.'
            );
          }
        })
        .catch((error: unknown) => {
          logger.warn('[QuantaLinkScreen] Failed to load Quanta account picker', {
            error: error instanceof Error ? error.message : String(error),
          });
          setAccountCandidates([]);
          setSelectedCandidateKey(null);
          setAccountPickerError('Could not load Quanta accounts. Try again.');
        })
        .finally(() => {
          setIsDiscoveringAccounts(false);
        });
    }, QUANTA_ACCOUNT_PICKER_OPEN_DELAY_MS);
  }, [canConnectQuanta, discoverQuantaAccountCandidates, normalizedQuantaAddress]);

  const handleConfirmMismatchConnect = React.useCallback(() => {
    handleClaimQuantaReward().catch(() => undefined);
  }, [handleClaimQuantaReward]);

  const handleConfirmAccountPickerConnect = React.useCallback(() => {
    if (!selectedCandidate) {
      return;
    }

    handleClaimQuantaReward(selectedCandidate).catch(() => undefined);
  }, [handleClaimQuantaReward, selectedCandidate]);

  const switchToAccountIndex = React.useCallback(
    async (accountIndex: number) => {
      if (accountIndex === currentAccount || isSwitchingAccount) {
        return;
      }

      setIsSwitchingAccount(true);
      try {
        await setWalletDerivationMode(DEFAULT_WALLET_DERIVATION_MODE);
        await switchWholeAppAccount(accountIndex + 1);
      } catch (error: unknown) {
        logger.warn('[QuantaLinkScreen] Failed to switch account for Quanta address', {
          accountIndex,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSwitchingAccount(false);
      }
    },
    [currentAccount, isSwitchingAccount, switchWholeAppAccount]
  );

  const handleSwitchToMatchedAccount = React.useCallback(async () => {
    if (matchedAccountIndex === null) {
      return;
    }

    await switchToAccountIndex(matchedAccountIndex);
  }, [matchedAccountIndex, switchToAccountIndex]);

  const handleSelectCandidate = React.useCallback((candidate: QuantaAccountCandidate) => {
    setSelectedCandidateKey(getCandidateKey(candidate));
  }, []);

  const resetQuantaLinkState = React.useCallback(() => {
    setRewardStatus(null);
    setQuantaAddress('');
    setMatchedAccountIndex(null);
    setMatchedAccountAddresses(null);
    setHasCheckedAddress(false);
    setAccountCheckError(null);
    setAccountCandidates([]);
    setSelectedCandidateKey(null);
    setShowMismatchProceedModal(false);
    setShowAccountPickerModal(false);
    setAccountPickerError(null);
  }, []);

  const handleDisconnectQuanta = React.useCallback(() => {
    if (isDisconnectingReward) {
      return;
    }

    Alert.alert(
      'Disconnect Quanta?',
      'This removes the mobile app reward task and clears this device download record so you can connect again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setIsDisconnectingReward(true);
            disconnectQuantaMobileReward()
              .then((result) => {
                resetQuantaLinkState();
                Alert.alert(
                  'Quanta disconnected',
                  result.removed.task
                    ? 'The mobile reward was removed and this app is ready to connect again.'
                    : 'This app is ready to connect again.'
                );
              })
              .catch((error: unknown) => {
                logger.warn('[QuantaLinkScreen] Failed to disconnect Quanta reward', {
                  error: error instanceof Error ? error.message : String(error),
                });
                Alert.alert(
                  'Could not disconnect Quanta',
                  error instanceof Error ? error.message : 'Try again.'
                );
              })
              .finally(() => {
                setIsDisconnectingReward(false);
              });
          },
        },
      ]
    );
  }, [isDisconnectingReward, resetQuantaLinkState]);

  return (
    <ScreenLayout showBanner={false} style={localStyles.screen} testID="quanta-link-screen">
      <AnimatedStars />
      {showBackButton && (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={[localStyles.backButton, { top: Math.max(insets.top + 10, 18) }]}
          testID="quanta-back-button"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
      )}
      <Animated.View style={[localStyles.content, contentStyle]}>
        <View style={[localStyles.topHalf, { transform: [{ translateY: topOffset }] }]}>
          <Image
            source={QUANTA_POINTS}
            resizeMode="contain"
            style={{ width: logoSize, height: logoSize }}
            testID="quanta-white-logo"
          />
          {isQuantaConnected ? (
            <View style={localStyles.connectedTopSummary}>
              <View style={localStyles.connectedBadge}>
                <StatusIconFrame>
                  <CheckCircleIcon />
                </StatusIconFrame>
                <Text style={localStyles.connectedBadgeText}>Quanta connected</Text>
              </View>
              {connectedAddress && (
                <Text style={localStyles.connectedFullAddress} selectable>
                  {connectedAddress}
                </Text>
              )}
            </View>
          ) : (
            <React.Fragment>
              <Text style={localStyles.title} numberOfLines={1} adjustsFontSizeToFit>
                Connect Quanta
              </Text>
              <View style={localStyles.rewardChip}>
                <Image
                  source={QUANTA_POINTS}
                  resizeMode="contain"
                  style={localStyles.rewardIcon}
                  testID="quanta-reward-icon"
                />
                <Text style={localStyles.rewardText}>+10,000</Text>
              </View>
            </React.Fragment>
          )}
        </View>
        {isQuantaConnected ? (
          <View style={localStyles.bottomHalf}>
            <View style={localStyles.connectedSummary}>
              {hasConnectedStatus && (
                <View style={localStyles.connectedStatusSlot}>
                  {isCheckingAddress && (
                    <View style={localStyles.statusRow}>
                      <ActivityIndicator color={COLORS.TEXT_SECONDARY} size="small" />
                      <Text style={localStyles.checkingText}>
                        Checking account compatibility...
                      </Text>
                    </View>
                  )}
                  {hasAccountCheckFailure && (
                    <View style={localStyles.statusRow}>
                      <StatusIconFrame>
                        <ErrorXIcon />
                      </StatusIconFrame>
                      <Text style={localStyles.errorText} numberOfLines={2}>
                        {accountCheckError}
                      </Text>
                    </View>
                  )}
                  {hasMatchedDifferentAccount && (
                    <Pressable
                      accessibilityLabel="Switch to the account for this connected Quanta address"
                      accessibilityRole="button"
                      onPress={() => {
                        handleSwitchToMatchedAccount().catch(() => undefined);
                      }}
                      style={localStyles.accountSwitchBanner}
                      testID="quanta-connected-switch-account-banner"
                    >
                      <View style={localStyles.statusRow}>
                        <StatusIconFrame>
                          <WarningTriangleIcon />
                        </StatusIconFrame>
                        <Text style={localStyles.accountSwitchText} numberOfLines={2}>
                          {isSwitchingAccount
                            ? 'Switching account...'
                            : `Connected Quanta wallet is account ${
                                matchedAccountIndex + 1
                              }. Tap to switch.`}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                  {hasAddressMismatch && (
                    <Pressable
                      accessibilityLabel="Learn how to fix mismatched connected Quanta and mobile wallet addresses"
                      accessibilityRole="button"
                      onPress={handleShowMismatchHelp}
                      style={localStyles.mismatchHelpBanner}
                      testID="quanta-connected-mismatch-help-banner"
                    >
                      <View style={localStyles.statusRow}>
                        <StatusIconFrame>
                          <ErrorXIcon />
                        </StatusIconFrame>
                        <Text style={localStyles.errorText} numberOfLines={2}>
                          Connected Quanta address does not match this wallet.
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.ERROR} />
                      </View>
                    </Pressable>
                  )}
                </View>
              )}
              {hasConnectedStatus && (
                <View style={localStyles.connectedAddressBox}>
                  <Text style={localStyles.addressLabel}>{displayedWalletAddressLabel}</Text>
                  <Text style={localStyles.addressValue} numberOfLines={1} selectable>
                    {displayedWalletAddressPreview}
                  </Text>
                </View>
              )}
              <View style={localStyles.connectedMetric}>
                <View style={localStyles.connectedPointsRow}>
                  <Text
                    style={localStyles.connectedPointsValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatPoints(connectedPoints)}
                  </Text>
                  <Image
                    source={QUANTA_POINTS}
                    resizeMode="contain"
                    style={localStyles.connectedPointsIcon}
                  />
                </View>
                <Text style={localStyles.connectedMetricLabel}>Quanta Points</Text>
              </View>
              <View style={localStyles.connectedStatsGrid}>
                <View style={localStyles.connectedStatBlock}>
                  <Text style={localStyles.connectedStatValue}>{formatPoints(connectedTasks)}</Text>
                  <Text style={localStyles.connectedStatLabel}>Tasks Completed</Text>
                </View>
                <View style={localStyles.connectedStatDivider} />
                <View style={localStyles.connectedStatBlock}>
                  <Text style={localStyles.connectedStatValue}>{connectedRankLabel}</Text>
                  <Text style={localStyles.connectedStatLabel}>Ranking</Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Disconnect Quanta wallet"
                accessibilityRole="button"
                disabled={isDisconnectingReward}
                onPress={handleDisconnectQuanta}
                style={[
                  localStyles.disconnectButton,
                  isDisconnectingReward && localStyles.disconnectButtonDisabled,
                ]}
                testID="quanta-disconnect-button"
              >
                <Ionicons
                  name="log-out-outline"
                  size={17}
                  color={isDisconnectingReward ? COLORS.TEXT_SECONDARY : COLORS.ERROR}
                />
                <Text
                  style={[
                    localStyles.disconnectButtonText,
                    isDisconnectingReward && localStyles.disconnectButtonTextDisabled,
                  ]}
                >
                  {isDisconnectingReward ? 'Disconnecting...' : 'Disconnect wallet'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={localStyles.bottomHalf}>
            <View style={localStyles.statusSlot} pointerEvents={hasVisibleStatus ? 'auto' : 'none'}>
              {addressValidationMessage && (
                <View style={localStyles.statusRow}>
                  <StatusIconFrame>
                    <ErrorXIcon />
                  </StatusIconFrame>
                  <Text style={localStyles.errorText} numberOfLines={2}>
                    {addressValidationMessage}
                  </Text>
                </View>
              )}
              {isCheckingAddress && (
                <View style={localStyles.statusRow}>
                  <ActivityIndicator color={COLORS.TEXT_SECONDARY} size="small" />
                  <Text style={localStyles.checkingText}>Checking account compatibility...</Text>
                </View>
              )}
              {!isCheckingAddress && isDiscoveringAccounts && (
                <View style={localStyles.statusRow}>
                  <ActivityIndicator color={COLORS.TEXT_SECONDARY} size="small" />
                  <Text style={localStyles.checkingText}>
                    Finding Quanta accounts in this wallet...
                  </Text>
                </View>
              )}
              {!isDiscoveringAccounts && hasAccountCheckFailure && (
                <View style={localStyles.statusRow}>
                  <StatusIconFrame>
                    <ErrorXIcon />
                  </StatusIconFrame>
                  <Text style={localStyles.errorText} numberOfLines={2}>
                    {accountCheckError}
                  </Text>
                </View>
              )}
              {!isDiscoveringAccounts && hasMatchedCurrentAccount && (
                <View style={localStyles.statusRow}>
                  <StatusIconFrame>
                    <CheckCircleIcon />
                  </StatusIconFrame>
                  <Text style={localStyles.successText}>Addresses match</Text>
                </View>
              )}
              {!isDiscoveringAccounts && hasMatchedDifferentAccount && (
                <Pressable
                  accessibilityLabel="Switch to the account for this Quanta address"
                  accessibilityRole="button"
                  onPress={() => {
                    handleSwitchToMatchedAccount().catch(() => undefined);
                  }}
                  style={localStyles.accountSwitchBanner}
                  testID="quanta-switch-account-banner"
                >
                  <View style={localStyles.statusRow}>
                    <StatusIconFrame>
                      <WarningTriangleIcon />
                    </StatusIconFrame>
                    <Text style={localStyles.accountSwitchText} numberOfLines={2}>
                      {isSwitchingAccount
                        ? 'Switching account...'
                        : `Tap here to switch to the matching Quanta account ${
                            matchedAccountIndex + 1
                          }.`}
                    </Text>
                  </View>
                </Pressable>
              )}
              {!isDiscoveringAccounts && hasAddressMismatch && (
                <Pressable
                  accessibilityLabel="Learn how to fix mismatched Quanta and mobile wallet addresses"
                  accessibilityRole="button"
                  onPress={handleShowMismatchHelp}
                  style={localStyles.mismatchHelpBanner}
                  testID="quanta-mismatch-help-banner"
                >
                  <View style={localStyles.statusRow}>
                    <StatusIconFrame>
                      <ErrorXIcon />
                    </StatusIconFrame>
                    <Text style={localStyles.errorText} numberOfLines={2}>
                      {accountCheckError ?? 'Quanta address does not match the wallet address.'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.ERROR} />
                  </View>
                </Pressable>
              )}
            </View>
            {canShowAccountCandidates && (
              <View style={localStyles.candidatePanel}>
                <Text style={localStyles.candidatePanelTitle}>Available Quanta accounts</Text>
                {accountCandidates.slice(0, 4).map((candidate) => {
                  const candidateKey = getCandidateKey(candidate);
                  const isSelected = selectedCandidateKey === candidateKey;

                  return (
                    <Pressable
                      accessibilityLabel={`Select Quanta account ${candidate.accountIndex + 1}`}
                      accessibilityRole="button"
                      key={candidateKey}
                      onPress={() => {
                        handleSelectCandidate(candidate);
                      }}
                      style={[
                        localStyles.candidateRow,
                        isSelected && localStyles.candidateRowSelected,
                      ]}
                      testID={`quanta-account-candidate-${candidate.accountIndex + 1}`}
                    >
                      <View style={localStyles.candidateCopy}>
                        <Text style={localStyles.candidateTitle}>
                          Account {candidate.accountIndex + 1}
                        </Text>
                        <Text style={localStyles.candidateAddress} numberOfLines={1}>
                          {getAddressTypeLabel(candidate.addressType)} ·{' '}
                          {formatAddressPreview(candidate.quantaAddress, addressMaxLength)}
                        </Text>
                      </View>
                      <View style={localStyles.candidatePoints}>
                        <Text style={localStyles.candidatePointsText}>
                          {formatPoints(getCandidatePoints(candidate))}
                        </Text>
                        <Image
                          source={QUANTA_POINTS}
                          resizeMode="contain"
                          style={localStyles.candidatePointsIcon}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={localStyles.addressBox}>
              <Text style={localStyles.addressLabel}>{displayedWalletAddressLabel}</Text>
              <Text style={localStyles.addressValue} numberOfLines={1} selectable>
                {displayedWalletAddressPreview}
              </Text>
            </View>
            <View style={localStyles.addressBox}>
              <Text style={localStyles.addressLabel}>Enter your desktop Quanta address.</Text>
              <View style={localStyles.inputRow}>
                <TextInput
                  value={quantaAddress}
                  onChangeText={setQuantaAddress}
                  placeholder="2N or tb1..."
                  placeholderTextColor="rgba(255, 255, 255, 0.32)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance="dark"
                  onBlur={() => setIsAddressFocused(false)}
                  onFocus={() => setIsAddressFocused(true)}
                  returnKeyType="done"
                  selectionColor={COLORS.WHITE}
                  style={localStyles.addressInput}
                  testID="quanta-desktop-address-input"
                />
                <Pressable
                  accessibilityLabel="Paste Quanta address"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    handlePasteAddress().catch(() => undefined);
                  }}
                  style={localStyles.pasteButton}
                  testID="quanta-address-paste-button"
                >
                  <Ionicons name="clipboard-outline" size={20} color={COLORS.TEXT_PRIMARY} />
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Connect Quanta"
              accessibilityRole="button"
              disabled={!canConnectQuanta}
              onPress={handleConnectQuanta}
              style={[
                localStyles.connectButton,
                !canConnectQuanta && localStyles.connectButtonDisabled,
              ]}
              testID="quanta-connect-button"
            >
              <Text
                style={[
                  localStyles.connectButtonText,
                  !canConnectQuanta && localStyles.connectButtonTextDisabled,
                ]}
              >
                {isClaimingReward ? 'Connecting...' : 'Connect Quanta'}
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
      <QuantaAccountPickerModal
        accountCandidates={accountCandidates}
        accountPickerError={accountPickerError}
        accountPickerStatusText={accountPickerStatusText}
        addressMaxLength={addressMaxLength}
        isClaimingReward={isClaimingReward}
        isDiscoveringAccounts={isDiscoveringAccounts}
        onClose={() => setShowAccountPickerModal(false)}
        onConnectSelected={handleConfirmAccountPickerConnect}
        onSelectCandidate={handleSelectCandidate}
        selectedCandidate={selectedCandidate}
        selectedCandidateKey={selectedCandidateKey}
        visible={showAccountPickerModal}
      />
      <QuantaMismatchWarningModal
        isClaimingReward={isClaimingReward}
        onCancel={() => setShowMismatchProceedModal(false)}
        onProceed={handleConfirmMismatchConnect}
        visible={showMismatchProceedModal}
      />
    </ScreenLayout>
  );
}
