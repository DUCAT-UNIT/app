import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../icons';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';

export interface LiquidationReviewOverviewProps {
  claimBtc: number;
  swapBtc: number;
  swapUnit: number;
  profitBtc: number;
  profitPercent: number;
  totalBtc: number;
  returnBtc: number;
  btcPrice: number;
  showBTC: boolean;
}

const LIQ_GREEN = colors.brand.accent;

const LiquidationReviewOverview = React.memo(function LiquidationReviewOverview({
  claimBtc,
  swapBtc,
  swapUnit,
  profitBtc,
  profitPercent,
  totalBtc,
  returnBtc,
  btcPrice,
  showBTC,
}: LiquidationReviewOverviewProps): React.ReactElement {
  const { s } = useResponsive();
  const price = btcPrice;
  const collateralBtc = claimBtc + profitBtc;
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
              <Text style={styles.profitBadgeText}>+{Math.round(profitPercent)}%</Text>
            </View>
          </View>
          <Text style={styles.profitAmount}>
            {showBTC
              ? `+${fmt(profitBtc)} BTC`
              : `+$${(profitBtc * price).toFixed(2)}`}
          </Text>
          <Text style={styles.profitSub}>
            {showBTC
              ? `$ ${(profitBtc * price).toFixed(2)}`
              : `\u20BF ${fmt(profitBtc)}`}
          </Text>
        </View>

        {/* Lower: Breakdown */}
        <View style={styles.reviewLower}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Your deposit</Text>
            <View>
              <Text style={styles.rowValue}>{fmt(claimBtc)} BTC</Text>
              <Text style={styles.rowSub}>$ {(claimBtc * price).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.brand.primary }]}>You swap to UNIT</Text>
            <View>
              <Text style={styles.rowValue}>{fmt(swapBtc)} BTC</Text>
              <Text style={styles.rowSub}>$ {(swapBtc * price).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Total BTC required</Text>
              <Text style={[styles.rowSub, { textAlign: 'left' }]}>from your wallet</Text>
            </View>
            <View>
              <Text style={[styles.rowValue, { fontFamily: fonts.bold }]}>{fmt(totalBtc)} BTC</Text>
              <Text style={styles.rowSub}>$ {(totalBtc * price).toFixed(2)}</Text>
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
            <Text style={styles.getBoxValue}>{fmt(collateralBtc, 6)} BTC</Text>
            <Text style={styles.getBoxSub}>{fmt(profitBtc, 6)} profit</Text>
            <Text style={styles.getBoxSub}>{fmt(claimBtc, 6)} deposit</Text>
          </View>
          <Text style={styles.getPlus}>+</Text>
          <View style={[styles.getBox, { borderColor: colors.brand.primary }]}>
            <Text style={styles.getBoxValue}>{swapUnit.toFixed(2)} UNIT</Text>
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
        <View style={[styles.getBox, { borderColor: colors.brand.primary, alignSelf: 'center', width: '60%' }]}>
          <Text style={styles.getBoxValue}>{swapUnit.toFixed(2)} UNIT</Text>
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
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  reviewUpper: {
    backgroundColor: colors.bg.secondary,
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profitTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  profitBadge: {
    backgroundColor: LIQ_GREEN + '33',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  profitBadgeText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.bold,
    color: LIQ_GREEN,
  },
  profitAmount: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: LIQ_GREEN,
    textAlign: 'center',
  },
  profitSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  reviewLower: {
    backgroundColor: colors.bg.tertiary,
    padding: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  getHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  getTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  getGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  getBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  getPlus: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
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
    color: colors.text.tertiary,
  },
});

export default LiquidationReviewOverview;
