/**
 * CashuReceiveScreen
 * Receive flow for Cashu e-cash
 * Options: 1) Mint tokens from Runes deposit, 2) Receive tokens from QR/paste
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { decodeCashuToken } from '../../utils/emojiEncoder';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : 20;
const QR_SIZE = SCREEN_WIDTH < 375 ? Math.min(SCREEN_WIDTH * 0.5, 180) : Math.min(SCREEN_WIDTH * 0.6, 220);
const LOGO_SIZE = Math.floor(QR_SIZE * 0.21);

export default function CashuReceiveScreen({ route }) {
  const navigation = useNavigation();
  const { startMint, checkAndCompleteMint, receive, autoMint } = useCashu();
  const { wallet } = useWallet();
  const { setSendAssetType, setSendAmount, setSendRecipient, setIntentStep } = useSendFlow();

  const [mode, setMode] = useState(route?.params?.mode || 'choose'); // 'choose', 'mint', 'receive'
  const [amount, setAmount] = useState('');
  const [mintQuote, setMintQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [justCopied, setJustCopied] = useState(false);

  // Poll for deposit confirmation
  useEffect(() => {
    if (!mintQuote || mode !== 'mint') return;

    const interval = setInterval(async () => {
      try {
        const result = await checkAndCompleteMint(mintQuote.quoteId);
        if (result.completed) {
          clearInterval(interval);
          Alert.alert(
            'Success!',
            `Minted ${result.amount} sats worth of Cashu tokens`,
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error checking mint:', error);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [mintQuote, mode, checkAndCompleteMint, navigation]);

  const handleStartMint = useCallback(async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const quote = await startMint(amountNum);
      setMintQuote(quote);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create mint quote');
    } finally {
      setIsLoading(false);
    }
  }, [amount, startMint]);

  const handleReceiveToken = useCallback(async () => {
    if (!pasteValue.trim()) {
      Alert.alert('Invalid Token', 'Please paste a Cashu token');
      return;
    }

    setIsLoading(true);
    try {
      let tokenToReceive = pasteValue.trim();

      // Check if it's an emoji token (doesn't start with 'cashu')
      if (!tokenToReceive.startsWith('cashu')) {
        console.log('[CashuReceive] Detected emoji token, decoding...');
        try {
          tokenToReceive = decodeCashuToken(tokenToReceive);
          console.log('[CashuReceive] Successfully decoded emoji token');
        } catch (error) {
          console.error('[CashuReceive] Failed to decode emoji token:', error);
          Alert.alert('Invalid Token', 'Failed to decode emoji token. Please check and try again.');
          setIsLoading(false);
          return;
        }
      }

      const result = await receive(tokenToReceive);
      Alert.alert(
        'Success!',
        `Received ${result.amount} sats worth of Cashu tokens`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to receive token');
    } finally {
      setIsLoading(false);
    }
  }, [pasteValue, receive, navigation]);

  const handleCopyAddress = async () => {
    if (mintQuote?.depositAddress) {
      await Clipboard.setStringAsync(mintQuote.depositAddress);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  const handleAutoMint = useCallback(async () => {
    console.log('🔵 handleAutoMint called, amount:', amount);

    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    console.log('🔵 Creating mint quote for amount:', amountNum);
    setIsLoading(true);

    try {
      // Create mint quote and get deposit address
      const quote = await startMint(amountNum);
      console.log('🔵 Mint quote created:', quote);

      // Navigate to SendFlow with all parameters in route params
      console.log('🔵 Navigating to Send flow with params...');

      navigation.dispatch(
        CommonActions.navigate({
          name: 'SendFlow',
          params: {
            screen: 'Processing',
            params: {
              fromScreen: 'CashuReceive',
              action: 'create_intent',
              cashuMint: true,
              quoteId: quote.quoteId,
              // Pass send flow params directly
              assetType: 'unit',
              amount: amountNum.toString(),
              recipient: quote.depositAddress,
            },
          },
        })
      );

      setIsLoading(false);
    } catch (error) {
      console.error('❌ Auto mint error:', error);
      Alert.alert('Error', error.message || 'Failed to create mint quote');
      setIsLoading(false);
    }
  }, [amount, startMint, setSendAssetType, setSendAmount, setSendRecipient, navigation]);

  // Choose mode
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receive Cashu</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.choiceContainer}>
          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('mint')}
          >
            <Icon name="btc_logo" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Mint from Runes</Text>
            <Text style={styles.choiceDesc}>
              Deposit UNIT runes to mint Cashu tokens
            </Text>
          </TouchableScale>

          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('receive')}
          >
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

  // Mint mode
  if (mode === 'mint') {
    if (mintQuote) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
              setMintQuote(null);
              setMode('choose');
            }}>
              <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Deposit Runes</Text>
            <View style={{ width: 24 }} />
          </View>

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
              onPress={handleCopyAddress}
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

    // Amount input for minting
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mint Cashu</Text>
          <View style={{ width: 24 }} />
        </View>

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMode('choose')}>
          <Icon name="arrow_left" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Token</Text>
        <View style={{ width: 24 }} />
      </View>

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
    marginTop: 8,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH < 375 ? 18 : 20,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  choiceContainer: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    gap: 16,
  },
  choiceCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  choiceDesc: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
    flexGrow: 1,
  },
  qrContainer: {
    backgroundColor: COLORS.WHITE,
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
    fontSize: SCREEN_WIDTH < 375 ? 16 : 18,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 24,
    textAlign: 'center',
  },
  addressContainer: {
    width: '100%',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  addressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabelText: {
    fontSize: 12,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
  tapToCopyText: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
    lineHeight: 20,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.SECONDARY_TEXT,
  },
  inputContainer: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  pasteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
    color: COLORS.VERY_LIGHT_GRAY,
  },
  button: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  helpText: {
    fontSize: 13,
    fontFamily: 'CabinetGrotesk-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
