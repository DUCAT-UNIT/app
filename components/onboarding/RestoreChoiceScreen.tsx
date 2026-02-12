/**
 * RestoreChoiceScreen - Choose how to restore wallet (seed phrase or passkey)
 */

import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import Icon from '../icons';
import { colors, spacing, fonts, fontSizes, fontWeights, radii } from '../../styles/theme';

interface RestoreChoiceScreenProps {
  onSeedPhrase: () => void;
  onPasskey: () => void;
  onCancel: () => void;
  hasPasskeyRestore: boolean;
}

export default function RestoreChoiceScreen({
  onSeedPhrase,
  onPasskey,
  onCancel,
  hasPasskeyRestore,
}: RestoreChoiceScreenProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={styles.container} testID="restore-choice-screen">
      <View style={styles.content}>
        <Icon name="ducat_logo" size={s(100)} />
      </View>
      <View style={[styles.buttonsContainer, { paddingBottom: s(spacing.lg + 20) }]}>
        <Text style={[styles.title, { fontSize: sf(fontSizes.xl), marginBottom: s(8), paddingHorizontal: s(12) }]}>
          Restore Wallet
        </Text>
        <Text
          style={[styles.subtitle, { fontSize: sf(fontSizes.md), marginBottom: s(32), paddingHorizontal: s(12) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          Choose how to restore your wallet
        </Text>

        <TouchableOpacity
          style={[styles.button, {
            paddingVertical: s(spacing.md),
            paddingHorizontal: s(spacing.lg),
            borderRadius: s(radii.lg),
            marginTop: s(8)
          }]}
          onPress={onSeedPhrase}
          testID="restore-seed-phrase-btn"
        >
          <Text style={[styles.buttonText, { fontSize: sf(fontSizes.md) }]}>From Seed Phrase</Text>
        </TouchableOpacity>

        {hasPasskeyRestore && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, {
              paddingVertical: s(spacing.md),
              paddingHorizontal: s(spacing.lg),
              borderRadius: s(radii.lg),
              marginTop: s(8)
            }]}
            onPress={onPasskey}
          >
            <Text style={[styles.buttonText, { fontSize: sf(fontSizes.md) }]}>From Passkey</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.ghostButton, {
            paddingVertical: s(spacing.md),
            paddingHorizontal: s(spacing.lg),
            marginTop: s(8)
          }]}
          onPress={onCancel}
        >
          <Text style={[styles.ghostButtonText, { fontSize: sf(fontSizes.md) }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonsContainer: {
    width: '100%',
  },
  title: {
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
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
  ghostButton: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ghostButtonText: {
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
});
