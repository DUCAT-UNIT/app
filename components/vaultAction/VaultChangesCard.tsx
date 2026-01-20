/**
 * VaultChangesCard Component
 * Shows before → after values for vault metrics in a single card
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

interface ChangeRowProps {
  label: string;
  beforeValue: string;
  afterValue: string;
  beforeColor?: string;
  afterColor?: string;
  icon?: 'btc_symbol' | 'unit_symbol';
  showChange?: boolean;
}

const ChangeRow = memo(function ChangeRow({
  label,
  beforeValue,
  afterValue,
  beforeColor = COLORS.SECONDARY_TEXT,
  afterColor = COLORS.WHITE,
  icon,
  showChange = true,
}: ChangeRowProps) {
  const { s, sf } = useResponsive();

  return (
    <View style={[styles.changeRow, { paddingVertical: s(12) }]}>
      <Text style={[styles.changeLabel, { fontSize: sf(14) }]}>{label}</Text>
      <View style={styles.changeValues}>
        {showChange ? (
          <>
            <View style={styles.valueContainer}>
              {icon && <Icon name={icon} size={s(14)} color={beforeColor} />}
              <Text style={[styles.beforeValue, { fontSize: sf(14), color: beforeColor }]}>
                {beforeValue}
              </Text>
            </View>
            <Text style={[styles.arrow, { fontSize: sf(14) }]}>→</Text>
            <View style={styles.valueContainer}>
              {icon && <Icon name={icon} size={s(14)} color={afterColor} />}
              <Text style={[styles.afterValue, { fontSize: sf(14), color: afterColor }]}>
                {afterValue}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.valueContainer}>
            {icon && <Icon name={icon} size={s(14)} color={afterColor} />}
            <Text style={[styles.afterValue, { fontSize: sf(14), color: afterColor }]}>
              {afterValue}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const getHealthColor = (health: number): string => {
  if (health >= 200) return COLORS.SUCCESS_GREEN;
  if (health > 160) return '#fde37b'; // Moderate yellow - matches gauge
  return COLORS.DANGER_RED;
};

export interface VaultChangesCardProps {
  // Current vault state
  currentCollateral: number;
  currentDebt: number;
  currentHealth: number;
  // New vault state after action
  newCollateral: number;
  newDebt: number;
  newHealth: number;
  // Optional: liquidation price
  currentLiquidationPrice?: number;
  newLiquidationPrice?: number;
  // Show change arrows
  showChanges?: boolean;
  // Action type - determines whether to show collateral or debt change
  actionType?: 'collateral' | 'debt';
}

export const VaultChangesCard = memo(function VaultChangesCard({
  currentCollateral,
  currentDebt,
  currentHealth,
  newCollateral,
  newDebt,
  newHealth,
  currentLiquidationPrice,
  newLiquidationPrice,
  showChanges = true,
  actionType = 'collateral',
}: VaultChangesCardProps): React.JSX.Element {
  const { s, sf } = useResponsive();

  const collateralChanged = currentCollateral !== newCollateral;
  const debtChanged = currentDebt !== newDebt;
  const healthChanged = currentHealth !== newHealth;
  const liquidationChanged = currentLiquidationPrice !== newLiquidationPrice;

  return (
    <View style={[styles.container, { padding: s(16), borderRadius: s(16) }]}>
      <Text style={[styles.title, { fontSize: sf(12), marginBottom: s(8) }]}>
        {showChanges ? 'VAULT CHANGES' : 'VAULT STATUS'}
      </Text>

      {/* Collateral Row - shown for deposit/withdraw */}
      {actionType === 'collateral' && (
        <ChangeRow
          label="Collateral"
          beforeValue={formatBalance(currentCollateral)}
          afterValue={formatBalance(newCollateral)}
          icon="btc_symbol"
          showChange={showChanges && collateralChanged}
          afterColor={COLORS.WHITE}
        />
      )}

      {/* Debt Row - shown for borrow/repay */}
      {actionType === 'debt' && (
        <ChangeRow
          label="Debt"
          beforeValue={`${currentDebt.toFixed(2)} UNIT`}
          afterValue={`${newDebt.toFixed(2)} UNIT`}
          showChange={showChanges && debtChanged}
          afterColor={COLORS.WHITE}
        />
      )}

      {/* Health Factor Row */}
      <ChangeRow
        label="Health"
        beforeValue={`${currentHealth.toFixed(0)}%`}
        afterValue={`${newHealth.toFixed(0)}%`}
        beforeColor={getHealthColor(currentHealth)}
        afterColor={getHealthColor(newHealth)}
        showChange={showChanges && healthChanged}
      />

      {/* Liquidation Price Row (optional) */}
      {(currentLiquidationPrice !== undefined || newLiquidationPrice !== undefined) && (
        <ChangeRow
          label="Liquidation"
          beforeValue={currentLiquidationPrice ? `$${formatFiat(currentLiquidationPrice, 0)}` : '\u221E'}
          afterValue={newLiquidationPrice ? `$${formatFiat(newLiquidationPrice, 0)}` : '\u221E'}
          beforeColor={COLORS.DANGER_RED}
          afterColor={COLORS.DANGER_RED}
          showChange={showChanges && liquidationChanged}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  title: {
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
    letterSpacing: 1,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  changeLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 110,
    justifyContent: 'flex-end',
  },
  beforeValue: {
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    color: COLORS.SECONDARY_TEXT,
    width: 30,
    textAlign: 'center',
  },
  afterValue: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

export default VaultChangesCard;
