import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { quantaLinkStyles as localStyles } from './quantaLinkStyles';
import {
  CheckCircleIcon,
  ErrorXIcon,
  StatusIconFrame,
  WarningTriangleIcon,
} from './quantaLinkVisuals';

type QuantaStatusBannerVariant = 'connected' | 'form';

interface QuantaStatusBannerProps {
  accountCheckError: string | null;
  addressValidationMessage?: string | null;
  hasAccountCheckFailure: boolean;
  hasAddressMismatch: boolean;
  hasMatchedCurrentAccount?: boolean;
  hasMatchedDifferentAccount: boolean;
  isCheckingAddress: boolean;
  isDiscoveringAccounts?: boolean;
  isSwitchingAccount: boolean;
  matchedAccountIndex: number | null;
  onShowMismatchHelp: () => void;
  onSwitchToMatchedAccount: () => void;
  variant: QuantaStatusBannerVariant;
  visible: boolean;
}

export function QuantaStatusBanner({
  accountCheckError,
  addressValidationMessage = null,
  hasAccountCheckFailure,
  hasAddressMismatch,
  hasMatchedCurrentAccount = false,
  hasMatchedDifferentAccount,
  isCheckingAddress,
  isDiscoveringAccounts = false,
  isSwitchingAccount,
  matchedAccountIndex,
  onShowMismatchHelp,
  onSwitchToMatchedAccount,
  variant,
  visible,
}: QuantaStatusBannerProps): React.ReactElement | null {
  const isConnectedVariant = variant === 'connected';
  const accountNumber = matchedAccountIndex !== null ? matchedAccountIndex + 1 : null;

  if (isConnectedVariant && !visible) {
    return null;
  }

  return (
    <View
      style={isConnectedVariant ? localStyles.connectedStatusSlot : localStyles.statusSlot}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {!isConnectedVariant && addressValidationMessage && (
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
      {!isConnectedVariant && !isCheckingAddress && isDiscoveringAccounts && (
        <View style={localStyles.statusRow}>
          <ActivityIndicator color={COLORS.TEXT_SECONDARY} size="small" />
          <Text style={localStyles.checkingText}>Finding Quanta accounts in this wallet...</Text>
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
      {!isConnectedVariant && !isDiscoveringAccounts && hasMatchedCurrentAccount && (
        <View style={localStyles.statusRow}>
          <StatusIconFrame>
            <CheckCircleIcon />
          </StatusIconFrame>
          <Text style={localStyles.successText}>Addresses match</Text>
        </View>
      )}
      {!isDiscoveringAccounts && hasMatchedDifferentAccount && accountNumber !== null && (
        <Pressable
          accessibilityLabel={
            isConnectedVariant
              ? 'Switch to the account for this connected Quanta address'
              : 'Switch to the account for this Quanta address'
          }
          accessibilityRole="button"
          onPress={onSwitchToMatchedAccount}
          style={localStyles.accountSwitchBanner}
          testID={
            isConnectedVariant
              ? 'quanta-connected-switch-account-banner'
              : 'quanta-switch-account-banner'
          }
        >
          <View style={localStyles.statusRow}>
            <StatusIconFrame>
              <WarningTriangleIcon />
            </StatusIconFrame>
            <Text style={localStyles.accountSwitchText} numberOfLines={2}>
              {isSwitchingAccount
                ? 'Switching account...'
                : isConnectedVariant
                  ? `Connected Quanta wallet is account ${accountNumber}. Tap to switch.`
                  : `Tap here to switch to the matching Quanta account ${accountNumber}.`}
            </Text>
          </View>
        </Pressable>
      )}
      {!isDiscoveringAccounts && hasAddressMismatch && (
        <Pressable
          accessibilityLabel={
            isConnectedVariant
              ? 'Learn how to fix mismatched connected Quanta and mobile wallet addresses'
              : 'Learn how to fix mismatched Quanta and mobile wallet addresses'
          }
          accessibilityRole="button"
          onPress={onShowMismatchHelp}
          style={localStyles.mismatchHelpBanner}
          testID={
            isConnectedVariant
              ? 'quanta-connected-mismatch-help-banner'
              : 'quanta-mismatch-help-banner'
          }
        >
          <View style={localStyles.statusRow}>
            <StatusIconFrame>
              <ErrorXIcon />
            </StatusIconFrame>
            <Text style={localStyles.errorText} numberOfLines={2}>
              {isConnectedVariant
                ? 'Connected Quanta address does not match this wallet.'
                : (accountCheckError ?? 'Quanta address does not match the wallet address.')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.ERROR} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
