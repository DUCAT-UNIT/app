import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountSlider } from '../vaultAction/AmountSlider';
import { selectItemsForAmount } from '../../services/liquidation/calculations';
import type { LiqVaultDisplay, LiquidVaultProfileWithMeta } from '../../services/liquidation/types';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';
import VaultSelectorTable from './VaultSelectorTable';

/** Local constant for the liquidation green accent */
const LIQ_GREEN = colors.brand.accent;

export interface LiquidationInputScreenProps {
  maxInvestable: number;
  investAmount: number;
  onInvestAmountChange: (amount: number) => void;
  btcPrice: number;
  showBTC: boolean;
  vaults: LiqVaultDisplay[];
  vaultsFull: LiquidVaultProfileWithMeta[];
  vaultsLoaded: boolean;
  vaultExpanded: boolean;
  onExpandToggle: () => void;
  profitRate: number;
  disabled?: boolean;
  bottomPadding?: number;
}

const LiquidationInputScreen = React.memo(function LiquidationInputScreen({
  maxInvestable,
  investAmount,
  onInvestAmountChange,
  btcPrice,
  showBTC,
  vaults,
  vaultsFull,
  vaultsLoaded,
  vaultExpanded,
  onExpandToggle,
  profitRate,
  disabled = false,
  bottomPadding,
}: LiquidationInputScreenProps): React.ReactElement {
  const { s } = useResponsive();
  const price = btcPrice;

  // Use selectItemsForAmount to compute selected vaults (replaces inline greedy loop)
  const selectedItems = useMemo(() => {
    if (investAmount <= 0 || vaultsFull.length === 0) return [];
    return selectItemsForAmount(vaultsFull, investAmount);
  }, [investAmount, vaultsFull]);

  const selectedCount = selectedItems.length;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{ paddingBottom: bottomPadding ?? s(32) }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Investment Amount */}
      <AmountSlider
        value={investAmount}
        maxValue={maxInvestable}
        onValueChange={onInvestAmountChange}
        onLiveValueChange={onInvestAmountChange}
        label="Amount to Invest"
        btcPrice={btcPrice || undefined}
        disabled={disabled}
        attachedBottom
        testIDPrefix="liquidation-invest-amount"
        renderFooter={() => {
          const profitBtc = investAmount * profitRate;
          const returnBtc = investAmount + profitBtc;
          return (
            <View style={styles.footer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>You invest</Text>
                <Text style={styles.infoValue}>
                  {showBTC
                    ? `${investAmount.toFixed(8)} BTC`
                    : `$${(investAmount * price).toFixed(2)}`}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>You get back</Text>
                <Text style={styles.infoValue}>
                  {showBTC ? `${returnBtc.toFixed(8)} BTC` : `$${(returnBtc * price).toFixed(2)}`}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.profitLabel}>Total profit</Text>
                <Text style={styles.profitValue}>
                  {showBTC ? `+${profitBtc.toFixed(8)} BTC` : `+$${(profitBtc * price).toFixed(2)}`}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Vault Selector */}
      <VaultSelectorTable
        vaults={vaults}
        investAmount={investAmount}
        btcPrice={btcPrice}
        showBTC={showBTC}
        expanded={vaultExpanded}
        onExpandToggle={onExpandToggle}
        vaultsLoaded={vaultsLoaded}
        selectedCount={selectedCount}
      />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  footer: {
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  infoLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  profitLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: LIQ_GREEN,
  },
  profitValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: LIQ_GREEN,
  },
});

export default LiquidationInputScreen;
