import React from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { QUANTA_POINTS } from './quantaLinkAssets';
import { quantaLinkStyles as localStyles } from './quantaLinkStyles';
import {
  formatAddressPreview,
  formatPoints,
  getAddressTypeLabel,
  getCandidateKey,
  getCandidatePoints,
  getWalletProfileLabel,
  type QuantaAccountCandidate,
} from './quantaLinkUtils';

interface QuantaAddressFormProps {
  accountCandidates: QuantaAccountCandidate[];
  addressMaxLength: number;
  bottomPadding: number;
  canSearchQuanta: boolean;
  canShowAccountCandidates: boolean;
  compactLayout: boolean;
  displayedWalletAddressLabel: string;
  displayedWalletAddressPreview: string;
  differentWalletAddress: string;
  differentWalletError: string | null;
  differentWalletMode: boolean;
  differentWalletPointsLabel: string | null;
  differentWalletTasksLabel: string | null;
  hasNoQuantaInWallet: boolean;
  isCheckingDifferentWallet: boolean;
  isClaimingReward: boolean;
  isDiscoveringAccounts: boolean;
  onBackFromNoQuanta: () => void;
  onCancelDifferentWallet: () => void;
  onChangeDifferentWalletAddress: (address: string) => void;
  onBeginDifferentWalletCheck: () => void;
  onCheckDifferentWallet: () => void;
  onConnectDifferentWallet: () => void;
  onSelectCandidate: (candidate: QuantaAccountCandidate) => void;
  onSearchQuanta: () => void;
  onShowRestoreGuide: () => void;
  onStartDifferentWallet: () => void;
  selectedCandidateKey: string | null;
  showCurrentAddressBox: boolean;
  statusBanner: React.ReactNode;
}

