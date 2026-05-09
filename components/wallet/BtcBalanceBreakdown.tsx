import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';
import { formatBalance } from '../../utils/formatters';

interface BtcBalanceBreakdownProps {
  onchainBalance: number;
  cashuBalanceSats: number;
}

const BtcBalanceBreakdown = memo(function BtcBalanceBreakdown({
  onchainBalance,
  cashuBalanceSats,
}: BtcBalanceBreakdownProps) {
  const { s, sf } = useResponsive();
  const { onchainPercentage, formattedOnchain, formattedCashu } = useMemo(() => {
    const cashuBtc = cashuBalanceSats / 100_000_000;
    const total = onchainBalance + cashuBtc;
    return {
      onchainPercentage: total > 0 ? (onchainBalance / total) * 100 : 50,
      formattedOnchain: formatBalance(onchainBalance, 8),
      formattedCashu: formatBalance(cashuBtc, 8),
    };
  }, [cashuBalanceSats, onchainBalance]);

  return (
    <View style={{ paddingHorizontal: s(24), paddingTop: 0, paddingBottom: s(12), alignItems: 'center' }}>
      <View
        style={{
          height: s(8),
          borderRadius: s(8),
          overflow: 'hidden',
          backgroundColor: COLORS.MEDIUM_GRAY,
          marginBottom: s(12),
          width: '61%',
          maxWidth: s(309),
        }}
      >
        <View
          style={{
            height: s(8),
            backgroundColor: COLORS.PRIMARY_BLUE,
            borderRadius: s(8),
            width: `${onchainPercentage}%`,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '61%', maxWidth: s(309) }}>
        <View style={{ alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(2) }}>
            <View style={{ width: s(5), height: s(5), borderRadius: s(2.5), marginRight: s(5), backgroundColor: COLORS.PRIMARY_BLUE }} />
            <Text style={{ fontSize: sf(11), fontWeight: '500', color: COLORS.WHITE }}>
              {formattedOnchain} BTC
            </Text>
          </View>
          <Text style={{ fontSize: sf(9), fontWeight: '400', color: COLORS.SECONDARY_TEXT, marginLeft: s(10) }}>onchain</Text>
        </View>

        <View style={{ alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(2) }}>
            <View style={{ width: s(5), height: s(5), borderRadius: s(2.5), marginRight: s(5), backgroundColor: COLORS.MEDIUM_GRAY }} />
            <Text style={{ fontSize: sf(11), fontWeight: '500', color: COLORS.WHITE }}>
              {formattedCashu} BTC
            </Text>
          </View>
          <Text style={{ fontSize: sf(9), fontWeight: '400', color: COLORS.SECONDARY_TEXT, marginLeft: s(10) }}>turbo</Text>
        </View>
      </View>
    </View>
  );
});

export default BtcBalanceBreakdown;
