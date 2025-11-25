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
import QRCode from 'react-native-qrcode-svg';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useCashuSendHandlers } from '../../hooks/useCashuSendHandlers';
import { styles } from './CashuSendScreen.styles';

const SCREEN_WIDTH = Dimensions.get('window').width;
const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

// Header component
function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

// Balance card component
function BalanceCard({ balance }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Available Balance</Text>
      <View style={styles.balanceRow}>
        <Icon name="unit_symbol" size={16} color={COLORS.PRIMARY_BLUE} />
        <Text style={styles.balanceValue}>
          {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.balanceUnit}>sats</Text>
      </View>
    </View>
  );
}

// Amount input component
function AmountInput({ amount, setAmount, balance }) {
  return (
    <>
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
      <TouchableOpacity style={styles.maxButton} onPress={() => setAmount(balance.toString())}>
        <Text style={styles.maxButtonText}>MAX</Text>
      </TouchableOpacity>
    </>
  );
}

export default function CashuSendScreen({ navigation, route }) {
  const { balance, send, startMelt, finishMelt } = useCashu();
  const { wallet } = useWallet();

  const [mode, setMode] = useState(route?.params?.mode || 'choose');
  const [amount, setAmount] = useState('');
  const [redeemAddress] = useState(wallet?.taprootAddress || '');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [meltQuote, setMeltQuote] = useState(null);

  const { handleSendToken, handleShareToken, handleStartRedeem, handleConfirmRedeem } = useCashuSendHandlers({
    amount, balance, redeemAddress, meltQuote, send, startMelt, finishMelt, navigation,
    setGeneratedToken, setMeltQuote, setIsLoading,
  });

  // Choose mode
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Send Cashu" onBack={() => navigation.goBack()} />
        <BalanceCard balance={balance} />
        <View style={styles.choiceContainer}>
          <TouchableScale style={styles.choiceCard} onPress={() => setMode('send')}>
            <Icon name="qr_code" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Send Token</Text>
            <Text style={styles.choiceDesc}>Generate QR code or share Cashu token with someone</Text>
          </TouchableScale>
          <TouchableScale style={styles.choiceCard} onPress={() => setMode('redeem')}>
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Share Token" onBack={() => { setGeneratedToken(null); setMode('choose'); }} />
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
          <Text style={styles.instructionText}>{amount} sats Cashu Token</Text>
          <Text style={styles.helpText}>Recipient can scan this QR code or you can share the token string</Text>
          <TouchableScale style={styles.button} onPress={() => handleShareToken(generatedToken)}>
            <Icon name="share" size={20} color="white" />
            <Text style={styles.buttonText}>Share Token</Text>
          </TouchableScale>
          <TouchableScale style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Amount input for sending
  if (mode === 'send') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Send Token" onBack={() => setMode('choose')} />
        <View style={styles.inputContainer}>
          <BalanceCard balance={balance} />
          <AmountInput amount={amount} setAmount={setAmount} balance={balance} />
          <TouchableScale
            style={[styles.button, !amount && styles.buttonDisabled]}
            onPress={handleSendToken}
            disabled={!amount || isLoading}
          >
            {isLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>Generate Token</Text>}
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Confirm redeem
  if (mode === 'redeem' && meltQuote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Confirm Redeem" onBack={() => setMeltQuote(null)} />
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
            <Text style={[styles.reviewValue, styles.addressValue]} numberOfLines={1}>{redeemAddress}</Text>
          </View>
          <TouchableScale style={styles.button} onPress={handleConfirmRedeem} disabled={isLoading}>
            {isLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>Confirm Redeem</Text>}
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Redeem input
  if (mode === 'redeem') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Redeem Onchain UNIT" onBack={() => setMode('choose')} />
        <ScrollView style={styles.inputContainer}>
          <BalanceCard balance={balance} />
          <AmountInput amount={amount} setAmount={setAmount} balance={balance} />
          <Text style={styles.label}>Destination Address (Your Wallet)</Text>
          <View style={[styles.inputWrapper, styles.disabledInput]}>
            <TextInput style={styles.input} placeholder="tb1p..." value={redeemAddress} editable={false} autoCapitalize="none" autoCorrect={false} />
          </View>
          <Text style={styles.helpTextSmall}>Redeeming to your wallet's taproot address</Text>
          <TouchableScale
            style={[styles.button, (!amount || !redeemAddress) && styles.buttonDisabled]}
            onPress={handleStartRedeem}
            disabled={!amount || !redeemAddress || isLoading}
          >
            {isLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}
