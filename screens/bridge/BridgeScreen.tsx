import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EVM_CONFIG, isEvmBridgeConfigured } from '../../constants/evm';
import { useWallet } from '../../contexts/WalletContext';
import { createBridgeIntent, getBridgeStatus } from '../../services/bridgeApiService';
import { getEvmBalances } from '../../services/evmBridgeService';
import { deriveSepoliaAccount } from '../../services/evmWalletService';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import type { BridgeIntent } from '../../shared/bridgeTypes';

interface BridgeScreenProps {
  route?: {
    params?: {
      amount?: string;
      autoSwap?: boolean;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
    getParent?: () => {
      getParent?: () => {
        navigate: (screen: string, params?: object) => void;
      } | undefined;
    } | undefined;
  };
}

export default function BridgeScreen({ route, navigation }: BridgeScreenProps): React.JSX.Element {
  const { currentAccount } = useWallet();
  const { showToast } = useNotifications();
  const [amount, setAmount] = useState(route?.params?.amount || '25');
  const [autoSwap, setAutoSwap] = useState(route?.params?.autoSwap ?? true);
  const [intent, setIntent] = useState<BridgeIntent | null>(null);
  const [depositAddress, setDepositAddress] = useState('');
  const [sepoliaAddress, setSepoliaAddress] = useState('');
  const [evmBalances, setEvmBalances] = useState<{ usdc: string; wunit: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const bridgeReady = isEvmBridgeConfigured();

  const payoutLabel = useMemo(() => (
    autoSwap ? 'USDC by default, with raw wUNIT fallback if swap guards fail.' : 'wUNIT on Sepolia.'
  ), [autoSwap]);

  useEffect(() => {
    if (route?.params?.amount) {
      setAmount(route.params.amount);
    }
    if (typeof route?.params?.autoSwap === 'boolean') {
      setAutoSwap(route.params.autoSwap);
    }
  }, [route?.params?.amount, route?.params?.autoSwap]);

  useEffect(() => {
    let active = true;
    Promise.all([
      deriveSepoliaAccount(currentAccount),
      bridgeReady ? getEvmBalances(currentAccount) : Promise.resolve(null),
    ])
      .then(([account, balances]) => {
        if (!active) return;
        setSepoliaAddress(account.address);
        if (balances) {
          setEvmBalances({ usdc: balances.usdc, wunit: balances.wunit });
        }
      })
      .catch(() => {
        if (!active) return;
        setSepoliaAddress('');
      });

    return () => {
      active = false;
    };
  }, [bridgeReady, currentAccount]);

  useEffect(() => {
    if (!intent || intent.status === 'fulfilled' || intent.status === 'minted_no_swap' || intent.status === 'failed') {
      return undefined;
    }

    const interval = setInterval(() => {
      getBridgeStatus(intent.id)
        .then(setIntent)
        .catch(() => undefined);
    }, 8000);

    return () => clearInterval(interval);
  }, [intent]);

  const handleCreateIntent = async (): Promise<void> => {
    try {
      setLoading(true);
      const nextIntent = await createBridgeIntent({
        amount,
        autoSwap,
        sepoliaRecipient: sepoliaAddress,
      });
      setIntent(nextIntent);
      setDepositAddress(nextIntent.depositAddress);
      showToast('Bridge intent created', 'success');
    } catch (error) {
      Alert.alert('Bridge intent failed', error instanceof Error ? error.message : 'Unable to create intent');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    if (!intent) return;
    try {
      setRefreshing(true);
      const updated = await getBridgeStatus(intent.id);
      setIntent(updated);
      if (bridgeReady) {
        const balances = await getEvmBalances(currentAccount);
        setEvmBalances({ usdc: balances.usdc, wunit: balances.wunit });
      }
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Unable to refresh bridge status');
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenSendFlow = (): void => {
    navigation.getParent?.()?.getParent?.()?.navigate('SendFlow', {
      screen: 'SendInput',
      params: {
        assetType: 'unit',
        prefillAddress: intent?.depositAddress,
        prefillAmount: intent?.amount,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="bridge-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack} testID="bridge-back-btn">
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Mutinynet → Sepolia</Text>
        <Text style={styles.title}>Bridge UNIT into the Sepolia stable pool</Text>
        <Text style={styles.description}>
          Create a one-time intent, send the exact UNIT amount to the Taproot deposit address, and receive {payoutLabel}
        </Text>

        {!bridgeReady && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Bridge configuration missing</Text>
            <Text style={styles.warningBody}>
              Set `EXPO_PUBLIC_SEPOLIA_RPC_URL`, `EXPO_PUBLIC_WUNIT_ADDRESS`, `EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS`,
              and `EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS` before using live Sepolia actions.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sepolia account</Text>
          <Text style={styles.addressText}>{sepoliaAddress || 'Loading…'}</Text>
          {evmBalances && (
            <Text style={styles.helperText}>USDC {evmBalances.usdc} • wUNIT {evmBalances.wunit}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bridge amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.amountInput}
            placeholder="25"
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="bridge-amount-input"
          />
          <View style={styles.row}>
            <View style={styles.switchText}>
              <Text style={styles.cardLabel}>Auto-swap into USDC</Text>
              <Text style={styles.helperText}>Fallback is raw wUNIT if pool guards fail.</Text>
            </View>
            <Switch value={autoSwap} onValueChange={setAutoSwap} trackColor={{ true: '#9FE870' }} />
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateIntent}
            disabled={loading || !sepoliaAddress}
            testID="bridge-create-intent-btn"
          >
            {loading ? <ActivityIndicator color={COLORS.DARK_BG} /> : <Text style={styles.primaryButtonText}>Create intent</Text>}
          </TouchableOpacity>
        </View>

        {intent && (
          <View style={styles.card}>
            <View style={styles.intentHeader}>
              <View>
                <Text style={styles.cardLabel}>Intent status</Text>
                <Text style={styles.intentStatus}>{intent.status}</Text>
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRefresh}
                disabled={refreshing}
                testID="bridge-refresh-status-btn"
              >
                <Text style={styles.secondaryButtonText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardLabel}>Deposit address</Text>
            <Text selectable style={styles.addressText}>{depositAddress || intent.depositAddress}</Text>
            <Text style={styles.helperText}>Send exactly {intent.amount} UNIT from your existing Mutinynet wallet flow.</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleOpenSendFlow} testID="bridge-open-send-flow-btn">
              <Text style={styles.linkButtonText}>Open UNIT send flow</Text>
            </TouchableOpacity>

            <View style={styles.resultGrid}>
              <View style={styles.resultCard}>
                <Text style={styles.cardLabel}>Payout asset</Text>
                <Text style={styles.resultValue}>{intent.payoutAsset || (intent.autoSwap ? 'USDC' : 'wUNIT')}</Text>
              </View>
              <View style={styles.resultCard}>
                <Text style={styles.cardLabel}>Payout amount</Text>
                <Text style={styles.resultValue}>{intent.payoutAmount || 'Pending'}</Text>
              </View>
            </View>

            {intent.error ? <Text style={styles.errorText}>{intent.error}</Text> : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bridge backend</Text>
          <Text style={styles.helperText}>{EVM_CONFIG.bridgeApiBaseUrl}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backButtonText: {
    color: COLORS.WHITE,
    fontSize: 15,
    fontWeight: '600',
  },
  eyebrow: {
    color: '#9FE870',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: COLORS.WHITE,
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 15,
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.24)',
  },
  warningTitle: {
    color: COLORS.WHITE,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningBody: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  amountInput: {
    borderRadius: 16,
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchText: {
    flex: 1,
    gap: 4,
  },
  helperText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: '#9FE870',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 15,
    fontWeight: '700',
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  intentStatus: {
    color: COLORS.WHITE,
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  addressText: {
    color: COLORS.WHITE,
    fontSize: 14,
    lineHeight: 22,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#22222A',
  },
  secondaryButtonText: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  linkButtonText: {
    color: '#9FE870',
    fontWeight: '700',
  },
  resultGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  resultCard: {
    flex: 1,
    backgroundColor: '#171922',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  resultValue: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.WARNING_ORANGE,
    lineHeight: 20,
  },
});