export function QuantaAddressForm({
  accountCandidates,
  addressMaxLength,
  bottomPadding,
  canSearchQuanta,
  canShowAccountCandidates,
  compactLayout,
  displayedWalletAddressLabel,
  displayedWalletAddressPreview,
  differentWalletAddress,
  differentWalletError,
  differentWalletMode,
  differentWalletPointsLabel,
  differentWalletTasksLabel,
  hasNoQuantaInWallet,
  isCheckingDifferentWallet,
  isClaimingReward,
  isDiscoveringAccounts,
  onBackFromNoQuanta,
  onCancelDifferentWallet,
  onChangeDifferentWalletAddress,
  onBeginDifferentWalletCheck,
  onCheckDifferentWallet,
  onConnectDifferentWallet,
  onSelectCandidate,
  onSearchQuanta,
  onShowRestoreGuide,
  onStartDifferentWallet,
  selectedCandidateKey,
  showCurrentAddressBox,
  statusBanner,
}: QuantaAddressFormProps): React.ReactElement {
  const [isDifferentWalletCheckPending, setIsDifferentWalletCheckPending] = React.useState(false);
  const [isDifferentWalletInputFocused, setIsDifferentWalletInputFocused] = React.useState(false);
  const differentWalletInputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const differentWalletCheckStartedRef = React.useRef(false);
  const localPendingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonDisabled = !canSearchQuanta;
  const showSearchButton = !hasNoQuantaInWallet && !differentWalletMode;
  const hasDifferentWalletStatus = differentWalletPointsLabel !== null;
  const showDifferentWalletChecking = isCheckingDifferentWallet || isDifferentWalletCheckPending;
  const differentWalletButtonLabel = showDifferentWalletChecking
    ? 'Checking...'
    : hasDifferentWalletStatus
      ? isClaimingReward
        ? 'Connecting...'
        : 'Connect this Quanta wallet'
      : 'Check Quanta wallet';
  const differentWalletButtonDisabled =
    isClaimingReward || differentWalletAddress.trim().length === 0;

  const clearLocalPendingTimeout = React.useCallback(() => {
    if (localPendingTimeoutRef.current) {
      clearTimeout(localPendingTimeoutRef.current);
      localPendingTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (isCheckingDifferentWallet) {
      setIsDifferentWalletCheckPending(true);
      return;
    }

    if (differentWalletError || hasDifferentWalletStatus) {
      differentWalletCheckStartedRef.current = false;
      clearLocalPendingTimeout();
      setIsDifferentWalletCheckPending(false);
    }
  }, [
    clearLocalPendingTimeout,
    differentWalletError,
    hasDifferentWalletStatus,
    isCheckingDifferentWallet,
  ]);

  React.useEffect(() => {
    differentWalletCheckStartedRef.current = false;
    clearLocalPendingTimeout();
    setIsDifferentWalletCheckPending(false);
  }, [clearLocalPendingTimeout, differentWalletAddress]);

  React.useEffect(
    () => () => {
      clearLocalPendingTimeout();
    },
    [clearLocalPendingTimeout]
  );

  const handlePasteDifferentWalletAddress = React.useCallback(() => {
    Clipboard.getStringAsync()
      .then((text) => {
        const pastedAddress = text.trim();
        if (pastedAddress) {
          onChangeDifferentWalletAddress(pastedAddress);
          setIsDifferentWalletInputFocused(false);
          differentWalletInputRef.current?.blur();
          Keyboard.dismiss();
        }
      })
      .catch(() => undefined);
  }, [onChangeDifferentWalletAddress]);

  const startDifferentWalletCheck = React.useCallback(() => {
    if (hasDifferentWalletStatus) {
      onConnectDifferentWallet();
      return;
    }

    if (
      differentWalletCheckStartedRef.current ||
      showDifferentWalletChecking ||
      isClaimingReward ||
      differentWalletAddress.trim().length === 0
    ) {
      return;
    }

    differentWalletCheckStartedRef.current = true;
    clearLocalPendingTimeout();
    onBeginDifferentWalletCheck();
    setIsDifferentWalletCheckPending(true);
    setIsDifferentWalletInputFocused(false);
    differentWalletInputRef.current?.blur();
    Keyboard.dismiss();
    localPendingTimeoutRef.current = setTimeout(() => {
      differentWalletCheckStartedRef.current = false;
      setIsDifferentWalletCheckPending(false);
      localPendingTimeoutRef.current = null;
    }, 5000);
    (localPendingTimeoutRef.current as { unref?: () => void }).unref?.();

    const timer = setTimeout(() => {
      requestAnimationFrame(onCheckDifferentWallet);
    }, 60);
    (timer as { unref?: () => void }).unref?.();
  }, [
    clearLocalPendingTimeout,
    differentWalletAddress,
    hasDifferentWalletStatus,
    isClaimingReward,
    onBeginDifferentWalletCheck,
    onCheckDifferentWallet,
    onConnectDifferentWallet,
    showDifferentWalletChecking,
  ]);

  const handleDifferentWalletButtonPress = React.useCallback(() => {
    startDifferentWalletCheck();
  }, [startDifferentWalletCheck]);

  const handleDifferentWalletButtonPressIn = React.useCallback(() => {
    if (hasDifferentWalletStatus) {
      return;
    }

    startDifferentWalletCheck();
  }, [hasDifferentWalletStatus, startDifferentWalletCheck]);

  const differentWalletActionButton = (
    <Pressable
      accessibilityLabel={
        hasDifferentWalletStatus ? 'Connect this Quanta wallet' : 'Check Quanta wallet'
      }
      accessibilityRole="button"
      disabled={differentWalletButtonDisabled}
      hitSlop={8}
      onPress={handleDifferentWalletButtonPress}
      onPressIn={handleDifferentWalletButtonPressIn}
      style={[
        localStyles.differentWalletButton,
        showDifferentWalletChecking && localStyles.differentWalletButtonChecking,
        differentWalletButtonDisabled &&
          !showDifferentWalletChecking &&
          localStyles.connectButtonDisabled,
      ]}
      testID="quanta-different-wallet-button"
    >
      <View style={localStyles.differentWalletButtonContent}>
        {showDifferentWalletChecking && <ActivityIndicator color={COLORS.WHITE} size="small" />}
        <Text
          style={[
            localStyles.connectButtonText,
            differentWalletButtonDisabled &&
              !showDifferentWalletChecking &&
              localStyles.connectButtonTextDisabled,
          ]}
        >
          {differentWalletButtonLabel}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View
      style={[
        localStyles.bottomHalf,
        compactLayout && localStyles.tabBottomHalf,
        differentWalletMode && localStyles.differentWalletBottomHalf,
        { paddingBottom: bottomPadding },
      ]}
    >
      {!differentWalletMode && statusBanner}
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
                  onSelectCandidate(candidate);
                }}
                style={[localStyles.candidateRow, isSelected && localStyles.candidateRowSelected]}
                testID={`quanta-account-candidate-${candidate.accountIndex + 1}`}
              >
                <View style={localStyles.candidateCopy}>
                  <Text style={localStyles.candidateTitle}>
                    {getWalletProfileLabel(candidate.derivationMode)} · Account{' '}
                    {candidate.accountIndex + 1}
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
      {differentWalletMode ? (
        <React.Fragment>
          <View style={localStyles.differentWalletBox}>
            <Text style={localStyles.differentWalletTitle}>Connect a different wallet</Text>
            <Text style={localStyles.differentWalletBody}>
              Enter the Quanta address you use on desktop. We will show the profile first, then ask
              you to confirm before connecting it to this phone.
            </Text>
            <View style={localStyles.differentWalletInputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
                multiline={false}
                numberOfLines={1}
                onBlur={() => setIsDifferentWalletInputFocused(false)}
                onChangeText={onChangeDifferentWalletAddress}
                onFocus={() => setIsDifferentWalletInputFocused(true)}
                onSubmitEditing={startDifferentWalletCheck}
                placeholder="tb1..."
                placeholderTextColor="rgba(255, 255, 255, 0.28)"
                ref={differentWalletInputRef}
                returnKeyType="done"
                scrollEnabled={isDifferentWalletInputFocused}
                style={localStyles.differentWalletInput}
                testID="quanta-different-wallet-input"
                value={differentWalletAddress}
              />
              <Pressable
                accessibilityLabel="Paste Quanta wallet address"
                accessibilityRole="button"
                hitSlop={8}
                onPress={handlePasteDifferentWalletAddress}
                style={localStyles.differentWalletPasteButton}
                testID="quanta-different-wallet-paste-button"
              >
                <Ionicons name="clipboard-outline" size={18} color={COLORS.YELLOW} />
              </Pressable>
            </View>
            {differentWalletError && (
              <Text style={localStyles.differentWalletError}>{differentWalletError}</Text>
            )}
            {showDifferentWalletChecking && (
              <View style={localStyles.differentWalletCheckingRow}>
                <ActivityIndicator color={COLORS.YELLOW} size="small" />
                <Text style={localStyles.differentWalletCheckingText}>
                  Checking Quanta wallet...
                </Text>
              </View>
            )}
            {hasDifferentWalletStatus && (
              <View style={localStyles.differentWalletPreview}>
                <Image
                  source={QUANTA_POINTS}
                  resizeMode="contain"
                  style={localStyles.differentWalletPreviewIcon}
                />
                <View style={localStyles.differentWalletPreviewCopy}>
                  <Text style={localStyles.differentWalletPreviewTitle}>
                    This Quanta wallet has {differentWalletPointsLabel} points
                  </Text>
                  {differentWalletTasksLabel && (
                    <Text style={localStyles.differentWalletPreviewBody}>
                      {differentWalletTasksLabel} completed tasks on this Quanta profile.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
          {differentWalletActionButton}
          <Pressable
            accessibilityLabel="Back to Quanta options"
            accessibilityRole="button"
            disabled={isClaimingReward || showDifferentWalletChecking}
            hitSlop={8}
            onPress={onCancelDifferentWallet}
            style={[
              localStyles.differentWalletBackButton,
              (isClaimingReward || showDifferentWalletChecking) &&
                localStyles.differentWalletBackButtonDisabled,
            ]}
            testID="quanta-different-wallet-back-button"
          >
            <Text
              style={[
                localStyles.differentWalletBackButtonText,
                (isClaimingReward || showDifferentWalletChecking) &&
                  localStyles.differentWalletBackButtonTextDisabled,
              ]}
            >
              Back
            </Text>
          </Pressable>
        </React.Fragment>
      ) : hasNoQuantaInWallet ? (
        <React.Fragment>
          <View style={localStyles.discoveryEmptyBox}>
            <Text style={localStyles.discoveryEmptyTitle}>No Quanta found in this wallet</Text>
            <Text style={localStyles.discoveryEmptyBody}>
              We checked the wallet accounts on this device and did not find a matching Quanta
              profile. Restore the Xverse or UniSat wallet you use on desktop, then search again.
            </Text>
            <View style={localStyles.discoveryEmptyActions}>
              <Pressable
                accessibilityLabel="Open wallet restore guide"
                accessibilityRole="button"
                onPress={onShowRestoreGuide}
                style={localStyles.discoveryGuideButton}
                testID="quanta-restore-guide-button"
              >
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={localStyles.discoveryGuideButtonText}
                >
                  View restore guide
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Connect a different Quanta wallet"
                accessibilityRole="button"
                onPress={onStartDifferentWallet}
                style={localStyles.discoverySecondaryButton}
                testID="quanta-connect-different-wallet-button"
              >
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={localStyles.discoverySecondaryButtonText}
                >
                  Connect a different wallet
                </Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Back to Quanta options"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBackFromNoQuanta}
            style={localStyles.discoveryBackButton}
            testID="quanta-no-results-back-button"
          >
            <Text style={localStyles.discoveryBackButtonText}>Back</Text>
          </Pressable>
        </React.Fragment>
      ) : (
        <React.Fragment>
          {showCurrentAddressBox && (
            <View style={localStyles.addressBox}>
              <Text style={localStyles.addressLabel}>{displayedWalletAddressLabel}</Text>
              <Text style={localStyles.addressValue} numberOfLines={1} selectable>
                {displayedWalletAddressPreview}
              </Text>
            </View>
          )}
          <View style={localStyles.discoveryCopy}>
            <Text style={localStyles.discoveryTitle}>Find Quanta address in your wallet</Text>
            <Text style={localStyles.discoveryBody}>
              We'll search the wallet accounts on this device and show any Quanta accounts we find.
            </Text>
          </View>
        </React.Fragment>
      )}
      {showSearchButton && (
        <Pressable
          accessibilityLabel="Search for Quanta"
          accessibilityRole="button"
          disabled={buttonDisabled}
          onPress={onSearchQuanta}
          style={[localStyles.connectButton, buttonDisabled && localStyles.connectButtonDisabled]}
          testID="quanta-search-button"
        >
          <Text
            style={[
              localStyles.connectButtonText,
              buttonDisabled && localStyles.connectButtonTextDisabled,
            ]}
          >
            {isDiscoveringAccounts
              ? 'Searching...'
              : isClaimingReward
                ? 'Connecting...'
                : 'Search for Quanta'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
