/**
 * CashuSendScreen
 * Send flow for Cashu e-cash
 * Options: 1) Send tokens (via QR/share), 2) Redeem to Runes (melt)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;
const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default function CashuSendScreen({ navigation, route }) {
  const { balance, send, startMelt, finishMelt } = useCashu();
  const { wallet } = useWallet();

  const [mode, setMode] = useState(route?.params?.mode || 'choose'); // 'choose', 'send', 'redeem'
  const [amount, setAmount] = useState('');
  const [redeemAddress, setRedeemAddress] = useState(wallet?.taprootAddress || '');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [meltQuote, setMeltQuote] = useState(null);

  const handleSendToken = useCallback(async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amountNum > balance) {
      Alert.alert('Insufficient Balance', `You only have ${balance} sats`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await send(amountNum);
      setGeneratedToken(result.token);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create token');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, send]);

  const handleShareToken = useCallback(async () => {
    if (!generatedToken) return;

    try {
      await Share.share({
        message: generatedToken,
        title: 'Cashu Token',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [generatedToken]);

  const handleStartRedeem = useCallback(async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amountNum > balance) {
      Alert.alert('Insufficient Balance', `You only have ${balance} sats`);
      return;
    }

    if (!redeemAddress.trim()) {
      Alert.alert('Error', 'No taproot address found in wallet');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMelt(redeemAddress.trim(), amountNum);
      setMeltQuote(quote);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create melt quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, balance, redeemAddress, startMelt]);

  const handleConfirmRedeem = useCallback(async () => {
    if (!meltQuote) return;

    setIsLoading(true);
    try {
      const result = await finishMelt(meltQuote.quoteId, meltQuote.total);

      Alert.alert(
        'Success!',
        `Redeemed ${meltQuote.amount} sats to Runes\nTransaction: ${result.txid}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to redeem tokens');
      setMeltQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [meltQuote, finishMelt, navigation]);

  // Choose mode
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Cashu</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <View style={styles.balanceRow}>
            <Icon name="unit_symbol" size={16} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.balanceValue}>{balance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</Text>
            <Text style={styles.balanceUnit}>sats</Text>
          </View>
        </View>

        <View style={styles.choiceContainer}>
          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('send')}
          >
            <Icon name="qr_code" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Send Token</Text>
            <Text style={styles.choiceDesc}>
              Generate QR code or share Cashu token with someone
            </Text>
          </TouchableScale>

          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('redeem')}
          >
            <Icon name="btc_logo" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Redeem Onchain UNIT</Text>
            <Text style={styles.choiceDesc}>
              Convert Cashu tokens back to onchain UNIT in your wallet
            </Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Send token mode
  if (mode === 'send') {
    if (generatedToken) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
              setGeneratedToken(null);
              setMode('choose');
            }}>
              <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share Token</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.qrContainer}>
              <QRCode
                value={generatedToken}
                size={QR_SIZE}
                backgroundColor="white"
                color="black"
                logo={require('../../assets/logos/unit-log.png')}
                logoSize={LOGO_SIZE}
                logoBackgroundColor="white"
                logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
              />
            </View>

            <Text style={styles.instructionText}>
              {amount} sats Cashu Token
            </Text>

            <Text style={styles.helpText}>
              Recipient can scan this QR code or you can share the token string
            </Text>

            <TouchableScale
              style={styles.button}
              onPress={handleShareToken}
            >
              <Icon name="share" size={20} color="white" />
              <Text style={styles.buttonText}>Share Token</Text>
            </TouchableScale>

            <TouchableScale
              style={styles.doneButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableScale>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Amount input for sending
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Token</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.balanceRow}>
              <Icon name="unit_symbol" size={16} color={COLORS.PRIMARY_BLUE} />
              <Text style={styles.balanceValue}>{balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</Text>
            </View>
          </View>

          <Text style={styles.label}>Amount (sats)</Text>
          <View style={styles.inputWrapper}>
            <Icon name="unit_symbol" size={20} color={COLORS.SECONDARY_TEXT} />
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <TouchableOpacity
            style={styles.maxButton}
            onPress={() => setAmount(balance.toString())}
          >
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>

          <TouchableScale
            style={[styles.button, !amount && styles.buttonDisabled]}
            onPress={handleSendToken}
            disabled={!amount || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Generate Token</Text>
            )}
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Redeem mode
  if (mode === 'redeem') {
    if (meltQuote) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setMeltQuote(null)}>
              <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Confirm Redeem</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.reviewContainer}>
            <Text style={styles.reviewTitle}>Review Transaction</Text>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Amount</Text>
              <Text style={styles.reviewValue}>{meltQuote.amount} sats</Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Network Fee</Text>
              <Text style={styles.reviewValue}>{meltQuote.fee} sats</Text>
            </View>

            <View style={[styles.reviewRow, styles.reviewTotal]}>
              <Text style={styles.reviewLabel}>Total</Text>
              <Text style={styles.reviewValue}>{meltQuote.total} sats</Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>To Address</Text>
              <Text style={[styles.reviewValue, styles.addressValue]} numberOfLines={1}>
                {redeemAddress}
              </Text>
            </View>

            <TouchableScale
              style={styles.button}
              onPress={handleConfirmRedeem}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>Confirm Redeem</Text>
              )}
            </TouchableScale>
          </View>
        </SafeAreaView>
      );
    }

    // Amount and address input
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Redeem Onchain UNIT</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.inputContainer}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.balanceRow}>
              <Icon name="unit_symbol" size={16} color={COLORS.PRIMARY_BLUE} />
              <Text style={styles.balanceValue}>{balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</Text>
            </View>
          </View>

          <Text style={styles.label}>Amount (sats)</Text>
          <View style={styles.inputWrapper}>
            <Icon name="unit_symbol" size={20} color={COLORS.SECONDARY_TEXT} />
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <TouchableOpacity
            style={styles.maxButton}
            onPress={() => setAmount(balance.toString())}
          >
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Destination Address (Your Wallet)</Text>
          <View style={[styles.inputWrapper, styles.disabledInput]}>
            <TextInput
              style={styles.input}
              placeholder="tb1p..."
              value={redeemAddress}
              editable={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.helpTextSmall}>
            Redeeming to your wallet's taproot address
          </Text>

          <TouchableScale
            style={[styles.button, (!amount || !redeemAddress) && styles.buttonDisabled]}
            onPress={handleStartRedeem}
            disabled={!amount || !redeemAddress || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  balanceCard: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  balanceUnit: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
  },
  choiceContainer: {
    flex: 1,
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
    gap: 16,
  },
  choiceCard: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  choiceDesc: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  scrollContent: {
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
    borderRadius: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionText: {
    fontSize: SCREEN_WIDTH < 375 ? 18 : 22,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  inputContainer: {
    flex: 1,
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: COLORS.DARK_BG,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  helpTextSmall: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginTop: -8,
    marginBottom: 24,
    marginLeft: 4,
  },
  maxButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },
  maxButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.WHITE,
  },
  doneButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    alignItems: 'center',
    minHeight: 52,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  reviewContainer: {
    flex: 1,
    padding: SCREEN_WIDTH < 375 ? 16 : 20,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    marginBottom: 24,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  reviewTotal: {
    borderBottomWidth: 2,
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  addressValue: {
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
