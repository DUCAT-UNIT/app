import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../icons';
import type { LiqVaultDisplay } from '../../services/liquidation/types';
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
  );
});

const styles = StyleSheet.create({
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

export default VaultSelectorTable;
