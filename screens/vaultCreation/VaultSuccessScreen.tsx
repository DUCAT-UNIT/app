/**
 * VaultSuccessScreen - Vault creation success confirmation
 * Features: Success animation, transaction ID display, explorer link
 */

import React, { useCallback, useEffect } from 'react';
import { Text, View, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TouchableScale from '../../components/common/TouchableScale';
import { VaultStepIndicator } from '../../components/vaultCreation';
import { useVaultCreation } from '../../stores/vaultCreationStore';
import { useNotifications } from '../../stores/notificationStore';
import { getTxUrl } from '../../utils/constants';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

import type { VaultCreateStackParamList } from '../../navigation/types';
import type { StackScreenProps } from '@react-navigation/stack';

type VaultSuccessScreenProps = StackScreenProps<VaultCreateStackParamList, 'VaultSuccess'>;

export default function VaultSuccessScreen({ navigation, route }: VaultSuccessScreenProps) {
  const { txid: storeTxid, reset } = useVaultCreation();
  const { showToast } = useNotifications();

  const txid = route.params?.txid || storeTxid || '';

  // Trigger haptic feedback on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Copy transaction ID to clipboard
  const handleCopyTxid = useCallback(async () => {
    if (txid) {
      await Clipboard.setStringAsync(txid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Transaction ID copied');
    }
  }, [txid, showToast]);

  // Open transaction in explorer
  const handleViewExplorer = useCallback(() => {
    if (txid) {
      const url = getTxUrl(txid);
      Linking.openURL(url);
    }
  }, [txid]);

  // Handle done - reset state and go back to wallet
  const handleDone = useCallback(() => {
    reset();
    // Navigate back to main screen
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [reset, navigation]);

  // Truncate txid for display
  const truncatedTxid = txid
    ? `${txid.slice(0, 8)}...${txid.slice(-8)}`
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.semantic.success} />
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.title}>Vault Created!</Text>
        <Text style={styles.subtitle}>
          Your vault has been successfully created and is now active.
        </Text>

        <VaultStepIndicator currentStep={4} />

        {/* Transaction Card */}
        {txid && (
          <View style={styles.txCard}>
            <Text style={styles.txLabel}>Transaction ID</Text>
            <TouchableScale onPress={handleCopyTxid} style={styles.txIdContainer}>
              <Text style={styles.txId}>{truncatedTxid}</Text>
              <Ionicons name="copy-outline" size={18} color={colors.text.secondary} />
            </TouchableScale>

            <TouchableScale onPress={handleViewExplorer} style={styles.explorerButton}>
              <Ionicons name="open-outline" size={16} color={colors.brand.primary} />
              <Text style={styles.explorerText}>View on Explorer</Text>
            </TouchableScale>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.text.secondary} />
          <Text style={styles.infoText}>
            The transaction is being processed. It may take a few minutes to confirm on the network.
          </Text>
        </View>
      </View>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableScale style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: 'rgba(89, 170, 138, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  txCard: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  txLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  txIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
  },
  txId: {
    fontSize: fontSizes.md,
    fontFamily: fonts.mono,
    color: colors.text.primary,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  explorerText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.brand.primary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  doneButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
});
