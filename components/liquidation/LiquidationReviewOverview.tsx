import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../icons';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';

export interface LiquidationReviewOverviewProps {
  investAmount: number;
  profitRate: number;
  depositRate: number;
  swapRate: number;
  btcPrice: number;
  showBTC: boolean;
}

const LiquidationReviewOverview = React.memo(function LiquidationReviewOverview({
  investAmount,
  profitRate,
  depositRate,
  swapRate,
  btcPrice,
  showBTC,
}: LiquidationReviewOverviewProps): React.ReactElement {
  const { s } = useResponsive();
  const price = btcPrice;
  const liqProfitBtc = investAmount * profitRate;
  const liqDepositBtc = investAmount * depositRate;
  const liqSwapBtc = investAmount * swapRate;
  const liqReturnBtc = investAmount + liqProfitBtc;
  const liqCollateralBtc = liqDepositBtc + liqProfitBtc;
  const liqSwapUnit = liqSwapBtc * price;
  const fmt = (v: number, d = 8): string => v.toFixed(d);

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{ paddingBottom: s(120) }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profit (upper) + Breakdown (lower) -- two-tone card */}
      <View style={[styles.vaultOuter, { marginTop: 0 }]}>
        {/* Upper: Profit */}
        <View style={styles.reviewUpper}>
          <View style={styles.profitHeader}>
            <Text style={styles.profitTitle}>Total profit</Text>
            <View style={styles.profitBadge}>
              <Text style={styles.profitBadgeText}>+{Math.round(profitRate * 100)}%</Text>
            </View>
          </View>
          <Text style={styles.profitAmount}>
            {showBTC
              ? `+${fmt(liqProfitBtc)} BTC`
              : `+$${(liqProfitBtc * price).toFixed(2)}`}
          </Text>
          <Text style={styles.profitSub}>
            {showBTC
              ? `$ ${(liqProfitBtc * price).toFixed(2)}`
              : `\u20BF ${fmt(liqProfitBtc)}`}
          </Text>
        </View>

        {/* Lower: Breakdown */}
        <View style={styles.reviewLower}>
          <View style={styles.reviewRow}>
            <Text style={styles.rowLabel}>Your deposit</Text>
            <View>
              <Text style={styles.rowValue}>{fmt(liqDepositBtc)} BTC</Text>
              <Text style={styles.rowSub}>$ {(liqDepositBtc * price).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.reviewRow}>
            <Text style={[styles.rowLabel, { color: colors.brand.primary }]}>
              You swap to UNIT
            </Text>
            <View>
              <Text style={styles.rowValue}>{fmt(liqSwapBtc)} BTC</Text>
              <Text style={styles.rowSub}>$ {liqSwapUnit.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.reviewRow}>
            <View>
              <Text style={styles.rowLabel}>Total BTC required</Text>
              <Text style={[styles.rowSub, { textAlign: 'left' }]}>from your vault</Text>
            </View>
            <View>
              <Text style={[styles.rowValue, { fontFamily: fonts.bold }]}>
                {investAmount.toFixed(8)} BTC
              </Text>
              <Text style={styles.rowSub}>$ {(investAmount * price).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* You get in your vault */}
      <View style={styles.card}>
        <View style={styles.getHeader}>
          <Icon name="vault_logo" size={s(20)} color={colors.text.secondary} />
          <Text style={styles.getTitle}>You get in your vault</Text>
        </View>
        <View style={styles.getGrid}>
          <View style={styles.getBox}>
            <Text style={styles.getBoxValue}>{fmt(liqReturnBtc, 6)} BTC</Text>
            <Text style={styles.getBoxSub}>{fmt(liqCollateralBtc, 6)} collateral</Text>
            <Text style={styles.getBoxSub}>{fmt(liqDepositBtc, 6)} deposit</Text>
          </View>
          <Text style={styles.getPlus}>+</Text>
          <View style={[styles.getBox, { borderColor: colors.brand.primary }]}>
            <Text style={styles.getBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
            <Text style={styles.getBoxSub}>repayable debt</Text>
          </View>
        </View>
      </View>

      {/* You get in your wallet */}
      <View style={styles.card}>
        <View style={styles.getHeader}>
          <Icon name="wallet" size={s(20)} color={colors.text.secondary} />
          <Text style={styles.getTitle}>You get in your wallet</Text>
        </View>
        <View
          style={[
            styles.getBox,
            { borderColor: colors.brand.primary, alignSelf: 'center', width: '60%' },
          ]}
        >
          <Text style={styles.getBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
          <Text style={styles.getBoxSub}>to pay the vault debt</Text>
        </View>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  vaultOuter: {
    marginTop: 12,
    marginBottom: 16,
  },
  reviewUpper: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 2,
    elevation: 3,
  },
  reviewLower: {
    backgroundColor: colors.bg.tertiary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 12,
    zIndex: 1,
  },
  profitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profitTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  profitBadge: {
    backgroundColor: colors.brand.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  profitBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  profitAmount: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.brand.accent,
    textAlign: 'center',
    marginBottom: 2,
  },
  profitSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  rowValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    textAlign: 'right',
  },
  rowSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 2,
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
  getHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  getTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  getGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  getBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  getPlus: {
    color: colors.text.secondary,
    fontSize: 18,
    marginHorizontal: 6,
  },
  getBoxValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  getBoxSub: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default LiquidationReviewOverview;
