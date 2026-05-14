import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { CheckCircleIcon, ErrorXIcon } from './quantaLinkVisuals';

interface QuantaMismatchWarningModalProps {
  isClaimingReward: boolean;
  onCancel: () => void;
  onProceed: () => void;
  visible: boolean;
}

export function QuantaMismatchWarningModal({
  isClaimingReward,
  onCancel,
  onProceed,
  visible,
}: QuantaMismatchWarningModalProps): React.ReactElement {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Dismiss Quanta mismatch warning"
        style={styles.warningModalBackdrop}
        onPress={onCancel}
      >
        <Pressable
          accessibilityRole="alert"
          onPress={(event) => event.stopPropagation()}
          style={styles.warningModalCard}
          testID="quanta-mismatch-warning-modal"
        >
          <View style={styles.skullFrame}>
            <Ionicons name="skull-outline" size={30} color={COLORS.WHITE} />
          </View>
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>Non-matching wallet</Text>
          </View>
          <Text style={styles.warningModalTitle}>Proceed anyway?</Text>
          <Text style={styles.warningModalBody}>
            You can complete this Quanta task now, but this mobile wallet is not the wallet tied to
            your Quanta address.
          </Text>
          <View style={styles.consequenceList}>
            <View style={styles.consequenceRow}>
              <View style={styles.consequenceIconFrame}>
                <CheckCircleIcon />
              </View>
              <View style={styles.consequenceCopy}>
                <Text style={styles.consequenceTitle}>Task completes</Text>
                <Text style={styles.consequenceText}>
                  The reward task is marked complete and the points are awarded.
                </Text>
              </View>
            </View>
            <View style={[styles.consequenceRow, styles.consequenceDangerRow]}>
              <View style={styles.consequenceIconFrame}>
                <ErrorXIcon />
              </View>
              <View style={styles.consequenceCopy}>
                <Text style={styles.consequenceDangerTitle}>Future actions will not count</Text>
                <Text style={styles.consequenceText}>
                  Activity from this mobile wallet will not count toward your Quanta points.
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Proceed with non-matching Quanta wallet"
            accessibilityRole="button"
            disabled={isClaimingReward}
            onPress={onProceed}
            style={[
              styles.irreversibleButton,
              isClaimingReward && styles.irreversibleButtonDisabled,
            ]}
            testID="quanta-mismatch-proceed-button"
          >
            <Text style={styles.irreversibleButtonText} numberOfLines={2}>
              {isClaimingReward ? 'Connecting...' : 'I understand. Proceed anyway'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Cancel Quanta connection"
            accessibilityRole="button"
            onPress={onCancel}
            style={styles.cancelWarningButton}
            testID="quanta-mismatch-cancel-button"
          >
            <Text style={styles.cancelWarningButtonText}>Go back</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
