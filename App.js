// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import { useFonts } from 'expo-font';

import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity, ActivityIndicator, TextInput, Image, Keyboard, Platform, Linking, SafeAreaView, StatusBar as RNStatusBar, Dimensions, Animated, PanResponder } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { encodeRunestone } from './runestone-encoder';

// Import utilities
import { satoshisToBTC, btcToSatoshis, formatAddress, formatSatoshis, formatBTC } from './utils/formatters';
import { fetchWithTimeout } from './utils/api';
import { deriveAddressesFromMnemonic, MUTINYNET_NETWORK } from './utils/bitcoin';
import { SECURE_KEYS } from './utils/constants';
import { COLORS } from './utils/colors';
import { parseErrorMessage } from './utils/errorParser';
import styles from './styles';

// Import services
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from './services/balanceService';
import * as AuthService from './services/authService';
import * as WalletService from './services/walletService';
import * as TransactionService from './services/transactionService';

// Import components
import WelcomeScreen from './components/WelcomeScreen';
import PinSetupScreen from './components/PinSetupScreen';
import LockScreen from './components/LockScreen';
import SettingsScreen from './components/SettingsScreen';
import SendScreen from './components/SendScreen';
import ReceiveScreen from './components/ReceiveScreen';
import WalletScreen from './components/WalletScreen';
import TransactionHistoryScreen from './components/TransactionHistoryScreen';
import AccountSwitcherModal from './components/AccountSwitcherModal';
import BiometricPromptModal from './components/BiometricPromptModal';
import Toast from './components/Toast';

// Import contexts
import { useWallet } from './contexts/WalletContext';

// Import hooks
import { useToast } from './hooks/useToast';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import { useAccountSwitcher } from './hooks/useAccountSwitcher';
import { useOnboarding } from './hooks/useOnboarding';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Initialize ECC library for bitcoinjs-lib (required for Taproot)
bitcoin.initEccLib(ecc);

