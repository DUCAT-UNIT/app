/**
 * InitialWelcome - First screen users see (create/restore options)
 */

import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import Icon from '../icons';
import { colors, spacing, fonts, fontSizes, fontWeights, radii } from '../../styles/theme';

interface InitialWelcomeProps {
  onCreateWallet?: () => void;
  onRestoreWallet: () => void;
}

export default function InitialWelcome({
  onCreateWallet,
  onRestoreWallet,
}: InitialWelcomeProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={styles.welcomeContainer} testID="welcome-screen">
      <View style={styles.welcomeContent}>
        <Icon name="ducat_logo" size={s(100)} testID="welcome-logo" />
      </View>
      <View style={[styles.welcomeButtons, { paddingBottom: s(spacing.lg + 20) }]}>
        <Text style={[styles.welcomeTitle, { fontSize: sf(fontSizes.xl), marginBottom: s(8), paddingHorizontal: s(12) }]} testID="welcome-title">
          DUCΔT
        </Text>
        <Text
          style={[styles.welcomeTagline, { fontSize: sf(fontSizes.md), marginBottom: s(32), paddingHorizontal: s(12) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          A Decentralised Credit Platform
        </Text>
        {onCreateWallet && (
          <TouchableOpacity
            style={[styles.button, {
              paddingVertical: s(spacing.md),
              paddingHorizontal: s(spacing.lg),
              borderRadius: s(radii.lg),
              marginTop: s(8)
            }]}
            onPress={onCreateWallet}
            testID="welcome-create-wallet-btn"
          >
            <Text style={[styles.buttonText, { fontSize: sf(fontSizes.md) }]}>Create a new wallet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, {
            paddingVertical: s(spacing.md),
            paddingHorizontal: s(spacing.lg),
            borderRadius: s(radii.lg),
            marginTop: s(8)
          }]}
          onPress={onRestoreWallet}
          testID="welcome-restore-wallet-btn"
        >
          <Text style={[styles.buttonText, { fontSize: sf(fontSizes.md) }]}>Restore an existing wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg.primary,
  },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  welcomeButtons: {
    width: '100%',
  },
  welcomeTitle: {
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  welcomeTagline: {
    fontFamily: fonts.bold,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  secondaryButton: {
    backgroundColor: colors.bg.tertiary,
  },
});
