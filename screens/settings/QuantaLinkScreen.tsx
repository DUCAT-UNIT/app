/**
 * QuantaLinkScreen Component
 * Minimal Quanta tab surface.
 */

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
  type QuantaRewardClaimResult,
  type QuantaRewardStatusResult,
} from '../../services/quantaRewardService';
import { setWalletDerivationMode } from '../../services/walletDerivationService';
import * as WalletService from '../../services/walletService';
import type { WalletAddressMatchType } from '../../services/walletService';
import { COLORS } from '../../theme';
import { validateBitcoinAddress, type DerivedAddresses } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';

const QUANTA_POINTS = require('../../assets/logos/quanta-points.png');
const ACCOUNT_COMPATIBILITY_TIMEOUT_MS = 5000;
const ACCOUNT_CHECK_TIMEOUT_RESULT = { timedOut: true } as const;
const NO_MATCH_ACCOUNT_MESSAGE =
  'No matching Quanta account found in the first 100 wallet accounts.';
const ACCOUNT_CHECK_TIMEOUT_MESSAGE = 'Account compatibility check timed out. Try again.';
const ACCOUNT_CHECK_FAILURE_MESSAGE = 'Could not check wallet accounts. Try again.';
const CONNECT_QUANTA_ERROR_MESSAGE = 'Could not connect Quanta. Try again.';
const QUANTA_ACCOUNT_MATCH_SEARCH_LIMIT = 100;
const QUANTA_ACCOUNT_PICKER_DEFAULT_ACCOUNT_LIMIT = 20;
const QUANTA_ACCOUNT_DISCOVERY_CONCURRENCY = 6;
const QUANTA_ACCOUNT_PICKER_OPEN_DELAY_MS = 80;
const STAR_POINTS = [
  { x: '4%', y: '9%', size: 2, opacity: 0.2 },
  { x: '10%', y: '18%', size: 2, opacity: 0.28 },
  { x: '13%', y: '36%', size: 1.5, opacity: 0.34 },
  { x: '18%', y: '55%', size: 4, opacity: 0.82 },
  { x: '20%', y: '7%', size: 2, opacity: 0.44 },
  { x: '23%', y: '67%', size: 1.5, opacity: 0.28 },
  { x: '28%', y: '28%', size: 2, opacity: 0.42 },
  { x: '31%', y: '48%', size: 2, opacity: 0.24 },
  { x: '37%', y: '13%', size: 3, opacity: 0.68 },
  { x: '39%', y: '72%', size: 2, opacity: 0.42 },
  { x: '43%', y: '6%', size: 1.5, opacity: 0.3 },
  { x: '47%', y: '43%', size: 2, opacity: 0.24 },
  { x: '51%', y: '61%', size: 3, opacity: 0.52 },
  { x: '58%', y: '24%', size: 2, opacity: 0.44 },
  { x: '60%', y: '11%', size: 1.5, opacity: 0.28 },
  { x: '63%', y: '36%', size: 2, opacity: 0.34 },
  { x: '68%', y: '60%', size: 2, opacity: 0.38 },
  { x: '71%', y: '78%', size: 3, opacity: 0.5 },
  { x: '76%', y: '18%', size: 4, opacity: 0.86 },
  { x: '79%', y: '51%', size: 1.5, opacity: 0.28 },
  { x: '84%', y: '39%', size: 2, opacity: 0.3 },
  { x: '87%', y: '8%', size: 2, opacity: 0.5 },
  { x: '91%', y: '68%', size: 3, opacity: 0.58 },
  { x: '94%', y: '25%', size: 1.5, opacity: 0.26 },
  { x: '7%', y: '73%', size: 2, opacity: 0.4 },
  { x: '21%', y: '79%', size: 3, opacity: 0.58 },
  { x: '33%', y: '88%', size: 1.5, opacity: 0.28 },
  { x: '54%', y: '82%', size: 2, opacity: 0.34 },
  { x: '66%', y: '91%', size: 1.5, opacity: 0.3 },
  { x: '82%', y: '87%', size: 2, opacity: 0.38 },
  { x: '95%', y: '91%', size: 2, opacity: 0.24 },
] as const;

interface QuantaLinkScreenProps {
  showBackButton?: boolean;
}

