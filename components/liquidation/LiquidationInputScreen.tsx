import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../icons';
import { AmountSlider } from '../vaultAction/AmountSlider';
import { selectItemsForAmount } from '../../services/liquidation/calculations';
import type { LiqVaultDisplay, LiquidVaultProfileWithMeta } from '../../services/liquidation/types';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';
import { formatFiat } from '../../utils/formatters';

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
}: LiquidationInputScreenProps): React.ReactElement {
  const { s } = useResponsive();
  const price = btcPrice;

  // Use selectItemsForAmount to compute selected vaults (replaces inline greedy loop)
  const selectedItems = useMemo(() => {
    if (investAmount <= 0 || vaultsFull.length === 0) return [];
    return selectItemsForAmount(vaultsFull, investAmount);
  }, [investAmount, vaultsFull]);

  const selectedCount = selectedItems.length;

  // Map selected full profiles to display tuples for the table
  const selectedDisplay = useMemo((): { vault: LiqVaultDisplay; isPartial: boolean }[] => {
    if (investAmount <= 0 || vaults.length === 0) return [];
    const result: { vault: LiqVaultDisplay; isPartial: boolean }[] = [];
    let remaining = investAmount;
    for (const vault of vaults) {
      if (remaining <= 0) break;
      if (remaining >= vault.claimAmountBtc) {
        result.push({ vault, isPartial: false });
        remaining -= vault.claimAmountBtc;
      } else {
        result.push({ vault, isPartial: true });
        remaining = 0;
      }
    }
    return result;
  }, [investAmount, vaults]);

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{ paddingBottom: s(80) }}
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
        attachedBottom
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
                  {showBTC
                    ? `${returnBtc.toFixed(8)} BTC`
                    : `$${(returnBtc * price).toFixed(2)}`}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.profitLabel}>Total profit</Text>
                <Text style={styles.profitValue}>
                  {showBTC
                    ? `+${profitBtc.toFixed(8)} BTC`
                    : `+$${(profitBtc * price).toFixed(2)}`}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Vault Selector */}
      <View style={styles.vaultOuter}>
        {/* Upper: Vaults label */}
        <TouchableOpacity
          style={styles.vaultUpper}
          onPress={onExpandToggle}
          activeOpacity={1}
          testID="liq-vault-selector"
        >
          <View style={styles.vaultLeft}>
            <Icon name="vault_logo" size={s(18)} color={colors.text.secondary} />
            <Text style={styles.vaultName}>
              {investAmount > 0
                ? `${selectedCount} Vault${selectedCount !== 1 ? 's' : ''} Selected`
                : 'Vaults'}
            </Text>
          </View>
          <Text style={styles.vaultChevron}>{vaultExpanded ? '\u25B2' : '\u25BC'}</Text>
        </TouchableOpacity>

        {/* Lower: Table */}
        {vaultExpanded && (
          <View style={styles.vaultLower}>
            <View style={styles.tableHeader}>
              <View style={styles.rowCheck} />
              <Text style={styles.colHeader}>Debt</Text>
              <Text style={styles.colHeader}>Collateral</Text>
              <Text style={styles.colHeader}>Claim</Text>
            </View>
            {selectedDisplay.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: colors.text.secondary, fontSize: fontSizes.sm }}>
                  {!vaultsLoaded
                    ? 'Loading vaults...'
                    : vaults.length === 0
                      ? 'No liquidatable vaults available'
                      : 'Adjust slider to select vaults'}
                </Text>
              </View>
            ) : (
              selectedDisplay.map(({ vault, isPartial }, i) => (
                <TouchableOpacity
                  key={vault.vaultId || `vault-${i}`}
                  style={[
                    styles.vaultRow,
                    i === selectedDisplay.length - 1 && {
                      borderBottomWidth: 0,
                      paddingBottom: 16,
                    },
                  ]}
                  onPress={onExpandToggle}
                >
                  <View style={styles.rowCheck}>
                    {isPartial ? (
                      <View style={{ width: 14, height: 16, position: 'relative' }}>
                        {/* Gray base checkmark */}
                        <Text
                          style={{
                            color: colors.text.tertiary,
                            fontSize: 14,
                            position: 'absolute',
                            left: 0,
                            top: 0,
                          }}
                        >
                          {'\u2713'}
                        </Text>
                        {/* Green left half overlay */}
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: 7,
                            height: 16,
                            overflow: 'hidden',
                          }}
                        >
                          <Text style={{ color: LIQ_GREEN, fontSize: 14 }}>{'\u2713'}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: LIQ_GREEN, fontSize: 14 }}>{'\u2713'}</Text>
                    )}
                  </View>
                  <View style={styles.rowValue}>
                    <Icon name="unit_symbol" size={10} color={colors.text.secondary} />
                    <Text style={styles.rowText}>{formatFiat(vault.unit, 2)}</Text>
                  </View>
                  <View style={styles.rowValue}>
                    <Icon name="btc_symbol" size={10} color={colors.text.secondary} />
                    <Text style={styles.rowText}>{vault.btcInVault.toFixed(6)}</Text>
                  </View>
                  <Text style={[styles.rowText, { flex: 1, textAlign: 'center' }]}>
                    {showBTC
                      ? `${vault.claimAmountBtc.toFixed(6)} \u20BF`
                      : `$${formatFiat(vault.claimAmountBtc * (btcPrice ?? 0), 2)}`}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
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
  vaultOuter: {
    marginTop: 12,
    marginBottom: 16,
  },
  vaultUpper: {
    backgroundColor: colors.bg.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    zIndex: 2,
    elevation: 3,
  },
  vaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vaultName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  vaultChevron: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  vaultLower: {
    backgroundColor: colors.bg.tertiary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 24,
    paddingBottom: 4,
    zIndex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  colHeader: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  rowCheck: {
    width: 20,
    alignItems: 'center',
  },
  rowValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  rowText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
});

export default LiquidationInputScreen;
