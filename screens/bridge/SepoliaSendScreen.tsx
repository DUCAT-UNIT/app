import React, { useEffect, useMemo, useState } from 'react';
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
import { isAddress } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { authenticateWithBiometrics } from '../../services/biometricService';
import {
  estimateSepoliaTokenTransfer,
  getEvmBalances,
  sendSepoliaToken,
  type SepoliaAsset,
  type SepoliaTokenTransferEstimate,
} from '../../services/evmBridgeService';
import { useNotifications } from '../../stores/notificationStore';
import { COLORS } from '../../theme';

interface SepoliaSendScreenProps {
  route?: {
    params?: {
      asset?: SepoliaAsset;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: object) => void;
  };
}

function shouldBypassBiometricReauth(error?: string): boolean {
  return error === 'not_enrolled' || error === 'not_available' || error === 'passcode_not_set';
}

function formatTokenAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(numeric);
}

function formatEthAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 ETH';
  }

  return `${numeric.toFixed(numeric < 0.001 ? 6 : 4)} ETH`;
}

export default function SepoliaSendScreen({
  route,
  navigation,
}: SepoliaSendScreenProps): React.JSX.Element {
  const { currentAccount } = useWallet();
  const { showToast } = useNotifications();
  const asset = route?.params?.asset || 'USDC';
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<{ usdc: string; wunit: string; eth: string } | null>(null);
  const [estimate, setEstimate] = useState<SepoliaTokenTransferEstimate | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingBalances(true);

    getEvmBalances(currentAccount)
      .then((nextBalances) => {
        if (!active) {
          return;
        }

        setBalances({
          usdc: nextBalances.usdc,
          wunit: nextBalances.wunit,
          eth: nextBalances.eth,
        });
      })
      .catch(() => {
        if (active) {
          setBalances(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingBalances(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentAccount]);

  useEffect(() => {
    if (!recipient || !amount || Number(amount) <= 0 || !isAddress(recipient)) {
      setEstimate(null);
      setEstimating(false);
      return undefined;
    }

    let active = true;
    setEstimating(true);
    estimateSepoliaTokenTransfer(currentAccount, asset, recipient, amount)
      .then((nextEstimate) => {
        if (active) {
          setEstimate(nextEstimate);
        }
      })
      .catch(() => {
        if (active) {
          setEstimate(null);
        }
      })
      .finally(() => {
        if (active) {
          setEstimating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [amount, asset, currentAccount, recipient]);

  const balanceValue = asset === 'USDC' ? balances?.usdc : balances?.wunit;
  const canSubmit = Boolean(recipient && amount && Number(amount) > 0 && isAddress(recipient) && !sending);
  const insufficientEth = useMemo(() => {
    if (!estimate || !balances?.eth) {
      return false;
    }

    return Number(balances.eth) < Number(estimate.totalFeeEth);
  }, [balances?.eth, estimate]);

  const handleSend = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }

    if (!isAddress(recipient)) {
      Alert.alert('Invalid address', 'Enter a valid Ethereum address.');
      return;
    }

    if (insufficientEth) {
      Alert.alert('Not enough ETH', 'This transfer needs Sepolia ETH for gas.');
      return;
    }

    const biometricResult = await authenticateWithBiometrics(
      `Authenticate to send ${asset}`,
      'Use PIN',
    );

    if (!biometricResult.success && !shouldBypassBiometricReauth(biometricResult.error)) {
      if (biometricResult.error && biometricResult.error !== 'user_cancel') {
        Alert.alert('Authentication failed', biometricResult.error);
      }
      return;
    }

    try {
      setSending(true);
      const result = await sendSepoliaToken(currentAccount, asset, recipient, amount);
      showToast(`${asset} sent`, 'success');
      navigation.navigate('AssetDetail', { assetType: asset === 'USDC' ? 'USDC' : 'UNIT' });
      Alert.alert('Transfer submitted', result.txHash);
    } catch (error) {
      Alert.alert('Send failed', error instanceof Error ? error.message : `Unable to send ${asset}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="sepolia-send-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack} testID="sepolia-send-back-btn">
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Ethereum Sepolia</Text>
        <Text style={styles.title}>Send {asset}</Text>
        <Text style={styles.description}>
          Transfer {asset} directly on Ethereum Sepolia from the wallet derived from this seed.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Available balance</Text>
          <Text style={styles.balanceText}>
            {loadingBalances ? 'Loading…' : `${formatTokenAmount(balanceValue || '0')} ${asset}`}
          </Text>
          <Text style={styles.helperText}>
            Sepolia ETH {balances ? formatEthAmount(balances.eth) : 'Loading…'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recipient</Text>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="0x..."
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-send-recipient-input"
          />

          <Text style={styles.cardLabel}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
            placeholder="10"
            placeholderTextColor={COLORS.SECONDARY_TEXT}
            testID="sepolia-send-amount-input"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Network fee</Text>
          <Text style={styles.balanceText}>
            {estimating ? 'Estimating…' : estimate ? formatEthAmount(estimate.totalFeeEth) : 'Enter a valid address and amount'}
          </Text>
          {estimate && (
            <Text style={styles.helperText}>
              {estimate.gasUnits} gas units at {estimate.gasPriceGwei} gwei
            </Text>
          )}
          {insufficientEth && (
            <Text style={styles.errorText}>Not enough Sepolia ETH for gas.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!canSubmit || insufficientEth) && styles.primaryButtonDisabled]}
          onPress={handleSend}
          disabled={!canSubmit || insufficientEth}
          testID="sepolia-send-submit-btn"
        >
          {sending ? <ActivityIndicator color={COLORS.DARK_BG} /> : <Text style={styles.primaryButtonText}>Confirm and send</Text>}
        </TouchableOpacity>
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
    paddingBottom: 32,
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
  helperText: {
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },
  textInput: {
    borderRadius: 14,
    backgroundColor: '#171617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.WHITE,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.DARK_BG,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.RED,
    fontSize: 13,
    lineHeight: 18,
  },
});
