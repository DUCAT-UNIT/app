import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '../icons';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';
import type { LiquidationStep } from '../../stores/liquidationFlowStore';

export interface LiquidationStatusScreenProps {
  step: LiquidationStep;
  processingMessage: string;
  txid: string | null;
  error: string | null;
}

const LiquidationStatusScreen = React.memo(function LiquidationStatusScreen({
  step,
  processingMessage,
  txid,
  error,
}: LiquidationStatusScreenProps): React.ReactElement {
  const { s } = useResponsive();

  return (
    <View style={styles.container}>
      {step === 'processing' && (
        <>
          <View style={styles.icon}>
            <Icon name="liquidations" size={s(48)} color={colors.brand.primary} />
          </View>
          <Text style={styles.title}>Processing Liquidation</Text>
          <Text style={styles.subtitle}>{processingMessage}</Text>
        </>
      )}
      {step === 'success' && (
        <>
          <View style={[styles.icon, { backgroundColor: colors.bg.successTint }]}>
            <Text style={styles.emoji}>{'\u2713'}</Text>
          </View>
          <Text style={styles.title}>Liquidation Claimed</Text>
          <Text style={styles.subtitle}>
            Your vault has been updated with the liquidated collateral and debt.
          </Text>
          {txid && (
            <Text style={[styles.subtitle, styles.txid]}>
              TX: {txid.substring(0, 16)}...
            </Text>
          )}
        </>
      )}
      {step === 'error' && (
        <>
          <View style={[styles.icon, { backgroundColor: colors.bg.errorTint }]}>
            <Text style={styles.emoji}>{'\u2715'}</Text>
          </View>
          <Text style={styles.title}>Liquidation Failed</Text>
          <Text style={styles.subtitle}>{error || 'An error occurred'}</Text>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  txid: {
    fontSize: 11,
    marginTop: 8,
  },
});

export default LiquidationStatusScreen;