export default function App() {
  // Load Cabinet Grotesk font
  const [fontsLoaded] = useFonts({
    'CabinetGrotesk-Regular': require('./assets/fonts/CabinetGrotesk-Regular.otf'),
    'CabinetGrotesk-Medium': require('./assets/fonts/CabinetGrotesk-Medium.otf'),
    'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
  });

  // Responsive constants
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight || 0);
  const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : (SCREEN_WIDTH > 414 ? 24 : 20);

  // Wallet context
  const {
    wallet,
    currentAccount,
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBalance,
    refreshing,
    btcPrice,
    loadingBtcPrice,
    utxos,
    loadingUtxos,
    showTotalInBTC,
    setShowTotalInBTC,
    showBTCInBTC,
    setShowBTCInBTC,
    showUnitInUnit,
    setShowUnitInUnit,
    fetchBalance,
    onRefresh,
    fetchUtxos,
    loadWallet,
    setWalletAddresses,
    switchAccount: switchAccountContext,
    resetWallet,
  } = useWallet();

  // Auth state
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Settings modal
  const [showReceiveSheet, setShowReceiveSheet] = useState(false); // Receive bottom sheet
  const [showTxHistory, setShowTxHistory] = useState(false); // Transaction history sheet
  const [viewingSeedPhrase, setViewingSeedPhrase] = useState(false); // Viewing seed phrase
  const [seedPhraseWords, setSeedPhraseWords] = useState([]); // Seed phrase from keychain
  const [seedPhraseVisible, setSeedPhraseVisible] = useState(false); // Show/hide seed words
  const [requestingSeedPhrase, setRequestingSeedPhrase] = useState(false); // Flag to show seed phrase after PIN auth
  const [isLoading, setIsLoading] = useState(true); // Initial loading state

  // Transaction intent state
  const [sendIntent, setSendIntent] = useState(null); // Current send transaction intent
  const [intentStep, setIntentStep] = useState('idle'); // 'idle' | 'selecting_asset' | 'entering_amount' | 'entering_address' | 'creating' | 'reviewing' | 'signing' | 'broadcasting' | 'confirmed'
  const [sendAssetType, setSendAssetType] = useState(null); // 'btc' | 'unit'
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState('taproot'); // 'segwit' | 'taproot'
  const [broadcastedTxid, setBroadcastedTxid] = useState(null); // TXID of broadcasted transaction
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const seedConfirmedRef = useRef(false); // Track if seed backup is confirmed without triggering re-renders
  const amountInputRef = useRef(null);

  // Toast notification hook
  const { showToast, toastMessage, toastVisible, toastType } = useToast();

  // Auth hook - handles authentication, biometrics, PIN
  const {
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    showBiometricPrompt,
    showFaceIdButton,
    settingUpPin,
    changingPin,
    showPinEntry,
    pin,
    confirmPin,
    pinError,
    pinStep,
    setIsAuthenticated,
    setBiometricEnabled,
    setShowBiometricPrompt,
    setShowFaceIdButton,
    setShowPinEntry,
    setSettingUpPin,
    setChangingPin,
    setPin,
    setConfirmPin,
    setPinError,
    setPinStep,
    authenticateUser,
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleLockScreenAuthenticated,
    loadBiometricPreference,
    resetAuth,
    startPinChange,
  } = useAuth({ onSeedConfirmed: setSeedConfirmed });

  // Animated values for swipe gestures (must be defined before hooks that use them)
  const seedPhraseTranslateX = useRef(new Animated.Value(0)).current;
  const seedPhrasePanResponderRef = useRef(null);
  const settingsTranslateX = useRef(new Animated.Value(0)).current;
  const settingsPanResponderRef = useRef(null);

  // Settings hook - handles settings actions
  const {
    privacyMode,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handlePrivacyModeToggle,
  } = useSettings({
    biometricEnabled,
    resetAuth,
    resetWallet,
    startPinChange,
    walletExistsRef: walletExists,
    seedPhraseTranslateX,
    setIsAuthenticated,
    setShowSettings,
    setShowPinEntry,
    setRequestingSeedPhrase,
    setSeedPhraseWords,
    setSeedPhraseVisible,
    setViewingSeedPhrase,
  });

  // Account switcher hook - handles account switching
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcher({ switchAccountContext });

  // Onboarding hook - handles wallet creation and import flow
  const {
    tempMnemonicWords,
    showingIntro,
    showingSeeds,
    verifyingSeeds,
    importingWallet,
    importSeedPhrase,
    verificationWords,
    requiredIndices,
    wordChoices,
    isImportedWallet,
    seedInputRefs,
    walletExistsRef: walletExists,
    setShowingIntro,
    setShowingSeeds,
    setImportingWallet,
    setImportSeedPhrase,
    setVerificationWords,
    setIsImportedWallet,
    createWallet,
    importWallet,
    proceedToVerification,
    verifySeeds,
    resetOnboarding,
  } = useOnboarding({
    currentAccount,
    setIsAuthenticated,
    setSettingUpPin,
    setSeedConfirmed,
    showToast,
  });

  // App lifecycle hook - handles screen capture, app state, and inactivity
  const { resetInactivityTimer } = useAppLifecycle({
    privacyMode,
    isAuthenticated,
    walletExists,
    seedConfirmedRef,
    isBiometricSupported,
    biometricEnabled,
    onLock: () => setIsAuthenticated(false),
    onAuthenticateUser: () => authenticateUser(),
  });

  // Keep seedConfirmedRef in sync with seedConfirmed state
  useEffect(() => {
    seedConfirmedRef.current = seedConfirmed;
  }, [seedConfirmed]);

  // Debug: Track intentStep changes
  useEffect(() => {
  }, [intentStep, sendIntent]);


  // Keyboard listeners for bottom sheet
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Load wallet from secure storage on app start
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        // Load biometric preference from storage
        await loadBiometricPreference();

        // Load wallet using context (handles addresses and balances)
        const result = await loadWallet();

        if (result.exists) {
          // Wallet exists - set up auth flow
          setSeedConfirmed(true);
          walletExists.current = true;
          setIsAuthenticated(false); // Show locked screen
        } else {
          // No wallet exists - allow access to create/import screen
          walletExists.current = false;
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      } finally {
        // Hide loading screen after a brief delay to show the logo
        setTimeout(() => setIsLoading(false), 1500);
      }
    };

    initializeWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Create pan responders for swipe gestures
  // Settings screen pan responder
  if (!settingsPanResponderRef.current) {
    settingsPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          settingsTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          Animated.timing(settingsTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setShowSettings(false);
          });
        } else {
          Animated.spring(settingsTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  // Seed phrase screen pan responder
  if (!seedPhrasePanResponderRef.current) {
    seedPhrasePanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipeRight = gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          seedPhraseTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          Animated.timing(seedPhraseTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setViewingSeedPhrase(false);
            setSeedPhraseWords([]);
            setSeedPhraseVisible(false);
          });
        } else {
          Animated.spring(seedPhraseTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }



  // Create an unsigned PSBT for the transaction
  const createSendIntent = async () => {
    try {
      // Trim whitespace from recipient address
      const trimmedRecipient = sendRecipient.trim();
      setIntentStep('creating');

      // Validate inputs
      if (!trimmedRecipient || !sendAmount) {
        console.error('Missing recipient or amount');
        showToast('Please enter recipient address and amount', 'error');
        setIntentStep('idle');
        return;
      }

      // Update the state with trimmed recipient
      setSendRecipient(trimmedRecipient);

      // Branch based on asset type
      if (sendAssetType === 'btc') {
        await createBtcIntent();
      } else if (sendAssetType === 'unit') {
        await createUnitIntent();
      } else {
        console.error('Invalid asset type:', sendAssetType);
        showToast('Invalid asset type', 'error');
        setIntentStep('idle');
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
    }
  };

  // Create BTC transaction using TransactionService
  const createBtcIntent = async () => {
    try {
      const intent = await TransactionService.createBtcIntent(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount
      );

      setSendIntent(intent);
      setIntentStep('reviewing');

      // Debug: Check state after a moment
      setTimeout(() => {
      }, 100);
    } catch (error) {
      console.error('Failed to create BTC transaction:', error);
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
      throw error;
    }
  };

  // Create UNIT (Rune) transaction using TransactionService
  const createUnitIntent = async () => {
    try {
      const intent = await TransactionService.createUnitIntent(
        sendRecipient,
        sendAmount,
        wallet.taprootAddress,
        wallet.segwitAddress,
        currentAccount
      );

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      console.error('Failed to create UNIT transaction:', error);
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
      throw error;
    }
  };

  // Sign the PSBT using TransactionService
  const signIntent = async () => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        showToast('No intent to sign', 'error');
        setIntentStep('idle');
        return;
      }

      const { signedTxHex, txid } = await TransactionService.signIntent(sendIntent, currentAccount);

      // Update intent with signed transaction
      const signedIntent = {
        ...sendIntent,
        signedTxHex,
        txid,
      };

      setSendIntent(signedIntent);
      setIntentStep('broadcasting');

      // Automatically broadcast
      await broadcastIntent(signedIntent);
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('reviewing');
    }
  };

  // Broadcast the signed transaction using TransactionService
  const broadcastIntent = async (intent = sendIntent) => {
    try {
      if (!intent || !intent.signedTxHex) {
        console.error('No signed transaction to broadcast');
        showToast('No signed transaction to broadcast', 'error');
        return;
      }

      const txid = await TransactionService.broadcastTransaction(intent.signedTxHex);

      // Store txid and show success screen
      setBroadcastedTxid(txid);
      setIntentStep('confirmed');

      // Refresh balances
      fetchBalance();
    } catch (error) {
      console.error('Broadcast error:', error);
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('reviewing');
    }
  };

  const getCurrentAddress = () => {
    // Return taproot address as default for displaying
    if (!wallet) return null;
    return wallet.taprootAddress;
  };

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
    showToast('Address copied to clipboard');
  };

  const resetWalletAndState = async () => {
    // Clear secure storage
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);

    // Reset onboarding state (clears temp mnemonic, resets wallet, etc.)
    resetOnboarding();

    // Clear auth state
    setSeedConfirmed(false);
  };


  // PIN setup completion callback wrapper (adds isImportedWallet reset)
  const handlePinSetupCompleteWrapper = () => {
    handlePinSetupComplete();
    setIsImportedWallet(false);
  };

  // PIN change completion callback wrapper (adds isImportedWallet reset)
  const handlePinChangeCompleteWrapper = () => {
    handlePinChangeComplete();
    setIsImportedWallet(false);
  };

  // Lock screen authentication callback wrapper (checks for seed phrase request)
  const handleLockScreenAuthenticatedWrapper = async () => {
    handleLockScreenAuthenticated();

    // Check if user was trying to view seed phrase
    if (requestingSeedPhrase) {
      setRequestingSeedPhrase(false);
      try {
        const mnemonic = await AuthService.getMnemonic();
        if (mnemonic) {
          setSeedPhraseWords(mnemonic.split(' '));
          setSeedPhraseVisible(false);
          seedPhraseTranslateX.setValue(0);
          setViewingSeedPhrase(true);
        } else {
          showToast('Recovery phrase not found', 'error');
        }
      } catch (error) {
        showToast(parseErrorMessage(error), 'error');
      }
    }
  };

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  // Show loading splash screen while initializing
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('./assets/unit-logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTitle}>UNIT</Text>
        <Text style={styles.splashSubtitle}>Mutinynet Edition</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  // Show PIN entry screen
  // PIN Setup Screen (Step 4 of onboarding)
  if (settingUpPin) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A1A', paddingHorizontal: 0 }}>
        <View style={styles.mutinynetBanner}>
          <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
        </View>
        <PinSetupScreen
          changingPin={changingPin}
          isBiometricSupported={isBiometricSupported}
          onPinSetupComplete={handlePinSetupCompleteWrapper}
          onPinChangeComplete={handlePinChangeCompleteWrapper}
          fetchBalance={fetchBalance}
          showToast={showToast}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // Lock Screen (PIN entry for authentication)
  if (showPinEntry) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A1A', paddingHorizontal: 0 }}>
        <View style={styles.mutinynetBanner}>
          <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
        </View>
        <LockScreen onAuthenticated={handleLockScreenAuthenticatedWrapper} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Account Picker Modal
  if (showAccountPicker) {
    return (
      <AccountSwitcherModal
        visible={showAccountPicker}
        accountIndex={newAccountIndex}
        switchingAccount={switchingAccount}
        onClose={() => setShowAccountPicker(false)}
        onAccountIndexChange={setNewAccountIndex}
        onSwitch={switchAccount}
        styles={styles}
      />
    );
  }

  // Show locked screen if not authenticated and wallet exists AND seed backup confirmed AND not in setup flow
  if (!isAuthenticated && wallet && seedConfirmed && !showingIntro && !showingSeeds && !verifyingSeeds && !settingUpPin) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A1A', paddingHorizontal: 0 }}>
        <View style={styles.mutinynetBanner}>
          <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
        </View>
        <LockScreen
          onAuthenticated={handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={showFaceIdButton && !showBiometricPrompt}
          onFaceIdPress={authenticateUser}
        />

        <BiometricPromptModal
          visible={showBiometricPrompt}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowBiometricPrompt(false)}
          onBiometricEnabled={(enabled, authSuccess) => {
            setBiometricEnabled(enabled);
            if (authSuccess) {
              setIsAuthenticated(true);
            }
          }}
          onBiometricDisabled={() => setBiometricEnabled(false)}
          styles={styles}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <View
        style={{ flex: 1, backgroundColor: '#1A1A1A' }}
        onTouchStart={resetInactivityTimer}
      >
      {/* Mutinynet Banner - Shows on all screens */}
      <View style={styles.mutinynetBanner}>
        <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
      </View>

      {(!wallet || importingWallet || showingIntro || showingSeeds || verifyingSeeds) ? (
        <WelcomeScreen
          wallet={wallet}
          importingWallet={importingWallet}
          showingIntro={showingIntro}
          showingSeeds={showingSeeds}
          verifyingSeeds={verifyingSeeds}
          tempMnemonicWords={tempMnemonicWords}
          importSeedPhrase={importSeedPhrase}
          verificationWords={verificationWords}
          requiredIndices={requiredIndices}
          wordChoices={wordChoices}
          seedInputRefs={seedInputRefs}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          createWallet={createWallet}
          importWallet={importWallet}
          resetWallet={resetWalletAndState}
          proceedToVerification={proceedToVerification}
          verifySeeds={verifySeeds}
        />
      ) : (
        <WalletScreen
          styles={styles}
          onSendPress={() => setIntentStep('selecting_asset')}
          onReceivePress={() => setShowReceiveSheet(true)}
          onHistoryPress={() => setShowTxHistory(true)}
          onSettingsPress={() => {
            settingsTranslateX.setValue(0);
            setShowSettings(true);
          }}
          sendAddressType={sendAddressType}
          switchingAccount={switchingAccount}
        />
      )}

      {/* Send Transaction Bottom Sheets */}
      <SendScreen
        intentStep={intentStep}
        sendAssetType={sendAssetType}
        sendAmount={sendAmount}
        sendRecipient={sendRecipient}
        sendIntent={sendIntent}
        broadcastedTxid={broadcastedTxid}
        keyboardHeight={keyboardHeight}
        amountInputRef={amountInputRef}
        btcBalance={segwitBalance}
        unitBalance={runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0}
        btcPrice={btcPrice}
        setIntentStep={setIntentStep}
        setSendAssetType={setSendAssetType}
        setSendAmount={setSendAmount}
        setSendRecipient={setSendRecipient}
        setSendIntent={setSendIntent}
        setBroadcastedTxid={setBroadcastedTxid}
        createSendIntent={createSendIntent}
        signIntent={signIntent}
      />

      {/* Receive Bottom Sheet */}
      <ReceiveScreen
        styles={styles}
        showReceiveSheet={showReceiveSheet}
        onClose={() => setShowReceiveSheet(false)}
        segwitAddress={wallet?.segwitAddress || ''}
        taprootAddress={wallet?.taprootAddress || ''}
        showToast={showToast}
      />

      {/* Transaction History Bottom Sheet */}
      <TransactionHistoryScreen
        styles={styles}
        showHistorySheet={showTxHistory}
        onClose={() => setShowTxHistory(false)}
        segwitAddress={wallet?.segwitAddress || ''}
        taprootAddress={wallet?.taprootAddress || ''}
      />

      <StatusBar style="light" />

      {/* Toast Notification */}
      <Toast visible={toastVisible} message={toastMessage} type={toastType} styles={styles} />
    </View>

    {/* Settings Screen Overlay */}
    {showSettings && (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1A1A1A',
          zIndex: 1000,
          transform: [{ translateX: settingsTranslateX }]
        }}
        {...settingsPanResponderRef.current.panHandlers}
      >
        <View style={styles.mutinynetBanner}>
          <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
        </View>
        <SettingsScreen
          onClose={() => setShowSettings(false)}
          onViewSeedPhrase={handleViewSeedPhrase}
          onChangePin={handleChangePin}
          onSwitchAccount={() => {
            setShowSettings(false);
            setShowAccountPicker(true);
          }}
          onLockWallet={handleLogout}
          onDeleteWallet={handleDeleteWallet}
          onPrivacyModeToggle={handlePrivacyModeToggle}
          privacyMode={privacyMode}
        />
      </Animated.View>
    )}

    {/* Seed Phrase Viewing Screen Overlay */}
    {viewingSeedPhrase && (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1A1A1A',
          zIndex: 1000,
          transform: [{ translateX: seedPhraseTranslateX }]
        }}
        {...seedPhrasePanResponderRef.current.panHandlers}
      >
        <View style={styles.mutinynetBanner}>
          <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
        </View>
        <View style={[styles.container, { paddingTop: 0, flex: 1 }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>DUCAT</Text>
            </View>
          </View>

          <View style={styles.walletInfo}>
            <Text style={styles.seedPhraseTitle}>Recovery Phrase</Text>

            <Text style={styles.seedPhraseWarning}>
              ⚠️ Keep these words safe and private!{'\n'}
              Never share them with anyone.
            </Text>

            <View style={styles.seedGrid}>
              {seedPhraseWords.map((word, index) => (
                <View key={index} style={styles.seedBox}>
                  <Text style={styles.seedNumber}>{index + 1}</Text>
                  <Text style={styles.seedWord}>
                    {seedPhraseVisible ? word : '••••••'}
                  </Text>
                </View>
              ))}
            </View>

            {!seedPhraseVisible && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => setSeedPhraseVisible(true)}
              >
                <Text style={styles.buttonText}>Show Recovery Phrase</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, seedPhraseVisible && styles.secondaryButton]}
              onPress={() => {
                setViewingSeedPhrase(false);
                setSeedPhraseWords([]);
                setSeedPhraseVisible(false);
              }}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    )}

    <BiometricPromptModal
      visible={showBiometricPrompt}
      isAuthenticated={isAuthenticated}
      onClose={() => setShowBiometricPrompt(false)}
      onBiometricEnabled={(enabled, authSuccess) => {
        setBiometricEnabled(enabled);
        if (authSuccess) {
          setIsAuthenticated(true);
        }
      }}
      onBiometricDisabled={() => setBiometricEnabled(false)}
      onShowPinEntry={() => setShowPinEntry(true)}
      styles={styles}
    />
    </>
  );
}
