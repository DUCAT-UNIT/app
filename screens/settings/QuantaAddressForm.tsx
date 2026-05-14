import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
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
  canConnectQuanta: boolean;
  canShowAccountCandidates: boolean;
  displayedWalletAddressLabel: string;
  displayedWalletAddressPreview: string;
  isClaimingReward: boolean;
  onBlurAddress: () => void;
  onChangeAddress: (address: string) => void;
  onConnectQuanta: () => void;
  onFocusAddress: () => void;
  onPasteAddress: () => void | Promise<void>;
  onSelectCandidate: (candidate: QuantaAccountCandidate) => void;
  quantaAddress: string;
  selectedCandidateKey: string | null;
  statusBanner: React.ReactNode;
}

export function QuantaAddressForm({
  accountCandidates,
  addressMaxLength,
  canConnectQuanta,
  canShowAccountCandidates,
  displayedWalletAddressLabel,
  displayedWalletAddressPreview,
  isClaimingReward,
  onBlurAddress,
  onChangeAddress,
  onConnectQuanta,
  onFocusAddress,
  onPasteAddress,
  onSelectCandidate,
  quantaAddress,
  selectedCandidateKey,
  statusBanner,
}: QuantaAddressFormProps): React.ReactElement {
  return (
    <View style={localStyles.bottomHalf}>
      {statusBanner}
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
            onChangeText={onChangeAddress}
            placeholder="2N or tb1..."
            placeholderTextColor="rgba(255, 255, 255, 0.32)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            onBlur={onBlurAddress}
            onFocus={onFocusAddress}
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
              void onPasteAddress();
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
        onPress={onConnectQuanta}
        style={[localStyles.connectButton, !canConnectQuanta && localStyles.connectButtonDisabled]}
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
  );
}
