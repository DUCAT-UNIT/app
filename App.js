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
import { Text, View, TouchableOpacity, ActivityIndicator, TextInput, Image, Keyboard, Platform, Linking, SafeAreaView, StatusBar as RNStatusBar, Dimensions, Animated, PanResponder, AppState } from 'react-native';
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
import { ERRORS, SUCCESS } from './utils/messages';
import styles from './styles';

// Import services
import { fetchWalletBalances, fetchUtxos as fetchUtxosService, fetchBtcPrice as fetchBtcPriceService } from './services/balanceService';
import * as AuthService from './services/authService';
import * as WalletService from './services/walletService';
import * as TransactionService from './services/transactionService';
import * as BackgroundTaskService from './services/backgroundTaskService';

// Import components (only those used in App.js now)
import SplashScreen from './components/SplashScreen';
import AccountSwitcherModal from './components/AccountSwitcherModal';
import ConfirmationModal from './components/ConfirmationModal';

// Import pages
import OnboardingPage from './pages/OnboardingPage';
import WalletPage from './pages/WalletPage';

// Import contexts
import { useWallet } from './contexts/WalletContext';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { useTransaction, TransactionProvider } from './contexts/TransactionContext';

// Import hooks
import { useToast } from './hooks/useToast';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useTransactionPolling } from './hooks/useTransactionPolling';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { useAccountSwitcher } from './hooks/useAccountSwitcher';
import { useOnboarding } from './hooks/useOnboarding';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Initialize ECC library for bitcoinjs-lib (required for Taproot)
bitcoin.initEccLib(ecc);

// Main App component - wraps everything with providers
export default function App() {
  // seedConfirmed state needs to be here to pass to AuthProvider
  const [seedConfirmed, setSeedConfirmed] = useState(false);

  return (
    <AuthProvider onSeedConfirmed={setSeedConfirmed}>
      <WalletProviderWrapper seedConfirmed={seedConfirmed} setSeedConfirmed={setSeedConfirmed} />
    </AuthProvider>
  );
}

// Wrapper to access wallet context and provide transaction context
function WalletProviderWrapper({ seedConfirmed, setSeedConfirmed }) {
  const wallet = useWallet();
  const { showToast } = useToast();
  const { startPolling: startTransactionPolling } = useTransactionPolling();
  const { sendTransactionConfirmedNotification, notificationsEnabled } = useNotifications();

  return (
    <TransactionProvider
      wallet={wallet.wallet}
      currentAccount={wallet.currentAccount}
      showToast={showToast}
      startTransactionPolling={startTransactionPolling}
      sendTransactionConfirmedNotification={sendTransactionConfirmedNotification}
      notificationsEnabled={notificationsEnabled}
      fetchBalance={wallet.fetchBalance}
    >
      <AppContent seedConfirmed={seedConfirmed} setSeedConfirmed={setSeedConfirmed} />
    </TransactionProvider>
  );
}

