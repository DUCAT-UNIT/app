/**
 * CashuReceiveScreen
 * Receive flow for Cashu e-cash
 * Options: 1) Mint tokens from on-chain funds, 2) Receive tokens from QR/paste
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
import { useNavigation, NavigationProp, RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useCashuOperations } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import TouchableScale from '../../components/common/TouchableScale';
import { useCashuReceive } from '../../hooks/useCashuReceive';
import { decodeTokenMetadata } from '../../services/cashu/cashuWalletService';
import {
  DEFAULT_CASHU_UNIT,
  normalizeCashuUnit,
  type CashuUnit,
} from '../../services/cashu/cashuUnits';
import { getRunesAmount } from '../../utils/runesHelper';
import styles, { QR_SIZE, LOGO_SIZE } from './CashuReceiveScreen.styles';

interface CashuReceiveRouteParams {
  mode?: 'choose' | 'mint' | 'receive';
  cashuUnit?: CashuUnit;
}

interface CashuReceiveScreenProps {
  route: RouteProp<{ params: CashuReceiveRouteParams }, 'params'>;
}

export default function CashuReceiveScreen({ route }: CashuReceiveScreenProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
  const { wallet } = useWallet();
  const {
    startMint,
    startBtcMint,
    checkAndCompleteMint,
    checkAndCompleteBtcMint,
    receive,
    receiveBtc,
  } = useCashuOperations();
  const { runesBalance } = useBalance();

  const cashuUnit = normalizeCashuUnit(route?.params?.cashuUnit, DEFAULT_CASHU_UNIT);
  const isBtcCashu = cashuUnit === 'sat';
  const tokenName = isBtcCashu ? 'Turbo BTC' : 'Turbo UNIT';
  const assetName = isBtcCashu ? 'BTC' : 'UNIT';
  const onChainUnitBalance = React.useMemo(() => getRunesAmount(runesBalance), [runesBalance]);
  const availableRunesCents = React.useMemo(
    () => Math.round(onChainUnitBalance * 100),
    [onChainUnitBalance]
  );
  const qrLogo = isBtcCashu
    ? require('../../assets/logos/btc-logo.png')
    : require('../../assets/logos/unit-log.png');

  const formatDepositAmount = React.useCallback(
    (amountSmallestUnits: number): string =>
      isBtcCashu
        ? (amountSmallestUnits / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
        : String(amountSmallestUnits / 100),
    [isBtcCashu]
  );

  const receiveByDecodedUnit = React.useCallback(
    async (token: string) => {
      const metadata = decodeTokenMetadata(token);
      const tokenUnit = normalizeCashuUnit(metadata.unit ?? DEFAULT_CASHU_UNIT);
      return tokenUnit === 'sat' ? receiveBtc(token) : receive(token);
    },
    [receive, receiveBtc]
  );

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
    startMint: isBtcCashu ? startBtcMint : startMint,
    checkAndCompleteMint: isBtcCashu ? checkAndCompleteBtcMint : checkAndCompleteMint,
    receive: receiveByDecodedUnit,
    navigation,
    initialMode: route?.params?.mode,
    cashuUnit,
    senderTaprootAddress: wallet?.taprootAddress,
    availableRunesCents: isBtcCashu ? undefined : availableRunesCents,
  });

  const mintDisabled = !amount || isLoading || (!isBtcCashu && availableRunesCents <= 0);

  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-receive-screen">
        <Header
          title={`Receive ${tokenName}`}
          onBack={() => navigation.goBack()}
          testID="cashu-receive-header"
          backTestID="cashu-receive-back-btn"
        />
        <View style={styles.choiceContainer}>
          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('mint')}
            testID="cashu-receive-mint-btn"
          >
            <Icon
              name={isBtcCashu ? 'btc_logo' : 'unit_logo'}
              size={48}
              color={COLORS.PRIMARY_BLUE}
            />
            <Text style={styles.choiceTitle}>Mint from {assetName}</Text>
            <Text style={styles.choiceDesc}>
              Deposit {assetName} to mint {tokenName}
            </Text>
          </TouchableScale>

          <TouchableScale
            style={styles.choiceCard}
            onPress={() => setMode('receive')}
            testID="cashu-receive-token-btn"
          >
            <Icon name="qr_code" size={48} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.choiceTitle}>Receive Token</Text>
            <Text style={styles.choiceDesc}>
              Scan or paste a {tokenName} token from someone else
            </Text>
          </TouchableScale>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'mint' && mintQuote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-mint-qr-screen">
        <Header
          title={`Deposit ${assetName}`}
          onBack={resetMintQuote}
          testID="cashu-mint-qr-header"
          backTestID="cashu-mint-qr-back-btn"
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.qrContainer} testID="cashu-mint-qr-code">
            <QRCode
              value={mintQuote.depositAddress}
              size={QR_SIZE}
              backgroundColor="white"
              color="black"
              logo={qrLogo}
              logoSize={LOGO_SIZE}
              logoBackgroundColor="white"
              logoBorderRadius={Math.floor(LOGO_SIZE / 2)}
            />
          </View>

          <Text style={styles.instructionText} testID="cashu-mint-amount">
            Send {formatDepositAmount(mintQuote.amount ?? 0)} {assetName} to this address
          </Text>

          <TouchableOpacity
            style={styles.addressContainer}
            onPress={() => handleCopyAddress(mintQuote.depositAddress, Clipboard.setStringAsync)}
            activeOpacity={0.7}
            testID="cashu-mint-copy-btn"
          >
            <View style={styles.addressLabelRow}>
              <Text style={styles.addressLabelText}>Taproot Address</Text>
              <Text style={styles.tapToCopyText} testID="cashu-mint-copy-status">
                {justCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </View>
            <Text style={styles.addressText} testID="cashu-mint-address">
              {mintQuote.depositAddress}
            </Text>
          </TouchableOpacity>

          <View style={styles.waitingContainer} testID="cashu-mint-waiting">
            <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.waitingText}>Waiting for deposit confirmation...</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'mint') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="cashu-mint-screen">
        <Header
          title={`Mint ${tokenName}`}
          onBack={() => setMode('choose')}
          testID="cashu-mint-header"
          backTestID="cashu-mint-back-btn"
        />
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Amount ({isBtcCashu ? 'sats' : 'smallest units'})</Text>
          <View style={styles.inputWrapper}>
            <Icon
              name={isBtcCashu ? 'btc_symbol' : 'unit_symbol'}
              size={20}
              color={COLORS.SECONDARY_TEXT}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              testID="cashu-mint-amount-input"
            />
          </View>

          {!isBtcCashu && availableRunesCents <= 0 ? (
            <Text style={styles.warningText}>
              You need on-chain UNIT before minting Turbo UNIT.
            </Text>
          ) : !isBtcCashu ? (
            <Text style={styles.balanceText}>
              Available on-chain UNIT: {onChainUnitBalance.toFixed(2)}
            </Text>
          ) : null}

          <TouchableScale
            style={[styles.button, mintDisabled && styles.buttonDisabled]}
            onPress={handleAutoMint}
            disabled={mintDisabled}
            testID="cashu-mint-btn"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" testID="cashu-mint-loading" />
            ) : (
              <Text style={styles.buttonText}>Mint {tokenName}</Text>
            )}
          </TouchableScale>

          <Text style={styles.helpText}>
            This will send {assetName} to the mint and automatically issue {tokenName} once the
            transaction confirms.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="cashu-receive-token-screen">
      <Header
        title="Receive Token"
        onBack={() => setMode('choose')}
        testID="cashu-receive-token-header"
        backTestID="cashu-receive-token-back-btn"
      />
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{tokenName} Token</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={`Paste ${tokenName} token here (cashuB...)`}
            multiline
            numberOfLines={4}
            value={pasteValue}
            onChangeText={setPasteValue}
            testID="cashu-receive-token-input"
          />
        </View>

        <TouchableScale
          style={styles.pasteButton}
          onPress={async (): Promise<void> => {
            const clipboardContent = await Clipboard.getStringAsync();
            if (clipboardContent && clipboardContent.startsWith('cashu')) {
              setPasteValue(clipboardContent);
            } else {
              Alert.alert('No Token Found', `No ${tokenName} token found in clipboard`);
            }
          }}
          testID="cashu-receive-paste-btn"
        >
          <Icon name="qr_code" size={20} color={COLORS.PRIMARY_BLUE} />
          <Text style={styles.pasteButtonText}>Paste from Clipboard</Text>
        </TouchableScale>

        <Text style={styles.helpText}>
          You can also scan QR codes with your phone's camera app, then copy the token and paste it
          here.
        </Text>

        <TouchableScale
          style={[styles.button, !pasteValue && styles.buttonDisabled]}
          onPress={handleReceiveToken}
          disabled={!pasteValue || isLoading}
          testID="cashu-receive-submit-btn"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" testID="cashu-receive-loading" />
          ) : (
            <Text style={styles.buttonText}>Receive</Text>
          )}
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

interface HeaderProps {
  title: string;
  onBack: () => void;
  testID?: string;
  backTestID?: string;
}

function Header({ title, onBack, testID, backTestID }: HeaderProps): React.JSX.Element {
  return (
    <View style={styles.header} testID={testID}>
      <TouchableOpacity onPress={onBack} testID={backTestID}>
        <Icon name="back" size={24} color={COLORS.TEXT_PRIMARY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}