interface QuantaMobileWalletPayload {
  mobileWalletAddress: string | null;
  mobileLegacyAddress: string | null;
  mobileTaprootAddress: string | null;
  mobileSegwitAddress: string | null;
  matchedAddressType: QuantaMobileMatchedAddressType | null;
}

interface QuantaAccountCandidate {
  accountIndex: number;
  addressType: WalletAddressMatchType;
  quantaAddress: string;
  status: QuantaRewardStatusResult;
  addresses: DerivedAddresses;
}

interface AccountAddressEntry {
  accountIndex: number;
  addressType: WalletAddressMatchType;
  address: string;
  addresses: DerivedAddresses;
}

function formatAddressPreview(address: string | undefined, maxLength: number): string {
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

function AnimatedStars(): React.ReactElement {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 9000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [progress]);

  const starsStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + progress.value * 0.2,
    transform: [{ translateY: progress.value * -10 }, { translateX: progress.value * 5 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[localStyles.starsLayer, starsStyle]}>
      {STAR_POINTS.map((star, index) => (
        <View
          key={`${star.x}-${star.y}-${index}`}
          style={[
            localStyles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function WarningTriangleIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M9 1L17 16H1L9 1Z" fill={COLORS.YELLOW} />
      <Path d="M9 6V10" stroke={COLORS.TEXT_BLACK} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={9} cy={13} r={1} fill={COLORS.TEXT_BLACK} />
    </Svg>
  );
}

function CheckCircleIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.SUCCESS_GREEN} />
      <Path
        d="M5 9L7.6 11.6L13 6.2"
        stroke={COLORS.WHITE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ErrorXIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.DANGER_RED} />
      <Path d="M6 6L12 12M12 6L6 12" stroke={COLORS.WHITE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function StatusIconFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={localStyles.statusIconFrame}>{children}</View>;
}

function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

function getAddressTypeLabel(addressType: WalletAddressMatchType): string {
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

function getCandidateKey(candidate: QuantaAccountCandidate): string {
  return `${candidate.accountIndex}:${candidate.addressType}:${candidate.quantaAddress.toLowerCase()}`;
}

function getCandidatePoints(candidate: QuantaAccountCandidate): number {
  return candidate.status.stats?.total_points ?? candidate.status.points ?? 0;
}

function sortAccountAddressEntries(a: AccountAddressEntry, b: AccountAddressEntry): number {
  if (a.accountIndex !== b.accountIndex) {
    return a.accountIndex - b.accountIndex;
  }

  return getAddressTypeSortRank(a.addressType) - getAddressTypeSortRank(b.addressType);
}

function sortAccountCandidates(a: QuantaAccountCandidate, b: QuantaAccountCandidate): number {
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

function getAccountAddressEntries(
  account: WalletService.WalletAccountAddresses
): AccountAddressEntry[] {
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

async function mapWithConcurrency<T, R>(
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

function getRewardAlertCopy(result: QuantaRewardClaimResult): { title: string; message: string } {
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

function getConnectedStatusFromClaim(
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
      <Modal
        animationType="fade"
        onRequestClose={() => setShowAccountPickerModal(false)}
        transparent
        visible={showAccountPickerModal}
      >
        <Pressable
          accessibilityLabel="Dismiss Quanta account picker"
          onPress={() => setShowAccountPickerModal(false)}
          style={localStyles.accountPickerBackdrop}
        >
          <Pressable
            accessibilityRole="menu"
            onPress={(event) => event.stopPropagation()}
            style={localStyles.accountPickerCard}
            testID="quanta-account-picker-modal"
          >
            <View style={localStyles.accountPickerHeader}>
              <View style={localStyles.accountPickerIconFrame}>
                <Image
                  source={QUANTA_POINTS}
                  resizeMode="contain"
                  style={localStyles.accountPickerIcon}
                />
              </View>
              <View style={localStyles.accountPickerHeaderCopy}>
                <Text style={localStyles.accountPickerTitle}>Choose Quanta account</Text>
                <Text style={localStyles.accountPickerSubtitle}>
                  Select where the mobile reward points should go.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close Quanta account picker"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowAccountPickerModal(false)}
                style={localStyles.accountPickerCloseButton}
              >
                <Ionicons name="close" size={20} color={COLORS.TEXT_SECONDARY} />
              </Pressable>
            </View>

            {isDiscoveringAccounts ? (
              <View style={localStyles.accountPickerState}>
                <ActivityIndicator color={COLORS.TEXT_PRIMARY} size="small" />
                <Text style={localStyles.accountPickerStateText}>{accountPickerStatusText}</Text>
              </View>
            ) : accountPickerError ? (
              <View style={localStyles.accountPickerState}>
                <StatusIconFrame>
                  <ErrorXIcon />
                </StatusIconFrame>
                <Text style={localStyles.accountPickerStateText}>{accountPickerError}</Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={localStyles.accountPickerListContent}
                keyboardShouldPersistTaps="handled"
                style={localStyles.accountPickerList}
              >
                {accountCandidates.map((candidate) => {
                  const candidateKey = getCandidateKey(candidate);
                  const isSelected = selectedCandidateKey === candidateKey;
                  const candidateTasks = candidate.status.stats?.tasks_completed ?? 0;
                  const isTaskCompleted = candidate.status.task?.completed === true;

                  return (
                    <Pressable
                      accessibilityLabel={`Choose ${getAddressTypeLabel(
                        candidate.addressType
                      )} address from account ${candidate.accountIndex + 1}`}
                      accessibilityRole="button"
                      key={candidateKey}
                      onPress={() => handleSelectCandidate(candidate)}
                      style={[
                        localStyles.accountPickerRow,
                        isSelected && localStyles.accountPickerRowSelected,
                      ]}
                      testID={`quanta-picker-account-${candidate.accountIndex + 1}-${candidate.addressType}`}
                    >
                      <View style={localStyles.accountPickerRowCopy}>
                        <Text style={localStyles.accountPickerRowTitle}>
                          Account {candidate.accountIndex + 1} ·{' '}
                          {getAddressTypeLabel(candidate.addressType)}
                        </Text>
                        <Text style={localStyles.accountPickerAddress} numberOfLines={1} selectable>
                          {formatAddressPreview(candidate.quantaAddress, addressMaxLength + 8)}
                        </Text>
                        <Text style={localStyles.accountPickerMeta} numberOfLines={1}>
                          {formatPoints(getCandidatePoints(candidate))} points ·{' '}
                          {formatPoints(candidateTasks)} tasks
                          {isTaskCompleted ? ' · mobile reward complete' : ''}
                        </Text>
                      </View>
                      <View style={localStyles.accountPickerSelectIcon}>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={22} color={COLORS.PRIMARY_BLUE} />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={22}
                            color="rgba(255, 255, 255, 0.34)"
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {selectedCandidate && !isDiscoveringAccounts && !accountPickerError && (
              <View style={localStyles.accountPickerSelectedSummary}>
                <Text style={localStyles.accountPickerSelectedEyebrow}>Selected wallet</Text>
                <Text style={localStyles.accountPickerSelectedTitle}>
                  Account {selectedCandidate.accountIndex + 1} ·{' '}
                  {getAddressTypeLabel(selectedCandidate.addressType)}
                </Text>
                <Text style={localStyles.accountPickerSelectedAddress} numberOfLines={1} selectable>
                  {formatAddressPreview(selectedCandidate.quantaAddress, addressMaxLength + 12)}
                </Text>
                <Text style={localStyles.accountPickerSelectedMeta}>
                  {formatPoints(getCandidatePoints(selectedCandidate))} points ·{' '}
                  {formatPoints(selectedCandidate.status.stats?.tasks_completed ?? 0)} tasks
                </Text>
              </View>
            )}

            <Pressable
              accessibilityLabel="Connect selected Quanta account"
              accessibilityRole="button"
              disabled={!selectedCandidate || isClaimingReward || isDiscoveringAccounts}
              onPress={handleConfirmAccountPickerConnect}
              style={[
                localStyles.connectButton,
                (!selectedCandidate || isClaimingReward || isDiscoveringAccounts) &&
                  localStyles.connectButtonDisabled,
              ]}
              testID="quanta-picker-connect-selected-button"
            >
              <Text
                style={[
                  localStyles.connectButtonText,
                  (!selectedCandidate || isClaimingReward || isDiscoveringAccounts) &&
                    localStyles.connectButtonTextDisabled,
                ]}
              >
                {isClaimingReward ? 'Connecting...' : 'Connect selected'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setShowMismatchProceedModal(false)}
        transparent
        visible={showMismatchProceedModal}
      >
        <Pressable
          accessibilityLabel="Dismiss Quanta mismatch warning"
          style={localStyles.warningModalBackdrop}
          onPress={() => setShowMismatchProceedModal(false)}
        >
          <Pressable
            accessibilityRole="alert"
            onPress={(event) => event.stopPropagation()}
            style={localStyles.warningModalCard}
            testID="quanta-mismatch-warning-modal"
          >
            <View style={localStyles.skullFrame}>
              <Ionicons name="skull-outline" size={30} color={COLORS.WHITE} />
            </View>
            <View style={localStyles.warningBadge}>
              <Text style={localStyles.warningBadgeText}>Non-matching wallet</Text>
            </View>
            <Text style={localStyles.warningModalTitle}>Proceed anyway?</Text>
            <Text style={localStyles.warningModalBody}>
              You can complete this Quanta task now, but this mobile wallet is not the wallet tied
              to your Quanta address.
            </Text>
            <View style={localStyles.consequenceList}>
              <View style={localStyles.consequenceRow}>
                <View style={localStyles.consequenceIconFrame}>
                  <CheckCircleIcon />
                </View>
                <View style={localStyles.consequenceCopy}>
                  <Text style={localStyles.consequenceTitle}>Task completes</Text>
                  <Text style={localStyles.consequenceText}>
                    The reward task is marked complete and the points are awarded.
                  </Text>
                </View>
              </View>
              <View style={[localStyles.consequenceRow, localStyles.consequenceDangerRow]}>
                <View style={localStyles.consequenceIconFrame}>
                  <ErrorXIcon />
                </View>
                <View style={localStyles.consequenceCopy}>
                  <Text style={localStyles.consequenceDangerTitle}>
                    Future actions will not count
                  </Text>
                  <Text style={localStyles.consequenceText}>
                    Activity from this mobile wallet will not count toward your Quanta points.
                  </Text>
                </View>
              </View>
            </View>
            <View style={localStyles.irreversibleNotice}>
              <View style={localStyles.irreversibleIconFrame}>
                <WarningTriangleIcon />
              </View>
              <Text style={localStyles.irreversibleNoticeText}>
                This choice cannot be reversed for this connection.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Proceed with non-matching Quanta wallet"
              accessibilityRole="button"
              disabled={isClaimingReward}
              onPress={handleConfirmMismatchConnect}
              style={[
                localStyles.irreversibleButton,
                isClaimingReward && localStyles.irreversibleButtonDisabled,
              ]}
              testID="quanta-mismatch-proceed-button"
            >
              <Text style={localStyles.irreversibleButtonText} numberOfLines={2}>
                {isClaimingReward ? 'Connecting...' : 'I understand. Proceed anyway'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Cancel Quanta connection"
              accessibilityRole="button"
              onPress={() => setShowMismatchProceedModal(false)}
              style={localStyles.cancelWarningButton}
              testID="quanta-mismatch-cancel-button"
            >
              <Text style={localStyles.cancelWarningButtonText}>Go back</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const localStyles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.DARK_BG,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
  topHalf: {
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  bottomHalf: {
    height: '50%',
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 10,
  },
  connectedSummary: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
  },
  connectedTopSummary: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  connectedBadge: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.24)',
    borderRadius: 999,
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  connectedBadgeText: {
    color: COLORS.SUCCESS_GREEN,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  connectedMetric: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  connectedStatusSlot: {
    width: '100%',
    justifyContent: 'center',
  },
  connectedAddressBox: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  connectedPointsRow: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectedPointsIcon: {
    width: 28,
    height: 28,
  },
  connectedFullAddress: {
    width: '100%',
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  connectedPointsValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 44,
    lineHeight: 50,
    fontFamily: 'CabinetGrotesk-Bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  connectedMetricLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  connectedStatsGrid: {
    width: '100%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectedStatBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
  },
  connectedStatDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectedStatValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 27,
    fontFamily: 'CabinetGrotesk-Bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  connectedStatLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  disconnectButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.26)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  disconnectButtonDisabled: {
    opacity: 0.62,
  },
  disconnectButtonText: {
    color: COLORS.ERROR,
    fontSize: 14,
    lineHeight: 17,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  disconnectButtonTextDisabled: {
    color: COLORS.TEXT_SECONDARY,
  },
  statusSlot: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  rewardChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  rewardIcon: {
    width: 20,
    height: 20,
  },
  rewardText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    lineHeight: 21,
    fontFamily: 'CabinetGrotesk-Bold',
    fontVariant: ['tabular-nums'],
  },
  addressBox: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addressLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  addressValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  candidatePanel: {
    width: '100%',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  candidatePanelTitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  candidateRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  candidateRowSelected: {
    borderColor: 'rgba(24, 88, 228, 0.62)',
    backgroundColor: 'rgba(24, 88, 228, 0.16)',
  },
  candidateCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  candidateTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  candidateAddress: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  candidatePoints: {
    minWidth: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  candidatePointsText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  candidatePointsIcon: {
    width: 17,
    height: 17,
  },
  addressInput: {
    flex: 1,
    minHeight: 25,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
    padding: 0,
  },
  errorText: {
    flex: 1,
    color: COLORS.ERROR,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  checkingText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusIconFrame: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successText: {
    flex: 1,
    color: COLORS.SUCCESS_GREEN,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  accountSwitchBanner: {
    width: '100%',
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 228, 162, 0.34)',
    borderRadius: 8,
    backgroundColor: 'rgba(245, 228, 162, 0.11)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  mismatchHelpBanner: {
    width: '100%',
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.34)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  accountSwitchText: {
    flex: 1,
    color: COLORS.YELLOW,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  inputRow: {
    width: '100%',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pasteButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  connectButton: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  connectButtonDisabled: {
    backgroundColor: 'rgba(24, 88, 228, 0.28)',
  },
  connectButtonText: {
    color: COLORS.WHITE,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  connectButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.46)',
  },
  accountPickerBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  accountPickerCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '78%',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    backgroundColor: 'rgba(14, 14, 18, 0.98)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  accountPickerHeader: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountPickerIconFrame: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  accountPickerIcon: {
    width: 24,
    height: 24,
  },
  accountPickerHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountPickerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  accountPickerSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  accountPickerCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  accountPickerState: {
    width: '100%',
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 14,
  },
  accountPickerStateText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  accountPickerList: {
    width: '100%',
    maxHeight: 360,
  },
  accountPickerListContent: {
    gap: 8,
    paddingBottom: 2,
  },
  accountPickerRow: {
    width: '100%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountPickerRowSelected: {
    borderColor: 'rgba(24, 88, 228, 0.78)',
    backgroundColor: 'rgba(24, 88, 228, 0.16)',
  },
  accountPickerRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accountPickerRowTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 17,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  accountPickerAddress: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  accountPickerMeta: {
    color: 'rgba(255, 255, 255, 0.52)',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  accountPickerSelectedSummary: {
    width: '100%',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(24, 88, 228, 0.42)',
    borderRadius: 10,
    backgroundColor: 'rgba(24, 88, 228, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountPickerSelectedEyebrow: {
    color: COLORS.PRIMARY_BLUE,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  accountPickerSelectedTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 17,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  accountPickerSelectedAddress: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'left',
  },
  accountPickerSelectedMeta: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  accountPickerSelectIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  warningModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 22,
  },
  warningModalCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    backgroundColor: 'rgba(17, 16, 21, 0.98)',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  skullFrame: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.48)',
    borderRadius: 32,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
  },
  warningBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.28)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warningBadgeText: {
    color: COLORS.ERROR,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'CabinetGrotesk-Bold',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  warningModalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 29,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  warningModalBody: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
  consequenceList: {
    width: '100%',
    gap: 8,
  },
  consequenceRow: {
    width: '100%',
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(24, 88, 228, 0.24)',
    borderRadius: 8,
    backgroundColor: 'rgba(24, 88, 228, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  consequenceDangerRow: {
    borderColor: 'rgba(255, 69, 58, 0.28)',
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  consequenceIconFrame: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    flexShrink: 0,
  },
  consequenceCopy: {
    flex: 1,
    gap: 2,
  },
  consequenceTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  consequenceDangerTitle: {
    color: COLORS.ERROR,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'left',
  },
  consequenceText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'left',
  },
  irreversibleNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  irreversibleIconFrame: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  irreversibleNoticeText: {
    flex: 1,
    color: COLORS.YELLOW,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  irreversibleButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.DANGER_RED,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  irreversibleButtonDisabled: {
    opacity: 0.62,
  },
  irreversibleButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
  },
  cancelWarningButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelWarningButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  starsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.WHITE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 4,
  },
});
