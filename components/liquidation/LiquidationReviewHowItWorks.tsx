import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';

/** Local constant for the liquidation green accent */
const LIQ_GREEN = colors.brand.accent;

export interface LiquidationReviewHowItWorksProps {
  investAmount: number;
  profitRate: number;
  swapRate: number;
  btcPrice: number;
}

const LiquidationReviewHowItWorks = React.memo(function LiquidationReviewHowItWorks({
  investAmount,
  profitRate,
  swapRate,
  btcPrice,
}: LiquidationReviewHowItWorksProps): React.ReactElement {
  const { s } = useResponsive();
  const price = btcPrice;
  const liqProfitBtc = investAmount * profitRate;
  const liqSwapBtc = investAmount * swapRate;
  const liqReturnBtc = investAmount + liqProfitBtc;
  const liqSwapUnit = liqSwapBtc * price;
  const fmt = (v: number, d = 8): string => v.toFixed(d);

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{ paddingBottom: s(120) }}
      showsVerticalScrollIndicator={false}
    >
      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.howDesc}>
          You deposit BTC to restore an unhealthy vault to health. In return, you receive the
          liquidated vault's collateral and debt to your vault, including a{' '}
          <Text style={{ color: LIQ_GREEN, fontFamily: fonts.bold }}>
            {Math.round(profitRate * 100)}% profit
          </Text>
          {' '}for taking on the liquidation.
        </Text>
      </View>

      {/* What happens next */}
      <View style={styles.card}>
        <Text style={styles.howSectionTitle}>What happens next?</Text>
        {[
          {
            num: '1',
            title: 'Your vault gets updated',
            desc: `Added to your vault: ${fmt(liqReturnBtc, 6)} BTC + ${liqSwapUnit.toFixed(2)} UNIT debt.`,
            auto: true,
          },
          {
            num: '2',
            title: 'Receive UNIT in wallet',
            desc: `You receive ${liqSwapUnit.toFixed(2)} UNIT in your wallet to repay the debt.`,
            auto: true,
          },
          {
            num: '3',
            title: 'Repay your vault debt',
            desc: `Use the ${liqSwapUnit.toFixed(2)} UNIT in your wallet to clear the debt in your vault.`,
            auto: false,
          },
          {
            num: '4',
            title: 'Withdraw your profit',
            desc: `After clearing the debt, withdraw your ${fmt(liqReturnBtc, 6)} BTC (includes the ${fmt(liqProfitBtc, 6)} BTC profit).`,
            auto: false,
          },
        ].map((step) => (
          <View key={step.num} style={styles.howStep}>
            <View style={styles.howStepNum}>
              <Text style={styles.howStepNumText}>{step.num}</Text>
            </View>
            <View style={styles.howStepContent}>
              <Text style={styles.howStepTitle}>{step.title}</Text>
              <Text style={styles.howStepDesc}>{step.desc}</Text>
            </View>
            <Text
              style={[
                styles.howStepBadge,
                step.auto
                  ? { color: LIQ_GREEN }
                  : { color: colors.text.secondary },
              ]}
            >
              {step.auto ? 'Automatic \u26A1' : 'Manual\n(Optional)'}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 14,
    marginBottom: 8,
    marginTop: 0,
  },
  howDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  howSectionTitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  howStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  howStepNumText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  howStepContent: {
    flex: 1,
  },
  howStepTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  howStepDesc: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: 2,
    marginRight: 50,
  },
  howStepBadge: {
    fontSize: 10,
    fontFamily: fonts.medium,
    textAlign: 'right',
    width: 65,
  },
});

export default LiquidationReviewHowItWorks;
