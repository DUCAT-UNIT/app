/**
 * CashuSendScreen
 * Send flow for Cashu e-cash
 * Options: 1) Send tokens (via QR/share), 2) Redeem to Runes (melt)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useCashuSendHandlers } from '../../hooks/useCashuSendHandlers';
import { styles } from './CashuSendScreen.styles';
import { formatFiat } from '../../utils/formatters';
import type { MeltQuoteResult } from '../../services/cashu/operations/cashuMeltOperations';

/**
 * Send mode type
 */
type SendMode = 'choose' | 'send' | 'redeem';

/**
 * Route parameters for CashuSendScreen
 */
interface CashuSendRouteParams {
  mode?: SendMode;
}

/**
 * Props for CashuSendScreen component
 */
interface CashuSendScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: CashuSendRouteParams }, 'params'>;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

/**
 * Props for Header component
 */
interface HeaderProps {
  title: string;
  onBack: () => void;
  testID?: string;
  backTestID?: string;
}

/**
 * Header component with back button and title
 */
function Header({ title, onBack, testID, backTestID }: HeaderProps): React.JSX.Element {
  return (
    <View style={styles.header} testID={testID}>
      <TouchableOpacity onPress={onBack} testID={backTestID}>
        <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

/**
 * Props for BalanceCard component
 */
interface BalanceCardProps {
  balance: number;
  testID?: string;
}

/**
 * Balance card component showing available Cashu balance
 */
function BalanceCard({ balance, testID }: BalanceCardProps): React.JSX.Element {
  return (
    <View style={styles.balanceCard} testID={testID}>
      <Text style={styles.balanceLabel}>Available Balance</Text>
      <View style={styles.balanceRow}>
        <Icon name="unit_symbol" size={16} color={COLORS.PRIMARY_BLUE} />
        <Text style={styles.balanceValue}>
          {formatFiat(balance)}
        </Text>
        <Text style={styles.balanceUnit}>sats</Text>
      </View>
    </View>
  );
}

/**
 * Props for AmountInput component
 */
interface AmountInputProps {
  amount: string;
  setAmount: (value: string) => void;
  balance: number;
  inputTestID?: string;
  maxTestID?: string;
}

/**
 * Amount input component with max button
 */
function AmountInput({ amount, setAmount, balance, inputTestID, maxTestID }: AmountInputProps): React.JSX.Element {
  return (
    <>
      <Text style={styles.inputLabel}>Amount (sats)</Text>
      <View style={styles.inputContainer}>
        <Icon name="unit_symbol" size={20} color={COLORS.SECONDARY_TEXT} />
        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          testID={inputTestID}
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={() => setAmount(balance.toString())} testID={maxTestID}>
        <Text style={styles.buttonText}>MAX</Text>
      </TouchableOpacity>
    </>
  );
}

export default function CashuSendScreen({ navigation, route }: CashuSendScreenProps): React.JSX.Element | null {
  const { balance, send, startMelt, finishMelt } = useCashu();
  const { wallet } = useWallet();

  const [mode, setMode] = useState<SendMode>(route?.params?.mode || 'choose');
  const [amount, setAmount] = useState('');
  const [redeemAddress] = useState(wallet?.taprootAddress || '');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [meltQuote, setMeltQuote] = useState<MeltQuoteResult | null>(null);

  const { handleSendToken, handleShareToken, handleStartRedeem, handleConfirmRedeem } = useCashuSendHandlers({
    amount, balance, redeemAddress, meltQuote, send, startMelt, finishMelt, navigation,
    setGeneratedToken, setMeltQuote, setIsLoading,
  });

  // Choose mode
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-send-screen">
        <Header title="Send Cashu" onBack={() => navigation.goBack()} testID="cashu-send-header" backTestID="cashu-send-back-btn" />
        <BalanceCard balance={balance} testID="cashu-send-balance" />
        <View style={styles.choiceContainer}>
          <TouchableScale style={styles.choiceCard} onPress={() => setMode('send')} testID="cashu-send-token-btn">
            <Icon name="qr_code" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Send Token</Text>
            <Text style={styles.choiceDesc}>Generate QR code or share Cashu token with someone</Text>
          </TouchableScale>
          <TouchableScale style={styles.choiceCard} onPress={() => setMode('redeem')} testID="cashu-send-redeem-btn">
            <Icon name="btc_logo" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Redeem Onchain UNIT</Text>
            <Text style={styles.choiceDesc}>Convert Cashu tokens back to onchain UNIT in your wallet</Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Show generated token QR
  if (mode === 'send' && generatedToken) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-token-qr-screen">
        <Header title="Share Token" onBack={() => { setGeneratedToken(null); setMode('choose'); }} testID="cashu-token-qr-header" backTestID="cashu-token-qr-back-btn" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.qrContainer} testID="cashu-token-qr-code">
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
          <Text style={styles.instructionText} testID="cashu-token-qr-amount">{amount} sats Cashu Token</Text>
          <Text style={styles.helpText}>Recipient can scan this QR code or you can share the token string</Text>
          <TouchableScale style={styles.button} onPress={() => handleShareToken(generatedToken)} testID="cashu-token-share-btn">
            <Icon name="share" size={20} color="white" />
            <Text style={styles.buttonText}>Share Token</Text>
          </TouchableScale>
          <TouchableScale style={styles.doneButton} onPress={() => navigation.goBack()} testID="cashu-token-done-btn">
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Amount input for sending
  if (mode === 'send') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-send-amount-screen">
        <Header title="Send Token" onBack={() => setMode('choose')} testID="cashu-send-amount-header" backTestID="cashu-send-amount-back-btn" />
        <View style={styles.inputContainer}>
          <BalanceCard balance={balance} testID="cashu-send-amount-balance" />
          <AmountInput amount={amount} setAmount={setAmount} balance={balance} inputTestID="cashu-send-amount-input" maxTestID="cashu-send-max-btn" />
          <TouchableScale
            style={[styles.button, !amount && styles.buttonDisabled]}
            onPress={handleSendToken}
            disabled={!amount || isLoading}
            testID="cashu-send-generate-btn"
          >
            {isLoading ? <ActivityIndicator size="small" color="white" testID="cashu-send-loading" /> : <Text style={styles.buttonText}>Generate Token</Text>}
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Confirm redeem
  if (mode === 'redeem' && meltQuote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-redeem-review-screen">
        <Header title="Confirm Redeem" onBack={() => setMeltQuote(null)} testID="cashu-redeem-review-header" backTestID="cashu-redeem-review-back-btn" />
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewTitle}>Review Transaction</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Amount</Text>
            <Text style={styles.reviewValue} testID="cashu-redeem-amount">{meltQuote.amount} sats</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Network Fee</Text>
            <Text style={styles.reviewValue} testID="cashu-redeem-fee">{meltQuote.fee} sats</Text>
          </View>
          <View style={[styles.reviewRow, styles.reviewTotal]}>
            <Text style={styles.reviewLabel}>Total</Text>
            <Text style={styles.reviewValue} testID="cashu-redeem-total">{meltQuote.total} sats</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>To Address</Text>
            <Text style={[styles.reviewValue, styles.addressValue]} numberOfLines={1} testID="cashu-redeem-address">{redeemAddress}</Text>
          </View>
          <TouchableScale style={styles.button} onPress={handleConfirmRedeem} disabled={isLoading} testID="cashu-redeem-confirm-btn">
            {isLoading ? <ActivityIndicator size="small" color="white" testID="cashu-redeem-loading" /> : <Text style={styles.buttonText}>Confirm Redeem</Text>}
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Redeem input
  if (mode === 'redeem') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-redeem-screen">
        <Header title="Redeem Onchain UNIT" onBack={() => setMode('choose')} testID="cashu-redeem-header" backTestID="cashu-redeem-back-btn" />
        <ScrollView style={styles.inputContainer}>
          <BalanceCard balance={balance} testID="cashu-redeem-balance" />
          <AmountInput amount={amount} setAmount={setAmount} balance={balance} inputTestID="cashu-redeem-amount-input" maxTestID="cashu-redeem-max-btn" />
          <Text style={styles.label}>Destination Address (Your Wallet)</Text>
          <View style={[styles.inputWrapper, styles.disabledInput]}>
            <TextInput style={styles.input} placeholder="tb1p..." value={redeemAddress} editable={false} autoCapitalize="none" autoCorrect={false} testID="cashu-redeem-address-input" />
          </View>
          <Text style={styles.helpTextSmall}>Redeeming to your wallet's taproot address</Text>
          <TouchableScale
            style={[styles.button, (!amount || !redeemAddress) && styles.buttonDisabled]}
            onPress={handleStartRedeem}
            disabled={!amount || !redeemAddress || isLoading}
            testID="cashu-redeem-continue-btn"
          >
            {isLoading ? <ActivityIndicator size="small" color="white" testID="cashu-redeem-input-loading" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}
