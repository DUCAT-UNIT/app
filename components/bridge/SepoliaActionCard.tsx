import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { COLORS } from '../../theme';

interface SepoliaActionCardProps {
  onBridgePress: () => void;
  onSwapPress: () => void;
  onRedeemPress: () => void;
}

export default function SepoliaActionCard({
  onBridgePress,
  onSwapPress,
  onRedeemPress,
}: SepoliaActionCardProps): React.JSX.Element {
  const { s, sf } = useResponsive();

  return (
    <View
      style={[styles.container, { padding: s(18), borderRadius: s(20) }]}
      testID="wallet-sepolia-card"
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { fontSize: sf(11) }]}>Sepolia Liquidity</Text>
        <Text style={[styles.title, { fontSize: sf(20) }]}>Bridge UNIT into wUNIT and USDC</Text>
        <Text style={[styles.subtitle, { fontSize: sf(13) }]}>
          Use the same wallet seed on Sepolia for bridge, stable swaps, and redemptions back to Mutinynet.
        </Text>
      </View>

      <View style={[styles.actions, { gap: s(10) }]}>
        <TouchableOpacity
          style={[styles.primaryAction, { borderRadius: s(16), paddingVertical: s(14) }]}
          onPress={onBridgePress}
          testID="wallet-sepolia-bridge-btn"
        >
          <Text style={[styles.primaryActionText, { fontSize: sf(15) }]}>Bridge</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryAction, { borderRadius: s(16), paddingVertical: s(14) }]}
          onPress={onSwapPress}
          testID="wallet-sepolia-swap-btn"
        >
          <Text style={[styles.secondaryActionText, { fontSize: sf(15) }]}>Swap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryAction, { borderRadius: s(16), paddingVertical: s(14) }]}
          onPress={onRedeemPress}
          testID="wallet-sepolia-redeem-btn"
        >
          <Text style={[styles.secondaryActionText, { fontSize: sf(15) }]}>Redeem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#152026',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  header: {
    gap: 6,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#9FE870',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
  },
  primaryAction: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9FE870',
  },
  primaryActionText: {
    color: '#111015',
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2A30',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryActionText: {
    color: COLORS.WHITE,
    fontWeight: '700',
  },
});
