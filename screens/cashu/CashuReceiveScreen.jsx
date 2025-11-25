/**
 * CashuReceiveScreen
 * Receive flow for Cashu e-cash
 * Options: 1) Mint tokens from Runes deposit, 2) Receive tokens from QR/paste
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useCashu } from '../../contexts/CashuContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useCashuReceive } from '../../hooks/useCashuReceive';
import styles, { QR_SIZE, LOGO_SIZE } from './CashuReceiveScreen.styles';

export default function CashuReceiveScreen({ route }) {
  const navigation = useNavigation();
  const { startMint, checkAndCompleteMint, receive } = useCashu();

  const {
    mode,
    setMode,
    amount,
    setAmount,
    mintQuote,
    isLoading,
    pasteValue,
    setPasteValue,
    justCopied,
    handleReceiveToken,
    handleAutoMint,
    handleCopyAddress,
    resetMintQuote,
  } = useCashuReceive({
    startMint,
    checkAndCompleteMint,
    receive,
    navigation,
    initialMode: route?.params?.mode,
  });

  // Choose mode
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Receive Cashu" onBack={() => navigation.goBack()} />
        <View style={styles.choiceContainer}>
          <TouchableScale style={styles.choiceCard} onPress={() => setMode('mint')}>
            <Icon name="btc_logo" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Mint from Runes</Text>
            <Text style={styles.choiceDesc}>
              Deposit UNIT runes to mint Cashu tokens
            </Text>
          </TouchableScale>

          <TouchableScale style={styles.choiceCard} onPress={() => setMode('receive')}>
            <Icon name="qr_code" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Receive Token</Text>
            <Text style={styles.choiceDesc}>
              Scan or paste a Cashu token from someone else
            </Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  // Mint mode with QR
  if (mode === 'mint' && mintQuote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Deposit Runes" onBack={resetMintQuote} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.qrContainer}>
            <QRCode
              value={mintQuote.depositAddress}
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
            Send {mintQuote.amount} UNIT to this address
          </Text>

          <TouchableOpacity
            style={styles.addressContainer}
            onPress={() => handleCopyAddress(mintQuote.depositAddress, Clipboard.setStringAsync)}
            activeOpacity={0.7}
          >
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>Taproot Address</Text>
              <Text style={styles.tapToCopyText}>
                {justCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </View>
            <Text style={styles.addressText}>{mintQuote.depositAddress}</Text>
          </TouchableOpacity>

          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.waitingText}>
              Waiting for deposit confirmation...
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Mint mode - amount input
  if (mode === 'mint') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Mint Cashu" onBack={() => setMode('choose')} />
        <View style={styles.inputContainer}>
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

          <TouchableScale
            style={[styles.button, !amount && styles.buttonDisabled]}
            onPress={handleAutoMint}
            disabled={!amount || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Mint Cashu</Text>
            )}
          </TouchableScale>

          <Text style={styles.helpText}>
            This will send UNIT to the mint and automatically issue Cashu tokens once the transaction confirms.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Receive mode
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Receive Token" onBack={() => setMode('choose')} />
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Cashu Token</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Paste Cashu token here (cashuA...)"
            multiline
            numberOfLines={4}
            value={pasteValue}
            onChangeText={setPasteValue}
          />
        </View>

        <TouchableScale
          style={styles.pasteButton}
          onPress={async () => {
            const clipboardContent = await Clipboard.getStringAsync();
            if (clipboardContent && clipboardContent.startsWith('cashu')) {
              setPasteValue(clipboardContent);
            } else {
              Alert.alert('No Token Found', 'No Cashu token found in clipboard');
            }
          }}
        >
          <Icon name="qr_code" size={20} color={COLORS.PRIMARY_BLUE} />
          <Text style={styles.pasteButtonText}>Paste from Clipboard</Text>
        </TouchableScale>

        <Text style={styles.helpText}>
          You can also scan QR codes with your phone's camera app, then copy the token and paste it here.
        </Text>

        <TouchableScale
          style={[styles.button, !pasteValue && styles.buttonDisabled]}
          onPress={handleReceiveToken}
          disabled={!pasteValue || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Receive</Text>
          )}
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

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
