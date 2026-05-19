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
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PinFallbackModal from '../../components/auth/PinFallbackModal';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import { DEFAULT_WALLET_DERIVATION_MODE, type WalletDerivationMode } from '../../constants/bitcoin';
import { useAccountSwitcherContext } from '../../contexts/NavigationHandlersContext';
import { useWallet } from '../../contexts/WalletContext';
import type { RootNavigatorParamList } from '../../navigation/types';
import {
  claimQuantaMobileReward,
  disconnectQuantaMobileReward,
  preloadQuantaRewardInstallId,
  previewQuantaMobileRewardStatus,
  unifyQuantaAccounts,
  type QuantaMobileMatchedAddressType,
  type QuantaRewardStatusResult,
} from '../../services/quantaRewardService';
import { unlockSessionMnemonicWithPin } from '../../services/secureStorageService';
import { COLORS } from '../../theme';
import { validateBitcoinAddress, type DerivedAddresses } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { QuantaAccountPickerModal } from './QuantaAccountPickerModal';
import { QuantaAddressForm } from './QuantaAddressForm';
import { QuantaConnectedPanel } from './QuantaConnectedPanel';
import { QuantaMismatchWarningModal } from './QuantaMismatchWarningModal';
import { QuantaStatusBanner } from './QuantaStatusBanner';
import { loadQuantaDiscoveryCache, saveQuantaDiscoveryCache } from './quantaDiscoveryCache';
import { quantaLinkStyles as localStyles } from './quantaLinkStyles';
import { QUANTA_POINTS } from './quantaLinkAssets';
import {
  CheckCircleIcon,
  StatusIconFrame,
  AnimatedStars,
  WarningTriangleIcon,
} from './quantaLinkVisuals';
import {
  CONNECT_QUANTA_ERROR_MESSAGE,
  NO_MATCH_ACCOUNT_MESSAGE,
  QUANTA_DIFFERENT_WALLET_STATUS_TIMEOUT_MS,
  QUANTA_ADDRESS_NOT_FOUND_MESSAGE,
  QUANTA_SEARCH_START_DELAY_MS,
  QUANTA_WALLET_SEARCH_TIMEOUT_MS,
  formatAddressPreview,
  formatPoints,
  getCandidateKey,
  getConnectedStatusFromClaim,
  getRewardAlertCopy,
  type QuantaAccountCandidate,
  type QuantaMobileWalletPayload,
} from './quantaLinkUtils';
import { useQuantaAccountDiscovery } from './useQuantaAccountDiscovery';
import { useQuantaRewardStatus } from './useQuantaRewardStatus';

interface QuantaLinkScreenProps {
  showBackButton?: boolean;
}

type PendingQuantaUnlockAction = 'search';

function waitForSearchStart(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, QUANTA_SEARCH_START_DELAY_MS);
    (timer as { unref?: () => void }).unref?.();
  });
}

function isPasskeySessionLockedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Passkey wallet is locked');
}

