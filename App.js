// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';

import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Image, RefreshControl, AppState, Keyboard, Platform, Linking } from 'react-native';
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

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Initialize ECC library for bitcoinjs-lib (required for Taproot)
bitcoin.initEccLib(ecc);

export default function App() {
  const [wallet, setWallet] = useState(null); // Only stores public addresses
  const [tempMnemonicWords, setTempMnemonicWords] = useState([]); // Temporary for seed verification flow
  const [showingIntro, setShowingIntro] = useState(false);
  const [showingSeeds, setShowingSeeds] = useState(false);
  const [verifyingSeeds, setVerifyingSeeds] = useState(false);
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [importingWallet, setImportingWallet] = useState(false);
  const [importSeedPhrase, setImportSeedPhrase] = useState(Array(12).fill(''));
  const seedInputRefs = useRef([]);
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationWords, setVerificationWords] = useState({});
  const [requiredIndices, setRequiredIndices] = useState([]);
  const [wordChoices, setWordChoices] = useState({});
  const [currentAccount, setCurrentAccount] = useState(0); // Account index for HD derivation
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [newAccountIndex, setNewAccountIndex] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [showTotalInBTC, setShowTotalInBTC] = useState(true);
  const [showBTCInBTC, setShowBTCInBTC] = useState(true);
  const [showUnitInUnit, setShowUnitInUnit] = useState(true);
  const [btcPrice, setBtcPrice] = useState(null);
  const [loadingBtcPrice, setLoadingBtcPrice] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Biometric auth status
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [settingUpPin, setSettingUpPin] = useState(false); // PIN setup flow
  const [isImportedWallet, setIsImportedWallet] = useState(false); // Track if wallet was imported
  const [pin, setPin] = useState(''); // Current PIN entry
  const [confirmPin, setConfirmPin] = useState(''); // PIN confirmation
  const [showPinEntry, setShowPinEntry] = useState(false); // Show PIN entry screen
  const [pinError, setPinError] = useState(''); // PIN error message
  const [pinStep, setPinStep] = useState('enter'); // 'enter' or 'confirm'
  const [showSettings, setShowSettings] = useState(false); // Settings modal
  const [viewingSeedPhrase, setViewingSeedPhrase] = useState(false); // Viewing seed phrase
  const [seedPhraseWords, setSeedPhraseWords] = useState([]); // Seed phrase from keychain
  const [changingPin, setChangingPin] = useState(false); // Changing PIN flow
  const [seedPhraseVisible, setSeedPhraseVisible] = useState(false); // Show/hide seed words
  const [privacyMode, setPrivacyMode] = useState(true); // Privacy mode (screenshot blocking)
  const [isLoading, setIsLoading] = useState(true); // Initial loading state
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false); // Show biometric setup prompt
  const [showFaceIdButton, setShowFaceIdButton] = useState(true); // Show FaceID button on lock screen
  const [biometricEnabled, setBiometricEnabled] = useState(false); // Track if user has enabled biometric auth

  // Transaction intent state
  const [sendIntent, setSendIntent] = useState(null); // Current send transaction intent
  const [intentStep, setIntentStep] = useState('idle'); // 'idle' | 'selecting_asset' | 'entering_amount' | 'entering_address' | 'creating' | 'reviewing' | 'signing' | 'broadcasting' | 'confirmed'
  const [sendAssetType, setSendAssetType] = useState(null); // 'btc' | 'unit'
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState('taproot'); // 'segwit' | 'taproot'
  const [broadcastedTxid, setBroadcastedTxid] = useState(null); // TXID of broadcasted transaction
  const [utxos, setUtxos] = useState([]); // Available UTXOs for spending
  const [loadingUtxos, setLoadingUtxos] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const appState = useRef(AppState.currentState);
  const inactivityTimer = useRef(null);
  const walletExists = useRef(false); // Track if wallet exists without triggering re-renders
  const seedConfirmedRef = useRef(false); // Track if seed backup is confirmed without triggering re-renders
  const amountInputRef = useRef(null);
  const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

  // Keep seedConfirmedRef in sync with seedConfirmed state
  useEffect(() => {
    seedConfirmedRef.current = seedConfirmed;
  }, [seedConfirmed]);

  // Debug: Track intentStep changes
  useEffect(() => {
    console.log('intentStep changed to:', intentStep, 'sendIntent:', sendIntent?.id, 'wallet:', !!wallet, 'seedConfirmed:', seedConfirmed);
  }, [intentStep, sendIntent]);

  const fetchBtcPrice = async () => {
    try {
      setLoadingBtcPrice(true);
      const price = await fetchBtcPriceService();
      setBtcPrice(price);
    } catch (error) {
      console.error('Failed to fetch BTC price:', error);
      setBtcPrice(null);
    } finally {
      setLoadingBtcPrice(false);
    }
  };

  useEffect(() => {
    // Fetch BTC price on mount
    fetchBtcPrice();

    // Refresh BTC price every 60 seconds
    const interval = setInterval(fetchBtcPrice, 60000);

    return () => clearInterval(interval);
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
    const loadWallet = async () => {
      try {
        // Load wallet and biometric preference from storage
        const { mnemonic, accountIndex } = await WalletService.loadWalletFromStorage();
        const biometricPref = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
        setBiometricEnabled(biometricPref === 'true');

        if (mnemonic) {
          // Wallet exists in secure storage, load it
          const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

          setWallet({
            segwitAddress: addresses.segwitAddress,
            taprootAddress: addresses.taprootAddress,
          });
          setCurrentAccount(accountIndex);
          setSeedConfirmed(true);
          walletExists.current = true;

          // Wallet loaded - will show locked screen until user authenticates
          setIsAuthenticated(false);

          // Fetch balances (will load in background while locked)
          fetchBalance(addresses.segwitAddress, addresses.taprootAddress);
        } else {
          // No wallet exists, allow access to create/import screen
          walletExists.current = false;
          setIsAuthenticated(true);
        }
      } catch (error) {
      } finally {
        // Hide loading screen after a brief delay to show the logo
        setTimeout(() => setIsLoading(false), 1500);
      }
    };

    loadWallet();
  }, []);

  // Load privacy mode setting on mount
  useEffect(() => {
    const loadPrivacyMode = async () => {
      try {
        const savedPrivacyMode = await SecureStore.getItemAsync('privacyMode');
        if (savedPrivacyMode !== null) {
          setPrivacyMode(savedPrivacyMode === 'true');
        }
      } catch (error) {
        console.error('Failed to load privacy mode:', error);
      }
    };
    loadPrivacyMode();
  }, []);

  // Prevent screenshots and screen recording based on privacy mode
  useEffect(() => {
    const manageScreenCapture = async () => {
      try {
        if (privacyMode) {
          await ScreenCapture.preventScreenCaptureAsync();
        } else {
          await ScreenCapture.allowScreenCaptureAsync();
        }
      } catch (error) {
        console.error('Screen capture error:', error);
      }
    };

    manageScreenCapture();

    // Cleanup: allow screen capture when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((error) => {
      });
    };
  }, [privacyMode]);

  // Check biometric support on app start
  useEffect(() => {
    const checkBiometricSupport = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    };

    checkBiometricSupport();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {

      // ONLY lock when coming back from background, NOT from inactive
      // (inactive happens during Face ID, control center, etc.)
      if (
        appState.current === 'background' &&
        nextAppState === 'active'
      ) {
        // App has come to foreground from background, require re-authentication if wallet exists AND seed backup is confirmed
        if (walletExists.current && seedConfirmedRef.current && isBiometricSupported) {
          setIsAuthenticated(false);
          // Only auto-trigger biometrics if user has enabled it
          if (biometricEnabled) {
            authenticateUser();
          }
        } else {
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isBiometricSupported, biometricEnabled]); // Depend on biometric support and enabled state

  // Cleanup inactivity timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // Inactivity timer - locks wallet after 2 minutes of no interaction
  const startInactivityTimer = useCallback(() => {
    // Clear any existing timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set new timer
    inactivityTimer.current = setTimeout(() => {
      // Lock the wallet after inactivity timeout
      setIsAuthenticated(false);
    }, INACTIVITY_TIMEOUT);
  }, [INACTIVITY_TIMEOUT]);

  const resetInactivityTimer = useCallback(() => {
    // Restart timer when user interacts
    startInactivityTimer();
  }, [startInactivityTimer]);

  // Start timer when authenticated (but only if seed backup is confirmed)
  useEffect(() => {
    if (isAuthenticated && walletExists.current && seedConfirmedRef.current && isBiometricSupported) {
      startInactivityTimer();

      return () => {
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      };
    }
  }, [isAuthenticated, isBiometricSupported, startInactivityTimer]);

  const authenticateUser = async () => {
    try {
      console.log('FaceID button clicked');

      // Check if user has already enabled biometric auth
      if (biometricEnabled) {
        // User has previously enabled biometrics, trigger it directly
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access your wallet',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsAuthenticated(true);
        }
      } else {
        // User hasn't enabled biometrics yet, show modal to ask
        console.log('Showing biometric prompt modal');
        setShowBiometricPrompt(true);
      }
    } catch (error) {
      console.log('Error in authenticateUser:', error);
      setShowBiometricPrompt(true);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'This will lock your wallet. You can unlock it again with Face ID or PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            setIsAuthenticated(false);
            setShowSettings(false);
          }
        }
      ]
    );
  };

  const handleDeleteWallet = async () => {
    Alert.alert(
      'Delete Wallet',
      'WARNING: This will permanently delete your wallet from this device. Make sure you have your recovery phrase backed up!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await AuthService.deleteWalletData();
              if (success) {
                setWallet(null);
                walletExists.current = false;
                setIsAuthenticated(false);
                setShowSettings(false);
                setSegwitBalance(null);
                setTaprootBalance(null);
                setRunesBalance([]);
                setBiometricEnabled(false); // Reset biometric preference
                setShowFaceIdButton(true); // Reset FaceID button visibility

                Alert.alert('Success', 'Wallet has been deleted from this device.');
              } else {
                Alert.alert('Error', 'Failed to delete wallet.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete wallet: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const handleViewSeedPhrase = async () => {
    try {
      const result = await AuthService.authenticateWithBiometrics(
        'Authenticate to view your recovery phrase',
        'Use PIN'
      );

      if (result.success) {
        const mnemonic = await AuthService.getMnemonic();
        if (mnemonic) {
          setSeedPhraseWords(mnemonic.split(' '));
          setSeedPhraseVisible(false); // Start with words hidden for security
          setViewingSeedPhrase(true);
          setShowSettings(false);
        } else {
          Alert.alert('Error', 'Recovery phrase not found.');
        }
      } else {
        Alert.alert('Authentication Failed', 'You must authenticate to view your recovery phrase.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retrieve recovery phrase: ' + error.message);
    }
  };

  const handleChangePin = async () => {
    try {
      const result = await AuthService.authenticateWithBiometrics(
        'Authenticate to change your PIN',
        'Use current PIN'
      );

      if (result.success) {
        setShowSettings(false);
        setChangingPin(true);
        setSettingUpPin(true);
        setPinStep('enter');
        setPin('');
        setConfirmPin('');
        setPinError('');
      } else {
        Alert.alert('Authentication Failed', 'You must authenticate to change your PIN.');
      }
    } catch (error) {
      Alert.alert('Error', 'Authentication failed: ' + error.message);
    }
  };

  const fetchBalance = async (segwitAddr, taprootAddr) => {
    // If addresses are provided, use them; otherwise use wallet state
    const segwitAddress = segwitAddr || wallet?.segwitAddress;
    const taprootAddress = taprootAddr || wallet?.taprootAddress;

    if (!segwitAddress || !taprootAddress) return;

    try {
      setLoadingBalance(true);
      const balances = await fetchWalletBalances(segwitAddress, taprootAddress);
      setSegwitBalance(balances.segwitBalance);
      setTaprootBalance(balances.taprootBalance);
      setRunesBalance(balances.runesBalance);
    } catch (error) {
      console.error('Balance fetch error:', error);
      setSegwitBalance(0);
      setTaprootBalance(0);
      setRunesBalance([]);
    } finally {
      setLoadingBalance(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  // Fetch UTXOs for transaction creation
  const fetchUtxos = async (address) => {
    try {
      setLoadingUtxos(true);
      const formattedUtxos = await fetchUtxosService(address);
      setUtxos(formattedUtxos);
      return formattedUtxos;
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
      Alert.alert('Error', 'Failed to fetch UTXOs: ' + error.message);
      return [];
    } finally {
      setLoadingUtxos(false);
    }
  };

  // Create an unsigned PSBT for the transaction
  const createSendIntent = async () => {
    try {
      // Trim whitespace from recipient address
      const trimmedRecipient = sendRecipient.trim();
      console.log('createSendIntent called - assetType:', sendAssetType, 'amount:', sendAmount, 'recipient:', trimmedRecipient);
      setIntentStep('creating');

      // Validate inputs
      if (!trimmedRecipient || !sendAmount) {
        console.error('Missing recipient or amount');
        Alert.alert('Error', 'Please enter recipient address and amount');
        setIntentStep('idle');
        return;
      }

      // Update the state with trimmed recipient
      setSendRecipient(trimmedRecipient);

      // Branch based on asset type
      console.log('Branching to asset type:', sendAssetType);
      if (sendAssetType === 'btc') {
        console.log('Calling createBtcIntent...');
        await createBtcIntent();
      } else if (sendAssetType === 'unit') {
        console.log('Calling createUnitIntent...');
        await createUnitIntent();
      } else {
        console.error('Invalid asset type:', sendAssetType);
        Alert.alert('Error', 'Invalid asset type');
        setIntentStep('idle');
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
      Alert.alert('Error', 'Failed to create transaction: ' + error.message);
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

      console.log('Intent created, setting state and moving to review...');
      setSendIntent(intent);
      setIntentStep('reviewing');
      console.log('State updated: intentStep=reviewing, sendIntent=', intent.id);

      // Debug: Check state after a moment
      setTimeout(() => {
        console.log('After state update - intentStep should be reviewing');
      }, 100);
    } catch (error) {
      console.error('Failed to create BTC transaction:', error);
      Alert.alert('Error', 'Failed to create BTC transaction: ' + error.message);
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

      console.log('UNIT intent created:', intent.id);
      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      console.error('Failed to create UNIT transaction:', error);
      Alert.alert('Error', 'Failed to create UNIT transaction: ' + error.message);
      setIntentStep('idle');
      throw error;
    }
  };

  // Sign the PSBT using TransactionService
  const signIntent = async () => {
    try {
      console.log('signIntent called with intent:', sendIntent);
      setIntentStep('signing');

      if (!sendIntent) {
        Alert.alert('Error', 'No intent to sign');
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
      Alert.alert('Error', 'Failed to sign transaction: ' + error.message);
      setIntentStep('reviewing');
    }
  };

  // Broadcast the signed transaction using TransactionService
  const broadcastIntent = async (intent = sendIntent) => {
    try {
      console.log('broadcastIntent called with intent:', intent);
      if (!intent || !intent.signedTxHex) {
        console.error('No signed transaction to broadcast');
        Alert.alert('Error', 'No signed transaction to broadcast');
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
      Alert.alert('Broadcast Error', error.message);
      setIntentStep('reviewing');
    }
  };

  const createWallet = async () => {
    try {
      // Generate wallet using WalletService
      const { mnemonic, addresses } = await WalletService.generateWallet(currentAccount);

      // Store wallet in secure storage
      await WalletService.saveWalletToStorage(mnemonic, currentAccount);

      // Set showingIntro FIRST, before setting wallet, to prevent lock screen flash
      setShowingIntro(true);
      setShowingSeeds(false);
      setVerifyingSeeds(false);
      setSeedConfirmed(false);
      // Wallet created, user authenticated to see seed phrase
      setIsAuthenticated(true);

      // Store ONLY public addresses in state
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
      });
      walletExists.current = true;

      // Temporarily store mnemonic words for verification flow only
      setTempMnemonicWords(mnemonic.split(' '));

      // Pre-fetch RUNES balance from Taproot address
      try {
        const runesResponse = await fetch(`https://ord-mutinynet.ducatprotocol.com/address/${addresses.taprootAddress}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        const runesData = await runesResponse.json();
        setRunesBalance(runesData.runes_balances || []);
      } catch (error) {
        setRunesBalance([]);
      }

      // State was already set above before wallet creation
      setSegwitBalance(null);
      setTaprootBalance(null);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const importWallet = async () => {
    try {
      // Join the array of words and trim/normalize
      const mnemonic = importSeedPhrase.map(word => word.trim().toLowerCase()).join(' ').trim();

      // Import wallet using WalletService (validates and derives addresses)
      const { addresses } = await WalletService.importWallet(mnemonic, currentAccount);

      // Store wallet in secure storage
      await WalletService.saveWalletToStorage(mnemonic, currentAccount);

      // Set PIN setup state FIRST, before setting wallet, to prevent lock screen flash
      setSettingUpPin(true);
      setIsImportedWallet(true); // Mark as imported wallet
      // Ensure seed creation flow screens are not shown for imported wallets
      setShowingIntro(false);
      setShowingSeeds(false);
      setVerifyingSeeds(false);

      // Store ONLY public addresses in state
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
      });
      walletExists.current = true;

      // Fetch all balances using BalanceService
      await fetchBalance(addresses.segwitAddress, addresses.taprootAddress);

      // Skip seed verification for imported wallets
      // settingUpPin and other setup states were already set above
      // Don't set seedConfirmed here - it will be set after PIN is saved
      setImportingWallet(false);
      setImportSeedPhrase(Array(12).fill(''));
    } catch (error) {
      Alert.alert('Error', 'Failed to import wallet. Please check your seed phrase and try again.');
    }
  };

  const generateChoicesForWord = (correctWord, allWords) => {
    // Get all unique words from BIP39 wordlist
    const choices = [correctWord];
    const otherWords = allWords.filter(w => w !== correctWord);

    // Add 3 random wrong choices
    while (choices.length < 4) {
      const randomWord = otherWords[Math.floor(Math.random() * otherWords.length)];
      if (!choices.includes(randomWord)) {
        choices.push(randomWord);
      }
    }

    // Shuffle choices
    return choices.sort(() => Math.random() - 0.5);
  };

  const proceedToVerification = () => {
    // Select 3 random indices for verification
    const indices = [];
    while (indices.length < 3) {
      const randomIndex = Math.floor(Math.random() * 12);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
      }
    }
    setRequiredIndices(indices.sort((a, b) => a - b));

    // Generate multiple choice options for each word
    const choices = {};
    indices.forEach(index => {
      choices[index] = generateChoicesForWord(tempMnemonicWords[index], tempMnemonicWords);
    });
    setWordChoices(choices);
    setVerificationWords({});
    setShowingSeeds(false);
    setVerifyingSeeds(true);
  };

  const verifySeeds = () => {
    let allCorrect = true;

    // Check if all words have been selected
    if (Object.keys(verificationWords).length !== requiredIndices.length) {
      Alert.alert('Incomplete', 'Please select an answer for all words.');
      return;
    }

    for (const index of requiredIndices) {
      const userWord = verificationWords[index];
      const correctWord = tempMnemonicWords[index];
      if (userWord !== correctWord) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      // Set both states immediately to prevent lock screen flash
      setVerifyingSeeds(false);
      setSettingUpPin(true);
      setPinStep('enter');
      setPin('');
      setConfirmPin('');
      setPinError('');

      // Securely clear temporary mnemonic from memory
      // First overwrite with random data, then clear
      setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
      setTimeout(() => setTempMnemonicWords([]), 100);
    } else {
      Alert.alert('Verification Failed', 'One or more words are incorrect. Please try again.');
      setVerificationWords({});
    }
  };

  const getCurrentAddress = () => {
    // Return taproot address as default for displaying
    if (!wallet) return null;
    return wallet.taprootAddress;
  };

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Address copied to clipboard');
  };

  const resetWallet = async () => {
    // Clear secure storage
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);

    // Securely clear temporary mnemonic from memory
    setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
    setTimeout(() => setTempMnemonicWords([]), 100);

    // Clear state
    setWallet(null);
    walletExists.current = false;
    setShowingSeeds(false);
    setVerifyingSeeds(false);
    setSeedConfirmed(false);
    setSegwitBalance(null);
    setTaprootBalance(null);
    setRunesBalance([]);
    setVerificationWords({});
    setRequiredIndices([]);
    setWordChoices({});
    setCurrentAccount(0);
  };

  const switchAccount = async () => {
    const accountNum = parseInt(newAccountIndex);
    if (isNaN(accountNum) || accountNum < 1) {
      Alert.alert('Invalid Account', 'Please enter a valid account number (1 or greater)');
      return;
    }

    // Convert account number to index (Account 1 = index 0)
    const accountIndex = accountNum - 1;

    try {
      setSwitchingAccount(true);

      // Switch to new account using WalletService
      const { addresses } = await WalletService.switchToAccount(accountIndex);

      // Update wallet with only public addresses
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
      });

      // Update current account in state
      setCurrentAccount(accountIndex);

      setShowAccountPicker(false);
      setNewAccountIndex('');

      // Fetch all balances using the new addresses directly
      await fetchBalance(addresses.segwitAddress, addresses.taprootAddress);
    } catch (error) {
      Alert.alert('Error', 'Failed to switch account');
    } finally {
      setSwitchingAccount(false);
    }
  };

  // PIN setup completion callbacks
  const handlePinSetupComplete = () => {
    // Initial wallet creation or import - authenticate to prevent lock screen flash
    setIsAuthenticated(true);
    setSeedConfirmed(true);
    setSettingUpPin(false);
    setIsImportedWallet(false);
  };

  const handlePinChangeComplete = () => {
    // Just changing PIN, not creating wallet
    setSettingUpPin(false);
    setChangingPin(false);
    setIsImportedWallet(false);
  };

  // Lock screen authentication callback
  const handleLockScreenAuthenticated = () => {
    setIsAuthenticated(true);
    setShowPinEntry(false);
    // Restore FaceID button for next time
    setShowFaceIdButton(true);
  };

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
        <StatusBar style="dark" />
      </View>
    );
  }

  // Show PIN entry screen
  // PIN Setup Screen (Step 4 of onboarding)
  if (settingUpPin) {
    return (
      <PinSetupScreen
        changingPin={changingPin}
        isBiometricSupported={isBiometricSupported}
        onPinSetupComplete={handlePinSetupComplete}
        onPinChangeComplete={handlePinChangeComplete}
        fetchBalance={fetchBalance}
      />
    );
  }

  // Lock Screen (PIN entry for authentication)
  if (showPinEntry) {
    return <LockScreen onAuthenticated={handleLockScreenAuthenticated} />;
  }

  // Show locked screen if not authenticated and wallet exists AND seed backup confirmed AND not in setup flow
  if (!isAuthenticated && wallet && seedConfirmed && !showingIntro && !showingSeeds && !verifyingSeeds && !settingUpPin) {
    return (
      <>
        <LockScreen
          onAuthenticated={handleLockScreenAuthenticated}
          showFaceIdButton={showFaceIdButton && !showBiometricPrompt}
          onFaceIdPress={authenticateUser}
        />

        {/* Biometric Authentication Prompt - Rendered at top level */}
        {showBiometricPrompt && (
          <View style={styles.modalOverlay}>
            <View style={styles.biometricPromptModal}>
              <Text style={styles.biometricPromptTitle}>Biometric Authentication</Text>
              <Text style={styles.biometricPromptText}>
                Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?
              </Text>
              <View style={styles.biometricPromptButtons}>
                <TouchableOpacity
                  style={[styles.biometricPromptButton, styles.biometricPromptButtonYes]}
                  onPress={async () => {
                    setShowBiometricPrompt(false);
                    try {
                      // Save the preference
                      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
                      setBiometricEnabled(true);

                      // Trigger biometric authentication
                      const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'Authenticate to enable biometric login',
                        fallbackLabel: 'Use PIN instead',
                      });
                      if (result.success) {
                        setIsAuthenticated(true);
                      }
                    } catch (error) {
                      console.log('Biometric auth error:', error);
                    }
                  }}
                >
                  <Text style={styles.biometricPromptButtonText}>Yes, Enable</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.biometricPromptButton, styles.biometricPromptButtonNo]}
                  onPress={async () => {
                    setShowBiometricPrompt(false);
                    // Save the preference as disabled
                    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
                    setBiometricEnabled(false);
                    // Keep FaceID button visible so user can enable it later
                    // On lock screen: Don't authenticate, user must enter PIN
                  }}
                >
                  <Text style={styles.biometricPromptButtonTextNo}>No, Thanks</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </>
    );
  }

  // Full-screen seed phrase viewing
  if (viewingSeedPhrase) {
    return (
      <ScrollView style={{ backgroundColor: COLORS.VERY_LIGHT_GRAY }} contentContainerStyle={styles.container}>
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

        <StatusBar style="dark" />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: COLORS.VERY_LIGHT_GRAY }}
        contentContainerStyle={styles.container}
        refreshControl={
          wallet && seedConfirmed ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        onTouchStart={resetInactivityTimer}
        onScroll={resetInactivityTimer}
        scrollEventThrottle={400}
      >
      <View style={styles.titleRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.subtitle}>Mutinynet Edition</Text>
        </View>
      </View>

      {/* Settings Button - Absolute Top Right */}
      {wallet && seedConfirmed && (
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      )}

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
          resetWallet={resetWallet}
          proceedToVerification={proceedToVerification}
          verifySeeds={verifySeeds}
        />
      ) : (
        <View style={styles.walletContainer}>
          {/* Price Chips - Outside main dialog */}
          <View style={styles.priceChipsContainer}>
            {/* Bitcoin Price Chip */}
            <View style={[styles.priceChip, styles.priceChipBTC]}>
              <Image
                source={require('./assets/btc-logo.png')}
                style={styles.priceChipIcon}
                resizeMode="contain"
              />
              <Text style={styles.priceChipName}>Bitcoin BTC</Text>
              {loadingBtcPrice ? (
                <ActivityIndicator size="small" color={COLORS.VERY_LIGHT_GRAY} />
              ) : (
                <Text style={styles.priceChipValue}>
                  $ {btcPrice ? btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </Text>
              )}
            </View>

            {/* Unit Price Chip */}
            <View style={[styles.priceChip, styles.priceChipUnit]}>
              <Image
                source={require('./assets/unit-logo.png')}
                style={styles.priceChipIcon}
                resizeMode="contain"
              />
              <Text style={styles.priceChipName}>Unit</Text>
              <Text style={styles.priceChipValue}>$ 1.00</Text>
            </View>
          </View>

          <View style={styles.walletInfo}>
            {/* Loading overlay while switching accounts */}
            {switchingAccount && (
              <View style={styles.switchingOverlay}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
                <Text style={styles.switchingText}>Switching account...</Text>
              </View>
            )}

            {/* Header with Account Number and Plus Button */}
            <View style={styles.headerRow}>
              <Text style={styles.walletTitle}>Account {currentAccount + 1}</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.addAccountButton}
                  onPress={() => setShowAccountPicker(true)}
                >
                  <Text style={styles.addAccountText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Account Picker Modal */}
          {showAccountPicker && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Switch Address</Text>
                <Text style={styles.modalLabel}>Enter account number:</Text>
                <TextInput
                  style={styles.accountInput}
                  value={newAccountIndex}
                  onChangeText={setNewAccountIndex}
                  placeholder="1"
                  placeholderTextColor="#666666"
                  keyboardType="number-pad"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setShowAccountPicker(false);
                      setNewAccountIndex('');
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={switchAccount}
                  >
                    <Text style={styles.modalButtonText}>Switch</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Settings Modal */}
          {showSettings && (
            <View style={styles.modalOverlay}>
              <View style={styles.settingsModal}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>Settings</Text>
                  <TouchableOpacity onPress={() => setShowSettings(false)}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.settingsOption}
                  onPress={handleViewSeedPhrase}
                >
                  <Text style={styles.settingsOptionIcon}>🔑</Text>
                  <Text style={styles.settingsOptionText}>View Recovery Phrase</Text>
                  <Text style={styles.settingsOptionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsOption}
                  onPress={handleChangePin}
                >
                  <Text style={styles.settingsOptionIcon}>🔢</Text>
                  <Text style={styles.settingsOptionText}>Change PIN</Text>
                  <Text style={styles.settingsOptionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsOption}
                  onPress={handleLogout}
                >
                  <Text style={styles.settingsOptionText}>Lock Wallet</Text>
                  <Text style={styles.settingsOptionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsOption}
                  onPress={async () => {
                    const newPrivacyMode = !privacyMode;
                    setPrivacyMode(newPrivacyMode);
                    try {
                      await SecureStore.setItemAsync('privacyMode', String(newPrivacyMode));
                    } catch (error) {
                      console.error('Failed to save privacy mode:', error);
                    }
                  }}
                >
                  <Text style={styles.settingsOptionIcon}>👁️</Text>
                  <Text style={styles.settingsOptionText}>Privacy Mode</Text>
                  <Text style={[styles.settingsToggle, privacyMode && styles.settingsToggleOn]}>
                    {privacyMode ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.settingsDivider} />

                <TouchableOpacity
                  style={[styles.settingsOption, styles.dangerOption]}
                  onPress={handleDeleteWallet}
                >
                  <Text style={styles.settingsOptionIcon}>⚠️</Text>
                  <Text style={[styles.settingsOptionText, styles.dangerText]}>Delete Wallet</Text>
                  <Text style={styles.settingsOptionArrow}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}


          {/* Total Balance - Aggregate of both addresses */}
          <TouchableOpacity
            style={styles.totalBalanceSection}
            onPress={() => setShowTotalInBTC(!showTotalInBTC)}
          >
            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
            <View style={styles.balanceContainer}>
              {showTotalInBTC ? (
                <View style={styles.balanceWithIcon}>
                  <Image source={require('./assets/btc-symbol.png')} style={styles.balanceIcon} resizeMode="contain" />
                  <Text style={[
                    styles.totalBalanceAmount,
                    ((segwitBalance || 0) + (taprootBalance || 0)) >= 1000 && styles.totalBalanceAmountSmall
                  ]}>
                    {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.totalBalanceAmount,
                  ((segwitBalance || 0) + (taprootBalance || 0)) >= 1000 && styles.totalBalanceAmountSmall
                ]}>
                  $ {(((segwitBalance || 0) + (taprootBalance || 0)) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Assets Container - Fixed height to prevent jumping */}
          <View style={styles.assetsContainer}>
            {/* Bitcoin Balance Card - Shows aggregate */}
            <TouchableOpacity
              style={styles.assetCard}
              onPress={() => setShowBTCInBTC(!showBTCInBTC)}
            >
              <View style={styles.assetRow}>
                <View style={styles.assetLeft}>
                  <View style={styles.btcIcon}>
                    <Image
                      source={require('./assets/btc-logo.png')}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.assetName}>Bitcoin</Text>
                </View>
                {showBTCInBTC ? (
                  <View style={styles.assetValueWithIcon}>
                    <Image source={require('./assets/btc-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
                    <Text style={styles.assetValue}>
                      {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.assetValue}>
                    $ {(((segwitBalance || 0) + (taprootBalance || 0)) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* DUCAT UNIT Card - Always reserve space */}
            {runesBalance.length > 0 ? (
              runesBalance.map((rune, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.assetCard}
                  onPress={() => setShowUnitInUnit(!showUnitInUnit)}
                >
                  <View style={styles.assetRow}>
                    <View style={styles.assetLeft}>
                      <View style={[styles.btcIcon, styles.ducatIcon]}>
                        <Image
                          source={require('./assets/unit-logo.png')}
                          style={styles.logoImage}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.assetName}>Unit</Text>
                    </View>
                    {showUnitInUnit ? (
                      <View style={styles.assetValueWithIcon}>
                        <Image source={require('./assets/unit-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
                        <Text style={styles.assetValue}>
                          {parseFloat(rune[1]).toLocaleString()}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.assetValue}>
                        $ {(parseFloat(rune[1]) * 1.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.assetCard, styles.assetCardPlaceholder]} />
            )}
          </View>

          {/* Actions - Send and Receive buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.sendButton]}
              onPress={() => setIntentStep('selecting_asset')}
            >
              <Text style={styles.actionButtonText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.receiveButton]}
              onPress={() => Alert.alert('Receive', `Your ${sendAddressType === 'taproot' ? 'Taproot' : 'SegWit'} Address:\n\n${sendAddressType === 'taproot' ? wallet.taprootAddress : wallet.segwitAddress}`)}
            >
              <Text style={styles.actionButtonText}>Receive</Text>
            </TouchableOpacity>
          </View>

          {/* Asset Selector Bottom Sheet - Outside modal */}
        </View>
        </View>
      )}

      {/* Asset Selector Bottom Sheet - Slides from absolute bottom */}
      {intentStep === 'selecting_asset' && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => setIntentStep('idle')}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Send What?</Text>

            <TouchableOpacity
              style={styles.assetOption}
              onPress={() => {
                console.log('BTC asset selected');
                setSendAssetType('btc');
                setIntentStep('entering_amount');
              }}
            >
              <Image
                source={require('./assets/btc-logo.png')}
                style={styles.assetOptionLogo}
              />
              <View style={styles.assetOptionInfo}>
                <Text style={styles.assetOptionTitle}>Bitcoin</Text>
                <Text style={styles.assetOptionSubtitle}>Send BTC</Text>
              </View>
              <Text style={styles.assetOptionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.assetOption}
              onPress={() => {
                console.log('UNIT asset selected');
                setSendAssetType('unit');
                setIntentStep('entering_amount');
              }}
            >
              <Image
                source={require('./assets/unit-logo.png')}
                style={styles.assetOptionLogo}
              />
              <View style={styles.assetOptionInfo}>
                <Text style={styles.assetOptionTitle}>Unit</Text>
                <Text style={styles.assetOptionSubtitle}>Send DUCAT•UNIT•RUNE</Text>
              </View>
              <Text style={styles.assetOptionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Amount Input Bottom Sheet - After asset selection */}
      {intentStep === 'entering_amount' && sendAssetType && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendAssetType(null);
              setSendAmount('');
            }}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { bottom: keyboardHeight }]}>
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('selecting_asset');
                setSendAmount('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <View style={styles.amountInputRow}>
                <Image
                  source={sendAssetType === 'btc'
                    ? require('./assets/btc-symbol.png')
                    : require('./assets/unit-symbol.png')}
                  style={styles.amountAssetSymbol}
                />
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountInput}
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus={true}
                  onSubmitEditing={() => {
                    if (sendAmount) {
                      amountInputRef.current?.blur();
                      setTimeout(() => setIntentStep('entering_address'), 50);
                    }
                  }}
                />
              </View>
              <Text style={styles.amountInputLabel}>
                {sendAssetType === 'btc' ? 'BTC' : 'UNIT'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.amountContinueButton,
                  !sendAmount && styles.amountContinueButtonDisabled
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (sendAmount) {
                    amountInputRef.current?.blur();
                    setIntentStep('entering_address');
                  }
                }}
                disabled={!sendAmount}
              >
                <Text style={styles.amountContinueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Address Input Bottom Sheet - After amount entry */}
      {intentStep === 'entering_address' && sendAssetType && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendAssetType(null);
              setSendAmount('');
              setSendRecipient('');
            }}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { bottom: keyboardHeight }]}>
            <View style={styles.bottomSheetHandle} />

            {/* Back button */}
            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('entering_amount');
                setSendRecipient('');
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={styles.addressInputTitle}>Recipient Address</Text>

              <TextInput
                style={styles.addressInput}
                value={sendRecipient}
                onChangeText={setSendRecipient}
                placeholder="tb1q... or tb1p..."
                placeholderTextColor="#666666"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (sendRecipient) {
                    createSendIntent();
                  }
                }}
              />

              <TouchableOpacity
                style={[
                  styles.amountContinueButton,
                  !sendRecipient && styles.amountContinueButtonDisabled
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (sendRecipient) {
                    createSendIntent();
                  }
                }}
                disabled={!sendRecipient}
              >
                <Text style={styles.amountContinueButtonText}>Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Review Transaction Bottom Sheet */}
      {intentStep === 'reviewing' && sendIntent && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setIntentStep('idle');
              setSendIntent(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <TouchableOpacity
              style={styles.bottomSheetBackButton}
              onPress={() => {
                setIntentStep('entering_address');
                setSendIntent(null);
              }}
            >
              <Text style={styles.bottomSheetBackArrow}>‹</Text>
              <Text style={styles.bottomSheetBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={styles.reviewTitle}>Review Transaction</Text>

              <Text style={styles.reviewLabel}>From</Text>
              <Text style={styles.reviewValue}>{sendIntent.addressType === 'taproot' ? 'Taproot' : 'SegWit'}</Text>

              <Text style={styles.reviewLabel}>To</Text>
              <Text style={styles.reviewValue}>{sendIntent.recipient.substring(0, 16)}...{sendIntent.recipient.substring(sendIntent.recipient.length - 8)}</Text>

              <Text style={styles.reviewLabel}>Amount</Text>
              {sendIntent.assetType === 'UNIT' ? (
                <>
                  <Text style={styles.reviewAmountLarge}>{sendIntent.amount.toLocaleString()} UNIT</Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewAmountLarge}>{sendIntent.amountBTC} BTC</Text>
                  <Text style={styles.reviewAmountSats}>{sendIntent.amount.toLocaleString()} sats</Text>
                </>
              )}

              <Text style={styles.reviewLabel}>Fee</Text>
              <Text style={styles.reviewValue}>{sendIntent.fee} sats</Text>

              {sendIntent.assetType !== 'UNIT' && (
                <>
                  <Text style={styles.reviewLabel}>Total</Text>
                  <Text style={styles.reviewTotal}>
                    {((sendIntent.amount + sendIntent.fee) / 100000000).toFixed(8)} BTC
                  </Text>
                </>
              )}

              <TouchableOpacity
                style={styles.amountContinueButton}
                activeOpacity={0.7}
                onPress={() => {
                  console.log('Confirm & Sign button pressed!');
                  signIntent();
                }}
              >
                <Text style={styles.amountContinueButtonText}>Confirm & Sign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Transaction Success Bottom Sheet */}
      {intentStep === 'confirmed' && broadcastedTxid && (
        <>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            onPress={() => {
              setSendIntent(null);
              setIntentStep('idle');
              setSendAmount('');
              setSendRecipient('');
              setSendAssetType(null);
              setBroadcastedTxid(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            <TouchableOpacity
              style={styles.successCloseButton}
              onPress={() => {
                setSendIntent(null);
                setIntentStep('idle');
                setSendAmount('');
                setSendRecipient('');
                setSendAssetType(null);
                setBroadcastedTxid(null);
              }}
            >
              <Text style={styles.successCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <View style={styles.successCheckmarkContainer}>
                <View style={styles.successCheckmark}>
                  <Text style={styles.successCheckmarkText}>✓</Text>
                </View>
              </View>

              <Text style={styles.successTitle}>Transaction Sent</Text>

              <TouchableOpacity
                style={styles.amountContinueButton}
                activeOpacity={0.7}
                onPress={() => {
                  Linking.openURL(`https://mutinynet.com/tx/${broadcastedTxid}`);
                }}
              >
                <Text style={styles.amountContinueButtonText}>View on Explorer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {wallet && seedConfirmed && (
        <View>
        <View>

          {/* Send Intent Modal */}
          {intentStep === 'creating' && sendAssetType && (
            <View style={styles.modalOverlay}>
              <View style={styles.intentModal}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>
                    {sendAssetType === 'btc' ? 'Send Bitcoin' : 'Send Unit'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setIntentStep('idle');
                    setSendAmount('');
                    setSendRecipient('');
                  }}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.intentContent}>
                  <Text style={styles.modalLabel}>Recipient Address:</Text>
                  <TextInput
                    style={styles.intentInput}
                    value={sendRecipient}
                    onChangeText={setSendRecipient}
                    placeholder="tb1q... or tb1p..."
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={styles.modalLabel}>
                    Amount ({sendAssetType === 'btc' ? 'BTC' : 'UNIT'}):
                  </Text>
                  <TextInput
                    style={styles.intentInput}
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    placeholder="0.00000000"
                    placeholderTextColor="#666666"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>Send From:</Text>
                  <View style={styles.addressTypeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.addressTypeButton,
                        sendAddressType === 'segwit' && styles.addressTypeButtonSelected
                      ]}
                      onPress={() => setSendAddressType('segwit')}
                    >
                      <Text style={[
                        styles.addressTypeText,
                        sendAddressType === 'segwit' && styles.addressTypeTextSelected
                      ]}>
                        SegWit
                      </Text>
                      <Text style={styles.addressTypeSubtext}>Native Segwit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.addressTypeButton,
                        sendAddressType === 'taproot' && styles.addressTypeButtonSelected
                      ]}
                      onPress={() => setSendAddressType('taproot')}
                    >
                      <Text style={[
                        styles.addressTypeText,
                        sendAddressType === 'taproot' && styles.addressTypeTextSelected
                      ]}>
                        Taproot
                      </Text>
                      <Text style={styles.addressTypeSubtext}>Latest standard</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={createSendIntent}
                  >
                    <Text style={styles.buttonText}>Review Transaction</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Broadcasting/Signing Overlay */}
          {(intentStep === 'signing' || intentStep === 'broadcasting') && (
            <View style={styles.modalOverlay}>
              <View style={styles.intentModal}>
                <View style={styles.intentContent}>
                  <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
                  <Text style={styles.reviewValue}>
                    {intentStep === 'signing' ? 'Signing transaction...' : 'Broadcasting transaction...'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
        </View>
      )}

      <StatusBar style="dark" />
    </ScrollView>

    {/* Biometric Authentication Prompt - Rendered at top level */}
    {showBiometricPrompt && (
      <View style={styles.modalOverlay}>
        <View style={styles.biometricPromptModal}>
          <Text style={styles.biometricPromptTitle}>Biometric Authentication</Text>
          <Text style={styles.biometricPromptText}>
            Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?
          </Text>
          <View style={styles.biometricPromptButtons}>
            <TouchableOpacity
              style={[styles.biometricPromptButton, styles.biometricPromptButtonYes]}
              onPress={async () => {
                setShowBiometricPrompt(false);
                try {
                  // Save the preference
                  await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
                  setBiometricEnabled(true);

                  // Trigger biometric authentication
                  const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Authenticate to enable biometric login',
                    fallbackLabel: 'Use PIN instead',
                  });
                  if (result.success) {
                    setIsAuthenticated(true);
                  }
                } catch (error) {
                  console.log('Biometric auth error:', error);
                }
              }}
            >
              <Text style={styles.biometricPromptButtonText}>Yes, Enable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.biometricPromptButton, styles.biometricPromptButtonNo]}
              onPress={async () => {
                setShowBiometricPrompt(false);
                // Save the preference as disabled
                await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
                setBiometricEnabled(false);
                // If not authenticated yet, show PIN entry
                if (!isAuthenticated) {
                  setShowPinEntry(true);
                }
              }}
            >
              <Text style={styles.biometricPromptButtonTextNo}>No, Thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
    </>
  );
}
