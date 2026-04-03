/**
 * UnitBalanceBreakdown Component
 * Displays breakdown of UNIT balance between tUNIT (turbo/ecash) and UNIT (runes)
 * with a visual progress bar
 * Uses responsive scaling with s() and sf() functions
 */

import React,{ memo,useMemo } from 'react';
import { Text,View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';
import { formatFiat,formatUnitAmount } from '../../utils/formatters/amounts';

interface UnitBalanceBreakdownProps {
  ecashBalance: number;
  runesBalance: number;
}

const UnitBalanceBreakdown = memo(function UnitBalanceBreakdown({ ecashBalance, runesBalance }: UnitBalanceBreakdownProps) {
  const { s, sf } = useResponsive();

  // Memoize all calculations
  const { runesPercentage, formattedRunes, formattedEcash } = useMemo(() => {
    // Ecash is in smallest units (needs /100), runes from ord is already in display units
    const ecashDisplay = ecashBalance / 100;
    const totalBalance = ecashDisplay + runesBalance;
    const percentage = totalBalance > 0 ? (runesBalance / totalBalance) * 100 : 50;

    return {
      ecashDisplayAmount: ecashDisplay,
      runesPercentage: percentage,
      formattedRunes: formatFiat(runesBalance),
      formattedEcash: formatUnitAmount(ecashBalance),
    };
  }, [ecashBalance, runesBalance]);

  return (
    <View style={{
      paddingHorizontal: s(24),
      paddingTop: 0,
      paddingBottom: s(12),
      alignItems: 'center',
    }}>
      {/* Progress Bar */}
      <View style={{
        height: s(8),
        borderRadius: s(8),
        overflow: 'hidden',
        backgroundColor: COLORS.MEDIUM_GRAY,
        marginBottom: s(12),
        width: '61%',
        maxWidth: s(309),
        position: 'relative',
      }}>
        {/* Onchain indicator (blue) */}
        <View
          style={{
            height: s(8),
            backgroundColor: COLORS.PRIMARY_BLUE,
            borderRadius: s(8),
            width: `${runesPercentage}%`,
          }}
        />
      </View>

      {/* Balance Labels */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '61%',
        maxWidth: s(309),
      }}>
        {/* UNIT (Runes) - left aligned */}
        <View style={{ alignItems: 'flex-start' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: s(2),
          }}>
            <View style={{
              width: s(5),
              height: s(5),
              borderRadius: s(2.5),
              marginRight: s(5),
              backgroundColor: COLORS.PRIMARY_BLUE,
            }} />
            <Text style={{
              fontSize: sf(11),
              fontWeight: '500',
              color: COLORS.WHITE,
            }}>
              {formattedRunes} UNIT
            </Text>
          </View>
          <Text style={{
            fontSize: sf(9),
            fontWeight: '400',
            color: COLORS.SECONDARY_TEXT,
            marginLeft: s(10),
          }}>onchain</Text>
        </View>

        {/* tUNIT (turbo) - right aligned position, left aligned text */}
        <View style={{ alignItems: 'flex-start' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: s(2),
          }}>
            <View style={{
              width: s(5),
              height: s(5),
              borderRadius: s(2.5),
              marginRight: s(5),
              backgroundColor: COLORS.MEDIUM_GRAY,
            }} />
            <Text style={{
              fontSize: sf(11),
              fontWeight: '500',
              color: COLORS.WHITE,
            }}>
              {formattedEcash} tUNIT
            </Text>
          </View>
          <Text style={{
            fontSize: sf(9),
            fontWeight: '400',
            color: COLORS.SECONDARY_TEXT,
            marginLeft: s(10),
          }}>turbo</Text>
        </View>
      </View>
    </View>
  );
});

export default UnitBalanceBreakdown;
