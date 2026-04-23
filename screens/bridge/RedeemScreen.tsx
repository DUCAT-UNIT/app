import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../../contexts/WalletContext';
import {
  getEvmBalances,
  requestRedemption,
  type SepoliaAsset,
} from '../../services/evmBridgeService';
import { getRedemptionStatus } from '../../services/bridgeApiService';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';
import type { RedemptionRequest } from '../../shared/bridgeTypes';

interface RedeemScreenProps {
  route?: {
    params?: {
      amount?: string;
      maxInputAmount?: string;
      sourceAsset?: SepoliaAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
  };
}

export default function RedeemScreen({ route, navigation }: RedeemScreenProps): React.JSX.Element {
  const { wallet, currentAccount } = useWallet();
  const { showToast } = useNotifications();
  const [destination, setDestination] = useState(wallet?.taprootAddress || '');
  const [amount, setAmount] = useState(route?.params?.amount || '25');
  const [sourceAsset, setSourceAsset] = useState<SepoliaAsset>(route?.params?.sourceAsset || 'wUNIT');
  const [balances, setBalances] = useState<{ usdc: string; wunit: string } | null>(null);
  const [redemption, setRedemption] = useState<RedemptionRequest | null>(null);
  const [executing, setExecuting] = useState(false);
  const maxInputAmount = route?.params?.maxInputAmount;

  useEffect(() => {
    if (!destination && wallet?.taprootAddress) {
      setDestination(wallet.taprootAddress);
    }
  }, [destination, wallet?.taprootAddress]);

  useEffect(() => {
    if (route?.params?.amount) {
      setAmount(route.params.amount);
    }
    if (route?.params?.sourceAsset) {
      setSourceAsset(route.params.sourceAsset);
    }
  }, [route?.params?.amount, route?.params?.sourceAsset]);

  useEffect(() => {
    let active = true;
    getEvmBalances(currentAccount)
      .then((next) => {
        if (active) {
          setBalances({ usdc: next.usdc, wunit: next.wunit });
        }
      })
      .catch(() => {
        if (active) {
          setBalances(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentAccount]);

  useEffect(() => {
    if (!redemption || redemption.status === 'released' || redemption.status === 'failed') {
      return undefined;
    }

    const interval = setInterval(() => {
      getRedemptionStatus(redemption.id)
        .then(setRedemption)
        .catch(() => undefined);
    }, 8000);

    return () => clearInterval(interval);
  }, [redemption]);

  const handleRedeem = async (): Promise<void> => {
    try {
      setExecuting(true);
      const result = await requestRedemption(currentAccount, amount, destination, sourceAsset, maxInputAmount);
      const tracked = await getRedemptionStatus(result.releaseId);
      setRedemption(tracked);
      const nextBalances = await getEvmBalances(currentAccount);
      setBalances({ usdc: nextBalances.usdc, wunit: nextBalances.wunit });
      showToast('Redemption request submitted', 'success');
    } catch (error) {
      Alert.alert('Redemption failed', error instanceof Error ? error.message : 'Unable to request redemption');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="sepolia-redeem-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack} testID="sepolia-redeem-back-btn">
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Sepolia → Mutinynet</Text>
        <Text style={styles.title}>Burn wUNIT and release UNIT back home</Text>
        <Text style={styles.description}>
          Redeem with wUNIT directly, or start from USDC and let the app acquire wUNIT first before emitting the release event.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sepolia balances</Text>
          <Text style={styles.balanceText}>USDC {balances?.usdc || '—'}</Text>
          <Text style={styles.balanceText}>wUNIT {balances?.wunit || '—'}</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SepoliaSwap', { sourceAsset: 'USDC' })}
            testID="sepolia-redeem-open-swap-btn"
          >
            <Text style={styles.linkButtonText}>Open Sepolia swap screen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, sourceAsset === 'wUNIT' && styles.toggleButtonActive]}
              onPress={() => setSourceAsset('wUNIT')}
              testID="sepolia-redeem-wunit-btn"
            >
              <Text style={[styles.toggleText, sourceAsset === 'wUNIT' && styles.toggleTextActive]}>Redeem wUNIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, sourceAsset === 'USDC' && styles.toggleButtonActive]}
              onPress={() => setSourceAsset('USDC')}
              testID="sepolia-redeem-usdc-btn"
            >
              <Text style={[styles.toggleText, sourceAsset === 'USDC' && styles.toggleTextActive]}>Swap USDC first</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardLabel}>Mutinynet Taproot destination</Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="tb1p..."
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-redeem-destination-input"
          />

          <Text style={styles.cardLabel}>UNIT amount to release</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="25"
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-redeem-amount-input"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRedeem}
            disabled={executing}
            testID="sepolia-redeem-submit-btn"
          >
            {executing ? <ActivityIndicator color={COLORS.DARK_BG} /> : <Text style={styles.primaryButtonText}>Approve and redeem</Text>}
          </TouchableOpacity>
        </View>

        {redemption && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Release status</Text>
            <Text style={styles.statusText}>{redemption.status}</Text>
            <Text style={styles.helperText}>Amount {redemption.amount} UNIT</Text>
            <Text style={styles.helperText}>Destination {redemption.destinationTaprootAddress}</Text>
            <Text style={styles.helperText}>Burn tx {redemption.burnTxHash || 'Pending'}</Text>
            <Text style={styles.helperText}>Release tx {redemption.releaseTxid || 'Waiting on operator'}</Text>
          </View>
        )}
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
    lineHeight: 22,
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
  balanceText: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: '#9FE870',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#171922',
  },
  toggleButtonActive: {
    backgroundColor: '#9FE870',
  },
  toggleText: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.DARK_BG,
  },
  textInput: {
    borderRadius: 16,
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  primaryButton: {
    backgroundColor: '#9FE870',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontWeight: '700',
  },
  statusText: {
    color: COLORS.WHITE,
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  helperText: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
});
