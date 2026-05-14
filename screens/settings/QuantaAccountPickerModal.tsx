import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { QUANTA_POINTS } from './quantaLinkAssets';
import { ErrorXIcon, StatusIconFrame } from './quantaLinkVisuals';
import {
  formatAddressPreview,
  formatPoints,
  getAddressTypeLabel,
  getCandidateKey,
  getCandidatePoints,
  getWalletProfileLabel,
  type QuantaAccountCandidate,
} from './quantaLinkUtils';

interface QuantaAccountPickerModalProps {
  accountCandidates: QuantaAccountCandidate[];
  accountPickerError: string | null;
  accountPickerStatusText: string;
  addressMaxLength: number;
  isClaimingReward: boolean;
  isDiscoveringAccounts: boolean;
  onClose: () => void;
  onConnectSelected: () => void;
  onSelectCandidate: (candidate: QuantaAccountCandidate) => void;
  selectedCandidate: QuantaAccountCandidate | undefined;
  selectedCandidateKey: string | null;
  visible: boolean;
}

export function QuantaAccountPickerModal({
  accountCandidates,
  accountPickerError,
  accountPickerStatusText,
  addressMaxLength,
  isClaimingReward,
  isDiscoveringAccounts,
  onClose,
  onConnectSelected,
  onSelectCandidate,
  selectedCandidate,
  selectedCandidateKey,
  visible,
}: QuantaAccountPickerModalProps): React.ReactElement {
  const isConnectDisabled = !selectedCandidate || isClaimingReward || isDiscoveringAccounts;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Dismiss Quanta account picker"
        onPress={onClose}
        style={styles.accountPickerBackdrop}
      >
        <Pressable
          accessibilityRole="menu"
          onPress={(event) => event.stopPropagation()}
          style={styles.accountPickerCard}
          testID="quanta-account-picker-modal"
        >
          <View style={styles.accountPickerHeader}>
            <View style={styles.accountPickerIconFrame}>
              <Image source={QUANTA_POINTS} resizeMode="contain" style={styles.accountPickerIcon} />
            </View>
            <View style={styles.accountPickerHeaderCopy}>
              <Text style={styles.accountPickerTitle}>Choose Quanta account</Text>
              <Text style={styles.accountPickerSubtitle}>
                Select where the mobile reward points should go.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close Quanta account picker"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.accountPickerCloseButton}
            >
              <Ionicons name="close" size={20} color={COLORS.TEXT_SECONDARY} />
            </Pressable>
          </View>

          {isDiscoveringAccounts ? (
            <View style={styles.accountPickerState}>
              <ActivityIndicator color={COLORS.TEXT_PRIMARY} size="small" />
              <Text style={styles.accountPickerStateText}>{accountPickerStatusText}</Text>
            </View>
          ) : accountPickerError ? (
            <View style={styles.accountPickerState}>
              <StatusIconFrame>
                <ErrorXIcon />
              </StatusIconFrame>
              <Text style={styles.accountPickerStateText}>{accountPickerError}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.accountPickerListContent}
              keyboardShouldPersistTaps="handled"
              style={styles.accountPickerList}
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
                    onPress={() => onSelectCandidate(candidate)}
                    style={[styles.accountPickerRow, isSelected && styles.accountPickerRowSelected]}
                    testID={`quanta-picker-account-${candidate.accountIndex + 1}-${candidate.addressType}`}
                  >
                    <View style={styles.accountPickerRowCopy}>
                      <Text style={styles.accountPickerRowTitle}>
                        {getWalletProfileLabel(candidate.derivationMode)} · Account{' '}
                        {candidate.accountIndex + 1} · {getAddressTypeLabel(candidate.addressType)}
                      </Text>
                      <Text style={styles.accountPickerAddress} numberOfLines={1} selectable>
                        {formatAddressPreview(candidate.quantaAddress, addressMaxLength + 8)}
                      </Text>
                      <Text style={styles.accountPickerMeta} numberOfLines={1}>
                        {formatPoints(getCandidatePoints(candidate))} points ·{' '}
                        {formatPoints(candidateTasks)} tasks
                        {isTaskCompleted ? ' · mobile reward complete' : ''}
                      </Text>
                    </View>
                    <View style={styles.accountPickerSelectIcon}>
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
            <View style={styles.accountPickerSelectedSummary}>
              <Text style={styles.accountPickerSelectedEyebrow}>Selected wallet</Text>
              <Text style={styles.accountPickerSelectedTitle}>
                Account {selectedCandidate.accountIndex + 1} ·{' '}
                {getWalletProfileLabel(selectedCandidate.derivationMode)} ·{' '}
                {getAddressTypeLabel(selectedCandidate.addressType)}
              </Text>
              <Text style={styles.accountPickerSelectedAddress} numberOfLines={1} selectable>
                {formatAddressPreview(selectedCandidate.quantaAddress, addressMaxLength + 12)}
              </Text>
              <Text style={styles.accountPickerSelectedMeta}>
                {formatPoints(getCandidatePoints(selectedCandidate))} points ·{' '}
                {formatPoints(selectedCandidate.status.stats?.tasks_completed ?? 0)} tasks
              </Text>
            </View>
          )}

          <Pressable
            accessibilityLabel="Connect selected Quanta account"
            accessibilityRole="button"
            disabled={isConnectDisabled}
            onPress={onConnectSelected}
            style={[styles.connectButton, isConnectDisabled && styles.connectButtonDisabled]}
            testID="quanta-picker-connect-selected-button"
          >
            <Text
              style={[
                styles.connectButtonText,
                isConnectDisabled && styles.connectButtonTextDisabled,
              ]}
            >
              {isClaimingReward ? 'Connecting...' : 'Connect selected'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