export default function QuantaLinkScreen({
  showBackButton = true,
}: QuantaLinkScreenProps): React.ReactElement {
  const navigation = useNavigation<NavigationProp<RootNavigatorParamList>>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { currentAccount, wallet, walletDerivationMode } = useWallet();
  const { switchAccount: switchWholeAppAccount } = useAccountSwitcherContext();
  const [quantaAddress, setQuantaAddress] = React.useState('');
  const [isSwitchingAccount, setIsSwitchingAccount] = React.useState(false);
  const [isClaimingReward, setIsClaimingReward] = React.useState(false);
  const [isDisconnectingReward, setIsDisconnectingReward] = React.useState(false);
  const [isUnifyingAccounts, setIsUnifyingAccounts] = React.useState(false);
  const [hasUnifiedQuantaAccounts, setHasUnifiedQuantaAccounts] = React.useState(false);
  const [hasNoQuantaInWallet, setHasNoQuantaInWallet] = React.useState(false);
  const [isDifferentWalletMode, setIsDifferentWalletMode] = React.useState(false);
  const [isCheckingDifferentWallet, setIsCheckingDifferentWallet] = React.useState(false);
  const [differentWalletStatus, setDifferentWalletStatus] =
    React.useState<QuantaRewardStatusResult | null>(null);
  const [differentWalletError, setDifferentWalletError] = React.useState<string | null>(null);
  const [showMismatchProceedModal, setShowMismatchProceedModal] = React.useState(false);
  const [showAccountPickerModal, setShowAccountPickerModal] = React.useState(false);
  const [accountPickerError, setAccountPickerError] = React.useState<string | null>(null);
  const [showQuantaUnlockPin, setShowQuantaUnlockPin] = React.useState(false);
  const [quantaUnlockError, setQuantaUnlockError] = React.useState<string | null>(null);
  const [isUnlockingQuantaWallet, setIsUnlockingQuantaWallet] = React.useState(false);
  const searchRequestIdRef = React.useRef(0);
  const differentWalletCheckIdRef = React.useRef(0);
  const searchAbortControllerRef = React.useRef<AbortController | null>(null);
  const pendingQuantaUnlockActionRef = React.useRef<PendingQuantaUnlockAction | null>(null);
  const hydratedDiscoveryCacheKeyRef = React.useRef<string | null>(null);
  const logoSize = Math.min(width * (showBackButton ? 0.58 : 0.48), showBackButton ? 252 : 204);
  const topOffset = height * (showBackButton ? 0.05 : 0.015);
  const quantaBottomPadding = showBackButton
    ? Math.max(insets.bottom + 16, 24)
    : Math.max(insets.bottom + 88, 104);
  const addressMaxLength = Math.max(Math.floor((width - 64) / 7.2), 14);
  const normalizedQuantaAddress = quantaAddress.trim();
  const quantaDiscoveryWalletFingerprint =
    wallet?.taprootAddress ?? wallet?.segwitAddress ?? wallet?.legacyAddress ?? null;
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
  const normalizedWalletLegacyAddress = wallet?.legacyAddress?.toLowerCase();
  const normalizedWalletSegwitAddress = wallet?.segwitAddress.toLowerCase();
  const normalizedWalletTaprootAddress = wallet?.taprootAddress.toLowerCase();
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
  const {
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
    setIsDiscoveringAccounts,
    setSelectedCandidateKey,
  } = useQuantaAccountDiscovery({
    canCheckAddress: canCheckAddress && !isDifferentWalletMode,
    currentAccount,
    currentAddressMatches,
    currentDerivationMode: walletDerivationMode,
    getQuantaWalletPayloadFromAddresses,
    normalizedQuantaAddress,
    wallet,
  });
  const currentWalletAddresses =
    matchedAccountIndex === currentAccount &&
    (matchedAccountDerivationMode ?? walletDerivationMode) === walletDerivationMode &&
    matchedAccountAddresses
      ? matchedAccountAddresses
      : wallet;
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
  const { fetchQuantaRewardStatus, rewardStatus, setRewardStatus } = useQuantaRewardStatus({
    getQuantaMobileWalletPayload,
    onDisplayAddress: setQuantaAddress,
  });
  const discoveryCacheKey = React.useMemo(
    () =>
      [
        quantaDiscoveryWalletFingerprint ?? 'none',
        String(currentAccount),
        walletDerivationMode,
        normalizedQuantaAddress.toLowerCase(),
      ].join(':'),
    [
      currentAccount,
      normalizedQuantaAddress,
      quantaDiscoveryWalletFingerprint,
      walletDerivationMode,
    ]
  );
  const persistQuantaDiscoveryResult = React.useCallback(
    (
      candidates: QuantaAccountCandidate[],
      hasNoQuantaResult: boolean,
      selectedKey: string | null
    ) => {
      saveQuantaDiscoveryCache({
        accountIndex: currentAccount,
        candidates,
        derivationMode: walletDerivationMode,
        hasNoQuantaInWallet: hasNoQuantaResult,
        selectedCandidateKey: selectedKey,
        targetAddress: normalizedQuantaAddress,
        walletFingerprint: quantaDiscoveryWalletFingerprint,
      }).catch(() => undefined);
    },
    [
      currentAccount,
      normalizedQuantaAddress,
      quantaDiscoveryWalletFingerprint,
      walletDerivationMode,
    ]
  );
  const isCheckingAddress = canCheckAddress && !hasCheckedAddress;
  const hasAccountCheckFailure =
    canCheckAddress &&
    hasCheckedAddress &&
    matchedAccountIndex === null &&
    accountCheckError !== null &&
    accountCheckError !== NO_MATCH_ACCOUNT_MESSAGE;
  const matchedAccountIsCurrent =
    matchedAccountIndex === currentAccount &&
    (matchedAccountDerivationMode ?? walletDerivationMode) === walletDerivationMode;
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
  const canSearchQuanta =
    !isDiscoveringAccounts && !isSwitchingAccount && !isClaimingReward && !isDisconnectingReward;
  const isQuantaConnected = rewardStatus?.connected === true;
  const shouldPromptUnifyQuanta = isQuantaConnected && !hasUnifiedQuantaAccounts;
  const connectedPoints = rewardStatus?.stats?.total_points ?? 0;
  const connectedTasks = rewardStatus?.stats?.tasks_completed ?? 0;
  const connectedRank = rewardStatus?.stats?.rank ?? null;
  const connectedAddress = rewardStatus?.user?.test_net_wallet;
  const connectedRankLabel = connectedRank !== null ? `#${formatPoints(connectedRank)}` : '--';
  const differentWalletPoints =
    differentWalletStatus?.stats?.total_points ?? differentWalletStatus?.points ?? null;
  const differentWalletPointsLabel =
    differentWalletPoints !== null ? formatPoints(differentWalletPoints) : null;
  const differentWalletTasksLabel = differentWalletStatus?.stats
    ? formatPoints(differentWalletStatus.stats.tasks_completed)
    : null;
  const differentWalletDisplayError =
    isDifferentWalletMode && normalizedQuantaAddress.length > 0
      ? (addressValidationMessage ?? differentWalletError)
      : differentWalletError;
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
  const accountPickerStatusText = normalizedQuantaAddress
    ? 'Checking this wallet account...'
    : 'Checking the first 20 wallet accounts...';

  React.useEffect(
    () => () => {
      searchRequestIdRef.current += 1;
      differentWalletCheckIdRef.current += 1;
      searchAbortControllerRef.current?.abort();
      searchAbortControllerRef.current = null;
      pendingQuantaUnlockActionRef.current = null;
    },
    []
  );

  React.useEffect(() => {
    if (
      hydratedDiscoveryCacheKeyRef.current === discoveryCacheKey ||
      isQuantaConnected ||
      isDifferentWalletMode ||
      isDiscoveringAccounts
    ) {
      return undefined;
    }

    hydratedDiscoveryCacheKeyRef.current = discoveryCacheKey;
    let isCancelled = false;

    loadQuantaDiscoveryCache({
      accountIndex: currentAccount,
      derivationMode: walletDerivationMode,
      targetAddress: normalizedQuantaAddress,
      walletFingerprint: quantaDiscoveryWalletFingerprint,
    })
      .then((cached) => {
        if (isCancelled || !cached) {
          return;
        }

        setAccountCandidates(cached.candidates);
        setSelectedCandidateKey(
          cached.selectedCandidateKey ??
            (cached.candidates[0] ? getCandidateKey(cached.candidates[0]) : null)
        );
        setHasNoQuantaInWallet(cached.hasNoQuantaInWallet && cached.candidates.length === 0);
        setShowAccountPickerModal(cached.candidates.length > 0);
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [
    currentAccount,
    discoveryCacheKey,
    isDifferentWalletMode,
    isDiscoveringAccounts,
    isQuantaConnected,
    normalizedQuantaAddress,
    quantaDiscoveryWalletFingerprint,
    setAccountCandidates,
    setSelectedCandidateKey,
    walletDerivationMode,
  ]);

  React.useEffect(() => {
    preloadQuantaRewardInstallId().catch((error: unknown) => {
      logger.debug('[QuantaLinkScreen] Failed to preload Quanta install id', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, []);

  React.useEffect(() => {
    setHasUnifiedQuantaAccounts(false);
  }, [connectedAddress]);

  const handleShowMismatchHelp = React.useCallback(() => {
    navigation.navigate('QuantaSeedPhraseGuide');
  }, [navigation]);

  const handleStartDifferentWallet = React.useCallback(() => {
    searchRequestIdRef.current += 1;
    differentWalletCheckIdRef.current += 1;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    setIsDifferentWalletMode(true);
    setShowAccountPickerModal(false);
    setIsDiscoveringAccounts(false);
    setIsCheckingDifferentWallet(false);
    setQuantaAddress('');
    setDifferentWalletStatus(null);
    setDifferentWalletError(null);
    resetAccountDiscovery();
  }, [resetAccountDiscovery, setIsDiscoveringAccounts]);

  const handleChangeDifferentWalletAddress = React.useCallback((address: string) => {
    differentWalletCheckIdRef.current += 1;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    setQuantaAddress(address);
    setIsCheckingDifferentWallet(false);
    setDifferentWalletStatus(null);
    setDifferentWalletError(null);
  }, []);

  const handleBeginDifferentWalletCheck = React.useCallback(() => {
    logger.info('[QuantaLinkScreen] Different wallet check tap received');
    setIsCheckingDifferentWallet(true);
    setDifferentWalletError(null);
    setDifferentWalletStatus(null);
  }, []);

  const requestQuantaWalletUnlock = React.useCallback((action: PendingQuantaUnlockAction) => {
    pendingQuantaUnlockActionRef.current = action;
    setQuantaUnlockError(null);
    setShowQuantaUnlockPin(true);
  }, []);

  const switchToAccountIndex = React.useCallback(
    async (
      accountIndex: number,
      derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
    ) => {
      if (isSwitchingAccount) {
        return;
      }

      setIsSwitchingAccount(true);
      try {
        await switchWholeAppAccount(accountIndex + 1, {
          derivationMode,
        });
      } catch (error: unknown) {
        logger.warn('[QuantaLinkScreen] Failed to switch account for Quanta address', {
          accountIndex,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSwitchingAccount(false);
      }
    },
    [isSwitchingAccount, switchWholeAppAccount]
  );

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
        if (candidate) {
          await switchToAccountIndex(candidate.accountIndex, candidate.derivationMode);
        }

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
        setHasUnifiedQuantaAccounts(false);
        setQuantaAddress(claimAddress);
        if (candidate) {
          markCandidateMatched(candidate);
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
      markCandidateMatched,
      normalizedQuantaAddress,
      setRewardStatus,
      switchToAccountIndex,
    ]
  );

  const handleSearchQuanta = React.useCallback(() => {
    if (!canSearchQuanta) {
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    differentWalletCheckIdRef.current += 1;
    searchAbortControllerRef.current?.abort();
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;
    setHasNoQuantaInWallet(false);
    setIsDifferentWalletMode(false);
    setDifferentWalletStatus(null);
    setDifferentWalletError(null);
    setShowAccountPickerModal(true);
    setAccountPickerError(null);
    setAccountCandidates([]);
    setSelectedCandidateKey(null);
    setIsDiscoveringAccounts(true);

    const timeout = setTimeout(() => {
      controller.abort();
      logger.warn('[QuantaLinkScreen] Quanta wallet search timed out', {
        timeoutMs: QUANTA_WALLET_SEARCH_TIMEOUT_MS,
      });
    }, QUANTA_WALLET_SEARCH_TIMEOUT_MS);
    (timeout as { unref?: () => void }).unref?.();

    waitForSearchStart()
      .then(() => discoverQuantaAccountCandidates(controller.signal))
      .then((candidates) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setAccountCandidates(candidates);
        const nextSelectedCandidateKey = candidates[0] ? getCandidateKey(candidates[0]) : null;
        setSelectedCandidateKey(nextSelectedCandidateKey);
        persistQuantaDiscoveryResult(candidates, candidates.length === 0, nextSelectedCandidateKey);

        if (candidates.length === 0) {
          setShowAccountPickerModal(false);
          setHasNoQuantaInWallet(true);
          return;
        }
      })
      .catch((error: unknown) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        if (isPasskeySessionLockedError(error)) {
          setAccountCandidates([]);
          setSelectedCandidateKey(null);
          setShowAccountPickerModal(false);
          requestQuantaWalletUnlock('search');
          return;
        }

        logger.warn('[QuantaLinkScreen] Failed to search Quanta accounts', {
          error: error instanceof Error ? error.message : String(error),
        });
        setAccountCandidates([]);
        setSelectedCandidateKey(null);
        setShowAccountPickerModal(false);
        setHasNoQuantaInWallet(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        if (searchAbortControllerRef.current === controller) {
          searchAbortControllerRef.current = null;
        }
        setIsDiscoveringAccounts(false);
      });
  }, [
    canSearchQuanta,
    discoverQuantaAccountCandidates,
    persistQuantaDiscoveryResult,
    requestQuantaWalletUnlock,
    setAccountCandidates,
    setIsDiscoveringAccounts,
    setSelectedCandidateKey,
  ]);

  const handleQuantaUnlockPinSubmit = React.useCallback(
    async (pin: string): Promise<void> => {
      if (isUnlockingQuantaWallet) {
        return;
      }

      setIsUnlockingQuantaWallet(true);
      setQuantaUnlockError(null);

      try {
        await unlockSessionMnemonicWithPin(pin);
        const pendingAction = pendingQuantaUnlockActionRef.current;
        pendingQuantaUnlockActionRef.current = null;
        setShowQuantaUnlockPin(false);

        if (pendingAction === 'search') {
          requestAnimationFrame(() => {
            handleSearchQuanta();
          });
        }
      } catch (error: unknown) {
        logger.warn('[QuantaLinkScreen] Failed to unlock passkey wallet for Quanta lookup', {
          error: error instanceof Error ? error.message : String(error),
        });
        setQuantaUnlockError(
          error instanceof Error ? error.message : 'Could not unlock this wallet. Try again.'
        );
      } finally {
        setIsUnlockingQuantaWallet(false);
      }
    },
    [handleSearchQuanta, isUnlockingQuantaWallet]
  );

  const handleCancelQuantaUnlockPin = React.useCallback(() => {
    if (isUnlockingQuantaWallet) {
      return;
    }

    pendingQuantaUnlockActionRef.current = null;
    setShowQuantaUnlockPin(false);
    setQuantaUnlockError(null);
  }, [isUnlockingQuantaWallet]);

  const handleCheckDifferentWallet = React.useCallback(() => {
    if (isClaimingReward || normalizedQuantaAddress.length === 0) {
      if (normalizedQuantaAddress.length === 0) {
        setIsCheckingDifferentWallet(false);
      }
      return;
    }

    if (addressValidationMessage) {
      setDifferentWalletStatus(null);
      setDifferentWalletError(addressValidationMessage);
      setIsCheckingDifferentWallet(false);
      return;
    }

    const requestAddress = normalizedQuantaAddress;
    const requestId = differentWalletCheckIdRef.current + 1;
    differentWalletCheckIdRef.current = requestId;
    setIsCheckingDifferentWallet(true);
    setDifferentWalletError(null);
    setDifferentWalletStatus(null);

    const startedAt = Date.now();
    logger.info('[QuantaLinkScreen] Different wallet preview started', {
      addressPrefix: requestAddress.slice(0, 6),
    });

    const timer = setTimeout(() => {
      previewQuantaMobileRewardStatus(
        {
          quantaAddress: requestAddress,
          ...getQuantaMobileWalletPayload(requestAddress),
        },
        {
          timeout: QUANTA_DIFFERENT_WALLET_STATUS_TIMEOUT_MS,
        }
      )
        .then((status) => {
          if (differentWalletCheckIdRef.current !== requestId) {
            return;
          }

          logger.info('[QuantaLinkScreen] Different wallet preview finished', {
            durationMs: Date.now() - startedAt,
          });

          if (!status.user || !status.stats) {
            setDifferentWalletError(QUANTA_ADDRESS_NOT_FOUND_MESSAGE);
            return;
          }

          setDifferentWalletStatus(status);
        })
        .catch((error: unknown) => {
          if (differentWalletCheckIdRef.current !== requestId) {
            return;
          }

          logger.warn('[QuantaLinkScreen] Failed to check different Quanta wallet', {
            error: error instanceof Error ? error.message : String(error),
          });
          setDifferentWalletError('Could not check this Quanta wallet. Try again.');
        })
        .finally(() => {
          if (differentWalletCheckIdRef.current === requestId) {
            setIsCheckingDifferentWallet(false);
          }
        });
    }, 120);
    (timer as { unref?: () => void }).unref?.();
  }, [
    addressValidationMessage,
    getQuantaMobileWalletPayload,
    isClaimingReward,
    normalizedQuantaAddress,
  ]);

  const handleConnectDifferentWallet = React.useCallback(() => {
    if (!differentWalletStatus?.user || !normalizedQuantaAddress) {
      return;
    }

    setShowMismatchProceedModal(true);
  }, [differentWalletStatus?.user, normalizedQuantaAddress]);

  const handleConfirmMismatchConnect = React.useCallback(() => {
    handleClaimQuantaReward().catch(() => undefined);
  }, [handleClaimQuantaReward]);

  const handleConfirmAccountPickerConnect = React.useCallback(() => {
    if (!selectedCandidate) {
      return;
    }

    handleClaimQuantaReward(selectedCandidate).catch(() => undefined);
  }, [handleClaimQuantaReward, selectedCandidate]);

  const handleCloseAccountPicker = React.useCallback(() => {
    searchRequestIdRef.current += 1;
    differentWalletCheckIdRef.current += 1;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    setShowAccountPickerModal(false);
    setIsDiscoveringAccounts(false);
  }, [setIsDiscoveringAccounts]);

  const handleSwitchToMatchedAccount = React.useCallback(async () => {
    if (matchedAccountIndex === null) {
      return;
    }

    await switchToAccountIndex(
      matchedAccountIndex,
      matchedAccountDerivationMode ?? DEFAULT_WALLET_DERIVATION_MODE
    );
  }, [matchedAccountDerivationMode, matchedAccountIndex, switchToAccountIndex]);

  const resetQuantaLinkState = React.useCallback(() => {
    searchRequestIdRef.current += 1;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    setRewardStatus(null);
    setHasUnifiedQuantaAccounts(false);
    setQuantaAddress('');
    resetAccountDiscovery();
    setHasNoQuantaInWallet(false);
    setIsDifferentWalletMode(false);
    setIsCheckingDifferentWallet(false);
    setDifferentWalletStatus(null);
    setDifferentWalletError(null);
    setShowMismatchProceedModal(false);
    setShowAccountPickerModal(false);
    setAccountPickerError(null);
    pendingQuantaUnlockActionRef.current = null;
    setShowQuantaUnlockPin(false);
    setQuantaUnlockError(null);
    setIsUnlockingQuantaWallet(false);
  }, [resetAccountDiscovery, setRewardStatus]);

  const handleUnifyQuantaAccounts = React.useCallback(async () => {
    if (isUnifyingAccounts || !isQuantaConnected) {
      return;
    }

    if (!connectedAddress || !currentWalletAddresses) {
      Alert.alert('Could not unify Quanta', 'Connected wallet details are not available yet.');
      return;
    }

    const mobileWalletPayload = getQuantaMobileWalletPayload(connectedAddress);
    if (!mobileWalletPayload.mobileWalletAddress) {
      Alert.alert('Could not unify Quanta', 'Mobile wallet address is missing.');
      return;
    }

    setIsUnifyingAccounts(true);
    try {
      const result = await unifyQuantaAccounts({
        quantaAddress: connectedAddress,
        ...mobileWalletPayload,
        accountIndex: matchedAccountIndex ?? currentAccount,
        derivationMode: matchedAccountDerivationMode ?? walletDerivationMode,
      });

      setHasUnifiedQuantaAccounts(true);

      try {
        const { status, displayAddress } = await fetchQuantaRewardStatus(
          result.canonical_wallet_address || connectedAddress
        );
        if (status.connected) {
          setRewardStatus(status);
        }
        if (displayAddress) {
          setQuantaAddress(displayAddress);
        }
      } catch (statusError: unknown) {
        logger.warn('[QuantaLinkScreen] Failed to refresh Quanta reward status after unify', {
          error: statusError instanceof Error ? statusError.message : String(statusError),
        });
      }
    } catch (error: unknown) {
      logger.warn('[QuantaLinkScreen] Failed to unify Quanta accounts', {
        error: error instanceof Error ? error.message : String(error),
      });
      Alert.alert('Could not unify Quanta', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsUnifyingAccounts(false);
    }
  }, [
    connectedAddress,
    currentAccount,
    currentWalletAddresses,
    fetchQuantaRewardStatus,
    getQuantaMobileWalletPayload,
    isQuantaConnected,
    isUnifyingAccounts,
    matchedAccountDerivationMode,
    matchedAccountIndex,
    setRewardStatus,
    walletDerivationMode,
  ]);

  const handleDisconnectQuanta = React.useCallback(() => {
    if (isDisconnectingReward) {
      return;
    }

    Alert.alert(
      'Disconnect Quanta?',
      'This clears this device connection so you can connect again. Already-awarded Quanta points stay on the account.',
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
                    : 'This app is ready to connect again. Existing Quanta points were preserved.'
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
      <View style={localStyles.content}>
        <View
          style={[
            localStyles.topHalf,
            !showBackButton && localStyles.tabTopHalf,
            { transform: [{ translateY: topOffset }] },
          ]}
        >
          <Image
            source={QUANTA_POINTS}
            resizeMode="contain"
            style={{ width: logoSize, height: logoSize }}
            testID="quanta-white-logo"
          />
          {isQuantaConnected ? (
            <View style={localStyles.connectedTopSummary}>
              <Pressable
                accessibilityLabel={
                  shouldPromptUnifyQuanta ? 'Unify Quanta accounts' : 'Quanta connected'
                }
                accessibilityRole={shouldPromptUnifyQuanta ? 'button' : 'text'}
                disabled={!shouldPromptUnifyQuanta || isUnifyingAccounts}
                onPress={handleUnifyQuantaAccounts}
                style={[
                  localStyles.connectedBadge,
                  shouldPromptUnifyQuanta && localStyles.connectedBadgeWarning,
                  isUnifyingAccounts && { opacity: 0.72 },
                ]}
                testID="quanta-connected-status-chip"
              >
                <StatusIconFrame>
                  {isUnifyingAccounts ? (
                    <ActivityIndicator color={COLORS.YELLOW} size="small" />
                  ) : shouldPromptUnifyQuanta ? (
                    <WarningTriangleIcon />
                  ) : (
                    <CheckCircleIcon />
                  )}
                </StatusIconFrame>
                <Text
                  style={[
                    localStyles.connectedBadgeText,
                    shouldPromptUnifyQuanta && localStyles.connectedBadgeWarningText,
                  ]}
                >
                  {isUnifyingAccounts
                    ? 'Unifying Quanta accounts...'
                    : shouldPromptUnifyQuanta
                      ? 'Click to unify Quanta accounts'
                      : 'Quanta connected'}
                </Text>
              </Pressable>
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
          <QuantaConnectedPanel
            connectedPoints={connectedPoints}
            connectedRankLabel={connectedRankLabel}
            connectedTasks={connectedTasks}
            displayedWalletAddressLabel={displayedWalletAddressLabel}
            displayedWalletAddressPreview={displayedWalletAddressPreview}
            isDisconnectingReward={isDisconnectingReward}
            onDisconnect={handleDisconnectQuanta}
            showAddressBox={hasConnectedStatus && !hasAddressMismatch}
            statusBanner={
              <QuantaStatusBanner
                accountCheckError={accountCheckError}
                hasAccountCheckFailure={hasAccountCheckFailure}
                hasAddressMismatch={hasAddressMismatch}
                hasMatchedDifferentAccount={hasMatchedDifferentAccount}
                isCheckingAddress={isCheckingAddress}
                isSwitchingAccount={isSwitchingAccount}
                matchedAccountIndex={matchedAccountIndex}
                onSwitchToMatchedAccount={() => {
                  handleSwitchToMatchedAccount().catch(() => undefined);
                }}
                variant="connected"
                visible={hasConnectedStatus}
              />
            }
          />
        ) : (
          <QuantaAddressForm
            accountCandidates={accountCandidates}
            addressMaxLength={addressMaxLength}
            bottomPadding={quantaBottomPadding}
            canSearchQuanta={canSearchQuanta}
            canShowAccountCandidates={canShowAccountCandidates}
            compactLayout={!showBackButton}
            displayedWalletAddressLabel={displayedWalletAddressLabel}
            displayedWalletAddressPreview={displayedWalletAddressPreview}
            differentWalletAddress={quantaAddress}
            differentWalletError={differentWalletDisplayError}
            differentWalletMode={isDifferentWalletMode}
            differentWalletPointsLabel={differentWalletPointsLabel}
            differentWalletTasksLabel={differentWalletTasksLabel}
            hasNoQuantaInWallet={hasNoQuantaInWallet}
            isCheckingDifferentWallet={isCheckingDifferentWallet}
            isClaimingReward={isClaimingReward}
            isDiscoveringAccounts={isDiscoveringAccounts}
            onBeginDifferentWalletCheck={handleBeginDifferentWalletCheck}
            onChangeDifferentWalletAddress={handleChangeDifferentWalletAddress}
            onCheckDifferentWallet={handleCheckDifferentWallet}
            onConnectDifferentWallet={handleConnectDifferentWallet}
            onSelectCandidate={handleSelectCandidate}
            onSearchQuanta={handleSearchQuanta}
            onShowRestoreGuide={handleShowMismatchHelp}
            onStartDifferentWallet={handleStartDifferentWallet}
            selectedCandidateKey={selectedCandidateKey}
            showCurrentAddressBox={!hasAddressMismatch && !hasMatchedDifferentAccount}
            statusBanner={
              <QuantaStatusBanner
                accountCheckError={accountCheckError}
                addressValidationMessage={addressValidationMessage}
                hasAccountCheckFailure={hasAccountCheckFailure}
                hasAddressMismatch={hasAddressMismatch}
                hasMatchedCurrentAccount={hasMatchedCurrentAccount}
                hasMatchedDifferentAccount={hasMatchedDifferentAccount}
                isCheckingAddress={isCheckingAddress}
                isDiscoveringAccounts={isDiscoveringAccounts}
                isSwitchingAccount={isSwitchingAccount}
                matchedAccountIndex={matchedAccountIndex}
                onSwitchToMatchedAccount={() => {
                  handleSwitchToMatchedAccount().catch(() => undefined);
                }}
                variant="form"
                visible={hasVisibleStatus}
              />
            }
          />
        )}
      </View>
      <QuantaAccountPickerModal
        accountCandidates={accountCandidates}
        accountPickerError={accountPickerError}
        accountPickerStatusText={accountPickerStatusText}
        addressMaxLength={addressMaxLength}
        isClaimingReward={isClaimingReward}
        isDiscoveringAccounts={isDiscoveringAccounts}
        onClose={handleCloseAccountPicker}
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
      <PinFallbackModal
        busy={isUnlockingQuantaWallet}
        error={quantaUnlockError}
        message="Enter your wallet PIN, then approve the passkey prompt so Ducat can scan your Quanta addresses."
        onCancel={handleCancelQuantaUnlockPin}
        onSubmit={handleQuantaUnlockPinSubmit}
        title="Unlock wallet"
        visible={showQuantaUnlockPin}
      />
    </ScreenLayout>
  );
}
