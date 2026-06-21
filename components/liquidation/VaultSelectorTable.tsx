import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../icons';
import type { LiqVaultDisplay } from '../../services/liquidation/types';
import { DUST_BTC } from '../../services/liquidation/constants';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';
import { formatFiat } from '../../utils/formatters';

/** Local constant for the liquidation green accent */
const LIQ_GREEN = colors.brand.accent;

export interface VaultSelectorTableProps {
  vaults: LiqVaultDisplay[];
  investAmount: number;
  btcPrice: number;
  showBTC: boolean;
  expanded: boolean;
  onExpandToggle: () => void;
  vaultsLoaded: boolean;
  selectedCount: number;
}

const VaultSelectorTable = React.memo(function VaultSelectorTable({
  vaults,
  investAmount,
  btcPrice,
  showBTC,
  expanded,
  onExpandToggle,
  vaultsLoaded,
  selectedCount,
}: VaultSelectorTableProps): React.ReactElement {
  const { s } = useResponsive();

  // Map vaults to display tuples with partial/full status
  const selectedDisplay = useMemo((): { vault: LiqVaultDisplay; isPartial: boolean }[] => {
    if (investAmount <= 0 || vaults.length === 0) return [];
    const result: { vault: LiqVaultDisplay; isPartial: boolean }[] = [];
    let remaining = investAmount;
    for (const vault of vaults) {
      if (remaining <= 0) break;
      if (vault.claimAmountBtc <= DUST_BTC) continue;
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
        <Text style={styles.vaultChevron}>{expanded ? '\u25B2' : '\u25BC'}</Text>
      </TouchableOpacity>

      {/* Lower: Table */}
      {expanded && (
        <View style={styles.vaultLower}>
          <View style={styles.tableHeader}>
            <View style={styles.rowCheck} />
            <Text style={styles.colHeader}>Debt</Text>
            <Text style={styles.colHeader}>Collateral</Text>
            <Text style={styles.colHeader}>Claim</Text>
          </View>
          {selectedDisplay.length === 0 ? (
            <View style={styles.emptyVaultState}>
              <Text style={styles.emptyVaultText}>
                {!vaultsLoaded
                  ? 'Loading vaults...'
                  : vaults.length === 0
                    ? 'No liquidatable vaults available'
                    : 'Adjust slider to select vaults'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={[styles.vaultRowsScroll, { maxHeight: s(260) }]}
              contentContainerStyle={styles.vaultRowsContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              testID="liq-vault-row-list"
            >
              {selectedDisplay.map(({ vault, isPartial }, i) => (
                <View
                  key={vault.vaultId || `vault-${i}`}
                  style={[
                    styles.vaultRow,
                    i === selectedDisplay.length - 1 && styles.vaultRowLast,
                  ]}
                  testID={`liq-vault-row-${vault.vaultId || i}`}
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
                    <Text style={styles.rowText} numberOfLines={1}>
                      {formatFiat(vault.unit, 2)}
                    </Text>
                  </View>
                  <View style={styles.rowValue}>
                    <Icon name="btc_symbol" size={10} color={colors.text.secondary} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {vault.btcInVault.toFixed(6)}
                    </Text>
                  </View>
                  <Text style={styles.claimText} numberOfLines={1}>
                    {showBTC
                      ? `${vault.claimAmountBtc.toFixed(6)} \u20BF`
                      : `$${formatFiat(vault.claimAmountBtc * (btcPrice ?? 0), 2)}`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  vaultOuter: {
    marginTop: 12,
    marginBottom: 12,
  },
  vaultUpper: {
    backgroundColor: colors.bg.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
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
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -14,
    paddingTop: 22,
    paddingBottom: 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border.default,
    zIndex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  vaultRowsScroll: {
    flexGrow: 0,
  },
  vaultRowsContent: {
    flexGrow: 0,
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
  vaultRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 16,
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
    minWidth: 0,
  },
  rowText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  claimText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyVaultState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyVaultText: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});

export default VaultSelectorTable;