// AppContent - actual app logic
function AppContent({ seedConfirmed, setSeedConfirmed }) {
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
  // seedConfirmed now passed as prop from App wrapper
  const [activeTab, setActiveTab] = useState('wallet'); // Bottom navigation active tab (shared with WalletPage)
  const [showSettings, setShowSettings] = useState(false); // Settings modal (used by useSettings hook)
  const [vaultCredentials, setVaultCredentials] = useState(null); // Wallet credentials for vault WebView
  const [autoCreateVaultTrigger, setAutoCreateVaultTrigger] = useState(0); // Counter to trigger vault auto-creation
  const [viewingSeedPhrase, setViewingSeedPhrase] = useState(false); // Viewing seed phrase
  const [seedPhraseWords, setSeedPhraseWords] = useState([]); // Seed phrase from keychain
  const [seedPhraseVisible, setSeedPhraseVisible] = useState(false); // Show/hide seed words
  const [requestingSeedPhrase, setRequestingSeedPhrase] = useState(false); // Flag to show seed phrase after PIN auth
  const [isLoading, setIsLoading] = useState(true); // Initial loading state
  const [showBackgroundSplash, setShowBackgroundSplash] = useState(false); // Show splash when app is backgrounded

  // Transaction state - now from TransactionContext
  const {
    sendIntent,
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    sendAddressType,
    broadcastedTxid,
    toastDismissed,
    setSendIntent,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
    setSendAddressType,
    setBroadcastedTxid,
    setToastDismissed,
    createSendIntent,
    signIntent,
  } = useTransaction();

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const seedConfirmedRef = useRef(false); // Track if seed backup is confirmed without triggering re-renders
  const amountInputRef = useRef(null);

  // Toast notification hook
  const { showToast, toastMessage, toastVisible, toastType } = useToast();
  const { startPolling: startTransactionPolling } = useTransactionPolling();
  const { sendTransactionConfirmedNotification } = useNotifications();

  // Auth hook - now from AuthContext
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
  } = useAuth();

  // Animated values for swipe gestures (must be defined before hooks that use them)
  const seedPhraseTranslateX = useRef(new Animated.Value(0)).current;
  const seedPhrasePanResponderRef = useRef(null);
  const settingsTranslateX = useRef(new Animated.Value(0)).current;
  const settingsPanResponderRef = useRef(null);

  // Settings hook - handles settings actions
  const {
    privacyMode,
    notificationsEnabled,
    showZeroAssets,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handlePrivacyModeToggle,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
    showLogoutModal,
    showDeleteModal,
    confirmLogout,
    cancelLogout,
    confirmDeleteWallet,
    cancelDeleteWallet,
  } = useSettings({
    biometricEnabled,
    setBiometricEnabled,
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
    showToast,
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
    saveWalletAfterPinSetup,
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

  // Note: Background fetch removed - iOS limitations make it unreliable
  // Foreground polling will continue even when app is backgrounded for a short time

  // Track transaction toast visibility and auto-hide on confirmed
  useEffect(() => {
    if (intentStep === 'confirmed') {
      // Reset toast dismissed state when confirmed (so it shows again)
      setToastDismissed(false);

      // Clear transaction fields so they don't persist
      setSendRecipient('');
      setSendAmount('');
      setSendAssetType(null);

      // Auto-hide toast after 10 seconds when confirmed
      const timer = setTimeout(() => {
        setIntentStep('idle');
        setBroadcastedTxid(null);
        setToastDismissed(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [intentStep]);

  // No need to reset counter when leaving vault tab - counter approach handles retries automatically

  // Show splash screen when app goes to background/inactive (for app switcher preview)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setShowBackgroundSplash(true);
      } else if (nextAppState === 'active') {
        setShowBackgroundSplash(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);


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
      onStartShouldSetPanResponder: () => false,
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
      onStartShouldSetPanResponder: () => false,
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
  // Transaction handlers now provided by TransactionContext

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


  // PIN setup completion callback wrapper
  const handlePinSetupCompleteWrapper = () => {
    handlePinSetupComplete();
  };

  // PIN change completion callback wrapper
  const handlePinChangeCompleteWrapper = () => {
    handlePinChangeComplete();
  };

  // PIN change cancel callback
  const handleCancelPinChange = () => {
    setSettingUpPin(false);
    setChangingPin(false);
    setShowSettings(false);
    // User returns to main wallet page
  };

  // Open vault with wallet credentials
  const handleOpenVault = async (shouldAutoCreate = false) => {
    try {
      // Get mnemonic
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      if (!mnemonic) {
        setActiveTab('vault');
        return;
      }

      // Derive addresses and public keys for current account
      const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);


      // Set credentials for vault WebView
      setVaultCredentials({
        satsAddress: addresses.segwitAddress,
        satsPubkey: addresses.segwitPubkey,
        runesAddress: addresses.taprootAddress,
        runesPubkey: addresses.taprootPubkey,
        vaultAddress: addresses.taprootAddress,
        vaultPubkey: addresses.taprootPubkey,
      });

      // Trigger auto-create if requested by incrementing counter
      if (shouldAutoCreate) {
        setAutoCreateVaultTrigger(prev => prev + 1);
      }

      // Switch to vault tab
      setActiveTab('vault');
    } catch (error) {
      setActiveTab('vault');
    }
  };

  const handleLockScreenAuthenticatedWrapper = async () => {
    handleLockScreenAuthenticated();

    // Check if user was trying to enable Face ID
    const pendingFaceId = await SecureStore.getItemAsync('pendingFaceIdEnable');
    if (pendingFaceId === 'true') {
      await SecureStore.deleteItemAsync('pendingFaceIdEnable');
      setBiometricEnabled(true);
      await SecureStore.setItemAsync('biometricEnabled', 'true');
      showToast('Face ID enabled', 'success');
      setShowSettings(true);
      return;
    }

    // Check if user was trying to enable notifications
    const pendingNotifications = await SecureStore.getItemAsync('pendingNotificationsEnable');
    if (pendingNotifications === 'true') {
      await SecureStore.deleteItemAsync('pendingNotificationsEnable');
      await SecureStore.setItemAsync('notificationsEnabled', 'true');
      showToast('Notifications enabled', 'success');
      setShowSettings(true);
      return;
    }

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
          showToast(ERRORS.SEED_PHRASE_NOT_FOUND, 'error');
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
    return <SplashScreen />;
  }

  // Check if we should show onboarding/auth screens
  // Show onboarding if:
  // - No wallet yet OR
  // - Wallet exists but seed not confirmed (still in creation flow) OR
  // - Setting up PIN OR
  // - Showing PIN entry OR
  // - Locked (not authenticated but wallet exists and seed confirmed)
  const shouldShowOnboarding = !wallet ||
    (wallet && !seedConfirmed) ||
    settingUpPin ||
    showPinEntry ||
    (!isAuthenticated && wallet && seedConfirmed);

  if (shouldShowOnboarding) {
    return (
      <OnboardingPage
        seedConfirmed={seedConfirmed}
        setSeedConfirmed={setSeedConfirmed}
        showToast={showToast}
        fetchBalance={fetchBalance}
        resetWalletAndState={resetWalletAndState}
        handlePinSetupCompleteWrapper={handlePinSetupCompleteWrapper}
        handlePinChangeCompleteWrapper={handlePinChangeCompleteWrapper}
        handleCancelPinChange={handleCancelPinChange}
        handleLockScreenAuthenticatedWrapper={handleLockScreenAuthenticatedWrapper}
        styles={styles}
      />
    );
  }

  // Account Picker Modal (only shown when authenticated and wallet exists)
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

  // At this point, user is authenticated and has a wallet - show the main wallet UI
  const settingsHandlers = {
    privacyMode,
    notificationsEnabled,
    showZeroAssets,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase,
    handleChangePin,
    handlePrivacyModeToggle,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
  };

  return (
    <WalletPage
      styles={styles}
      resetInactivityTimer={resetInactivityTimer}
      handleOpenVault={handleOpenVault}
      vaultCredentials={vaultCredentials}
      autoCreateVaultTrigger={autoCreateVaultTrigger}
      amountInputRef={amountInputRef}
      setShowAccountPicker={setShowAccountPicker}
      settingsHandlers={settingsHandlers}
      biometricEnabled={biometricEnabled}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      keyboardHeight={keyboardHeight}
    />
  );
}
