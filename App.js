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


  const handlePinDigit = (digit) => {
    if (settingUpPin) {
      // PIN setup flow
      if (pinStep === 'enter') {
        if (pin.length < 6) {
          const newPin = pin + digit;
          setPin(newPin);
          if (newPin.length === 6) {
            // Move to confirmation step
            setPinStep('confirm');
            setPinError('');
          }
        }
      } else {
        // Confirmation step
        if (confirmPin.length < 6) {
          const newConfirmPin = confirmPin + digit;
          setConfirmPin(newConfirmPin);
          if (newConfirmPin.length === 6) {
            // Check if PINs match
            if (newConfirmPin === pin) {
              // Save PIN and finish setup
              AuthService.savePin(pin).then(success => {
                if (success) {
                  if (changingPin) {
                    // Just changing PIN, not creating wallet
                    setSettingUpPin(false);
                    setChangingPin(false);
                    setIsImportedWallet(false);
                    setPin('');
                    setConfirmPin('');
                    setPinStep('enter');
                    Alert.alert('Success', 'Your PIN has been changed.');
                  } else {
                    // Initial wallet creation or import - authenticate first to prevent lock screen flash
                    setIsAuthenticated(true); // Unlock the wallet immediately BEFORE clearing settingUpPin
                    setSeedConfirmed(true);
                    setSettingUpPin(false);
                    setIsImportedWallet(false); // Reset imported wallet flag
                    setPin('');
                    setConfirmPin('');
                    setPinStep('enter');
                    fetchBalance();
                    if (isBiometricSupported) {
                      setShowBiometricPrompt(true);
                    }
                  }
                } else {
                  setPinError('Failed to save PIN');
                  setConfirmPin('');
                }
              });
            } else {
              setPinError('PINs do not match');
              setConfirmPin('');
            }
          }
        }
      }
    } else {
      // PIN entry for authentication
      if (pin.length < 6) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 6) {
          // Verify PIN
          AuthService.verifyPin(newPin).then(isValid => {
            if (isValid) {
              setIsAuthenticated(true);
              setShowPinEntry(false);
              setPin('');
              setPinError('');
              // Restore FaceID button for next time
              setShowFaceIdButton(true);
            } else {
              setPinError('Incorrect PIN');
              setPin('');
            }
          });
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (settingUpPin) {
      if (pinStep === 'enter') {
        setPin(pin.slice(0, -1));
      } else {
        setConfirmPin(confirmPin.slice(0, -1));
      }
    } else {
      setPin(pin.slice(0, -1));
    }
    setPinError('');
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

  // Create BTC transaction using ord-mutinynet API
  const createBtcIntent = async () => {
    try {
      console.log('createBtcIntent started');
      // Replace comma with period for locales that use comma as decimal separator
      const normalizedAmount = sendAmount.replace(',', '.');
      const amountInSats = Math.floor(parseFloat(normalizedAmount) * 100000000);
      console.log('Amount in sats:', amountInSats);
      if (isNaN(amountInSats) || amountInSats <= 0) {
        console.error('Invalid amount:', amountInSats);
        Alert.alert('Error', 'Invalid amount');
        setIntentStep('idle');
        return;
      }

      // BTC always sends from segwit address
      const sourceAddress = wallet.segwitAddress;
      const addressType = 'segwit';
      console.log('Source address (segwit):', sourceAddress);

      // Fetch UTXOs for the source address
      console.log('Fetching UTXOs for:', sourceAddress);
      const availableUtxos = await fetchUtxos(sourceAddress);
      console.log('Found', availableUtxos.length, 'UTXOs');
      if (availableUtxos.length === 0) {
        Alert.alert('Error', 'No UTXOs available to spend');
        setIntentStep('idle');
        return;
      }

      // Simple UTXO selection - use first UTXO that covers amount + fee
      const feeRate = 1; // sats per vbyte (very low for testnet)
      const estimatedSize = 200; // rough estimate
      const estimatedFee = feeRate * estimatedSize;
      const requiredAmount = amountInSats + estimatedFee;
      console.log('Required amount:', requiredAmount, 'sats (amount:', amountInSats, '+ fee:', estimatedFee, ')');

      let selectedUtxos = [];
      let totalInput = 0;

      for (const utxo of availableUtxos) {
        console.log('Checking UTXO:', utxo.txid, 'confirmed:', utxo.status.confirmed, 'value:', utxo.value);
        if (utxo.status.confirmed) {
          selectedUtxos.push(utxo);
          totalInput += utxo.value;
          if (totalInput >= requiredAmount) break;
        }
      }

      console.log('Selected', selectedUtxos.length, 'UTXOs with total:', totalInput, 'sats');

      if (totalInput < requiredAmount) {
        console.error('Insufficient funds');
        Alert.alert('Error', `Insufficient funds. Need ${requiredAmount} sats, have ${totalInput} sats`);
        setIntentStep('idle');
        return;
      }

      // Fetch transaction hex for each input
      console.log('Fetching transaction hex for', selectedUtxos.length, 'inputs...');
      const inputsWithTx = await Promise.all(
        selectedUtxos.map(async (utxo) => {
          console.log('Fetching tx hex for:', utxo.txid);
          const txResponse = await fetch(`https://mutinynet.com/api/tx/${utxo.txid}/hex`);
          const txHex = await txResponse.text();
          console.log('Got tx hex for:', utxo.txid, 'length:', txHex.length);
          return {
            ...utxo,
            txHex,
          };
        })
      );
      console.log('All transaction hex fetched successfully');

      // Calculate change
      const change = totalInput - amountInSats - estimatedFee;
      console.log('Change amount:', change, 'sats');

      // Get mnemonic to derive keys (temporarily)
      console.log('Loading mnemonic and deriving keys...');
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
      console.log('Keys derived successfully');

      // Create PSBT
      console.log('Creating PSBT...');
      const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

      // Add inputs (BTC always uses segwit)
      console.log('Adding', inputsWithTx.length, 'inputs to PSBT...');
      for (let i = 0; i < inputsWithTx.length; i++) {
        const utxo = inputsWithTx[i];
        console.log('Adding input', i, ':', utxo.txid, 'vout:', utxo.vout);
        const tx = bitcoin.Transaction.fromHex(utxo.txHex);

        // Segwit input
        const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
        const segwitChild = root.derivePath(segwitPath);

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(tx.outs[utxo.vout].script),
            value: BigInt(utxo.value),
          },
        });
        console.log('Input', i, 'added successfully');
      }

      // Add output (recipient)
      console.log('Adding recipient output:', sendRecipient, 'amount:', amountInSats);
      psbt.addOutput({
        address: sendRecipient,
        value: BigInt(amountInSats),
      });
      console.log('Recipient output added');

      // Add change output if needed
      if (change > 546) { // Dust limit
        console.log('Adding change output:', sourceAddress, 'amount:', change);
        psbt.addOutput({
          address: sourceAddress,
          value: BigInt(change),
        });
        console.log('Change output added');
      } else {
        console.log('No change output (below dust limit)');
      }

      // Securely clear sensitive data
      console.log('Clearing sensitive data...');
      const clearData = [mnemonic, seed.toString('hex')];
      clearData.forEach(data => {
        if (data) {
          // Overwrite with random data
          const len = data.length;
          for (let i = 0; i < 3; i++) {
            data.split('').map(() => String.fromCharCode(Math.floor(Math.random() * 256))).join('');
          }
        }
      });

      // Create intent object
      console.log('Creating intent object...');
      const intent = {
        id: Date.now().toString(),
        type: 'send',
        amount: amountInSats,
        amountBTC: sendAmount,
        recipient: sendRecipient,
        fee: estimatedFee,
        addressType, // Always 'segwit' for BTC
        sourceAddress,
        inputs: selectedUtxos,
        totalInput,
        change,
        psbt: psbt.toBase64(),
        timestamp: Date.now(),
      };

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

  // Create UNIT (Rune) transaction with runestone encoding
  const createUnitIntent = async () => {
    try {
      console.log('Creating UNIT transaction intent...');

      // Parse amount
      const normalizedAmount = sendAmount.replace(',', '.');
      const amountInRunes = parseInt(normalizedAmount);
      if (isNaN(amountInRunes) || amountInRunes <= 0) {
        Alert.alert('Error', 'Invalid amount');
        setIntentStep('idle');
        return;
      }
      console.log('Sending', amountInRunes, 'runes to', sendRecipient);

      // Get mnemonic and derive keys
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

      // Derive Taproot address (holds runes)
      const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
      const taprootChild = root.derivePath(taprootPath);
      const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));
      const taprootPayment = bitcoin.payments.p2tr({
        internalPubkey: xOnlyPubkey,
        network: MUTINYNET_NETWORK,
      });
      const taprootAddress = taprootPayment.address;
      console.log('Taproot address:', taprootAddress);

      // Derive P2WPKH address (pays fees)
      const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
      const segwitChild = root.derivePath(segwitPath);
      const p2wpkhPayment = bitcoin.payments.p2wpkh({
        pubkey: segwitChild.publicKey,
        network: MUTINYNET_NETWORK,
      });
      const p2wpkhAddress = p2wpkhPayment.address;
      console.log('P2WPKH address:', p2wpkhAddress);

      // Fetch rune UTXOs from ord API
      console.log('Fetching rune UTXOs from ord API...');
      const ordResponse = await fetch(
        `https://ord-mutinynet.ducatprotocol.com/address/${taprootAddress}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const ordData = await ordResponse.json();
      console.log('Ord API response:', ordData);

      // Find a UTXO with sufficient runes
      let runeUtxo = null;
      for (const output of ordData.outputs || []) {
        console.log('Checking output:', output);
        const utxoResponse = await fetch(
          `https://ord-mutinynet.ducatprotocol.com/output/${output}`,
          { headers: { 'Accept': 'application/json' } }
        );
        const utxoData = await utxoResponse.json();
        console.log('UTXO data:', utxoData);

        // Check if this UTXO has DUCAT•UNIT•RUNE
        if (utxoData.runes && utxoData.runes['DUCAT•UNIT•RUNE']) {
          const runeAmount = parseInt(utxoData.runes['DUCAT•UNIT•RUNE'].amount);
          console.log('Found UTXO with', runeAmount, 'runes');

          if (runeAmount >= amountInRunes) {
            const vout = parseInt(output.match(/:(.*)$/)[1]);

            // Check if unspent
            const spendResponse = await fetch(
              `https://mutinynet.com/api/tx/${utxoData.transaction}/outspend/${vout}`
            );
            const spendData = await spendResponse.json();

            if (!spendData.spent) {
              runeUtxo = {
                transaction: utxoData.transaction,
                vout: vout,
                value: utxoData.value,
                runeAmount: runeAmount,
              };
              console.log('Selected rune UTXO:', runeUtxo);
              break;
            }
          }
        }
      }

      if (!runeUtxo) {
        Alert.alert('Error', `No UTXO found with at least ${amountInRunes} runes`);
        setIntentStep('idle');
        return;
      }

      // Fetch regular UTXOs for fees
      console.log('Fetching UTXOs for fees...');
      const utxoResponse = await fetch(`https://mutinynet.com/api/address/${p2wpkhAddress}/utxo`);
      const utxos = await utxoResponse.json();
      console.log('Found', utxos.length, 'UTXOs for fees');

      // Find a UTXO with at least 12000 sats for fees
      let satUtxo = null;
      for (const utxo of utxos) {
        if (utxo.status.confirmed && utxo.value >= 12000) {
          satUtxo = {
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
          };
          console.log('Selected sat UTXO:', satUtxo);
          break;
        }
      }

      if (!satUtxo) {
        Alert.alert('Error', 'No UTXO found with at least 12000 sats for fees');
        setIntentStep('idle');
        return;
      }

      // Calculate amounts
      const fee = 1000;
      const recipientSats = 10000;
      const dustLimit = 546;
      const totalInput = satUtxo.value + runeUtxo.value;
      const change = totalInput - fee - recipientSats - dustLimit;

      if (change < 0) {
        Alert.alert('Error', `Insufficient funds. Need ${fee + recipientSats + dustLimit}, have ${totalInput}`);
        setIntentStep('idle');
        return;
      }

      // Create PSBT
      console.log('Creating PSBT...');
      const psbt = new bitcoin.Psbt({ network: MUTINYNET_NETWORK });

      // Fetch transaction hex for inputs
      const satTxResponse = await fetch(`https://mutinynet.com/api/tx/${satUtxo.txid}/hex`);
      const satTxHex = await satTxResponse.text();
      const satTx = bitcoin.Transaction.fromHex(satTxHex);

      const runeTxResponse = await fetch(`https://mutinynet.com/api/tx/${runeUtxo.transaction}/hex`);
      const runeTxHex = await runeTxResponse.text();
      const runeTx = bitcoin.Transaction.fromHex(runeTxHex);

      // Add inputs - exactly like working example
      // Input 0: P2WPKH (for fees)
      console.log('Adding P2WPKH input...');
      psbt.addInput({
        hash: satUtxo.txid,
        index: parseInt(satUtxo.vout),
        witnessUtxo: {
          script: Buffer.from(p2wpkhPayment.output),
          value: BigInt(satUtxo.value),
        },
      });

      // Input 1: Taproot (with runes)
      console.log('Adding Taproot input...');
      psbt.addInput({
        hash: runeUtxo.transaction,
        index: parseInt(runeUtxo.vout),
        witnessUtxo: {
          script: Buffer.from(taprootPayment.output),
          value: BigInt(runeUtxo.value),
        },
        tapInternalKey: xOnlyPubkey,
      });

      // Create runestone
      console.log('Creating runestone with amount:', amountInRunes, 'to output 1');
      const runestoneConfig = {
        edicts: [
          {
            id: { block: 1527352n, tx: 1n }, // DUCAT•UNIT•RUNE ID
            amount: BigInt(amountInRunes),
            output: 1, // Recipient is at output 1
          },
        ],
      };
      console.log('Runestone config:', JSON.stringify(runestoneConfig, (key, value) =>
        typeof value === 'bigint' ? value.toString() + 'n' : value
      ));

      // Debug the actual types
      console.log('Edict types check:');
      console.log('  id.block type:', typeof runestoneConfig.edicts[0].id.block, 'value:', runestoneConfig.edicts[0].id.block.toString());
      console.log('  id.tx type:', typeof runestoneConfig.edicts[0].id.tx, 'value:', runestoneConfig.edicts[0].id.tx.toString());
      console.log('  amount type:', typeof runestoneConfig.edicts[0].amount, 'value:', runestoneConfig.edicts[0].amount.toString());
      console.log('  output type:', typeof runestoneConfig.edicts[0].output, 'value:', runestoneConfig.edicts[0].output);

      // Try calling encodeRunestone with minimal test first
      console.log('Testing encodeRunestone with simple config...');
      try {
        const testResult = encodeRunestone({ edicts: [] });
        console.log('Empty edicts test result hex:', Buffer.from(testResult.encodedRunestone).toString('hex'));
      } catch (e) {
        console.log('Empty edicts test failed:', e.message);
      }

      const runestoneResult = encodeRunestone(runestoneConfig);
      console.log('encodeRunestone result:', runestoneResult);
      console.log('encodeRunestone result keys:', Object.keys(runestoneResult));

      // Check if encodedRunestone has the edict data
      if (runestoneResult.encodedRunestone) {
        const fullHex = Buffer.from(runestoneResult.encodedRunestone).toString('hex');
        console.log('Full runestone hex:', fullHex);
        console.log('Runestone hex length:', fullHex.length, 'characters =', fullHex.length / 2, 'bytes');
      }

      const runestoneScript = runestoneResult.encodedRunestone;
      console.log('Runestone script type:', typeof runestoneScript, 'isBuffer:', Buffer.isBuffer(runestoneScript), 'length:', runestoneScript?.length);

      if (runestoneScript) {
        const scriptHex = Buffer.from(runestoneScript).toString('hex');
        console.log('Runestone script hex:', scriptHex);
        console.log('Runestone script starts with OP_RETURN (6a)?', scriptHex.startsWith('6a'));
      } else {
        console.error('ERROR: runestoneScript is null/undefined!');
      }

      // Add outputs (OP_RETURN last) - exactly like working example
      // Output 0: Rune return (gets unallocated runes)
      psbt.addOutput({
        address: taprootAddress,
        value: BigInt(dustLimit),
      });

      // Output 1: Recipient (gets specified runes via edict)
      psbt.addOutput({
        address: sendRecipient,
        value: BigInt(recipientSats),
      });

      // Output 2: Change (if any)
      if (change > dustLimit) {
        psbt.addOutput({
          address: p2wpkhAddress,
          value: BigInt(change),
        });
      }

      // Output 3: OP_RETURN with runestone (last)
      console.log('Adding OP_RETURN output with runestone script...');
      console.log('  Script to add:', Buffer.from(runestoneScript).toString('hex'));
      console.log('  Script length:', runestoneScript.length);

      psbt.addOutput({
        script: runestoneScript,
        value: BigInt(0),
      });

      console.log('PSBT created with', psbt.data.inputs.length, 'inputs and', psbt.txOutputs.length, 'outputs');

      // Verify the OP_RETURN was added correctly
      const lastOutputIndex = psbt.txOutputs.length - 1;
      const lastOutput = psbt.txOutputs[lastOutputIndex];
      console.log('Last output (should be OP_RETURN):');
      console.log('  Value:', lastOutput.value.toString());
      console.log('  Script hex:', lastOutput.script.toString('hex'));

      // Create intent object
      const intent = {
        id: Date.now().toString(),
        type: 'send',
        assetType: 'UNIT',
        amount: amountInRunes,
        amountDisplay: `${amountInRunes} UNIT`,
        recipient: sendRecipient,
        fee: fee,
        addressType: 'taproot',
        sourceAddress: taprootAddress,
        feeAddress: p2wpkhAddress,
        runeUtxo,
        satUtxo,
        totalInput,
        change,
        psbt: psbt.toBase64(),
        timestamp: Date.now(),
      };

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

  // Sign the PSBT with proper key handling and memory cleanup
  const signIntent = async () => {
    try {
      console.log('signIntent called with intent:', sendIntent);
      setIntentStep('signing');

      if (!sendIntent) {
        Alert.alert('Error', 'No intent to sign');
        setIntentStep('idle');
        return;
      }

      // Get mnemonic from secure storage
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

      // Load PSBT
      const psbt = bitcoin.Psbt.fromBase64(sendIntent.psbt);

      // Sign all inputs
      if (sendIntent.assetType === 'UNIT') {
        console.log('Signing UNIT transaction with mixed inputs...');

        // Input 0: P2WPKH (fee input)
        const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
        const segwitChild = root.derivePath(segwitPath);
        console.log('Signing P2WPKH input 0...');
        psbt.signInput(0, segwitChild);

        // Input 1: Taproot (rune input) - requires manual tweaking
        const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
        const taprootChild = root.derivePath(taprootPath);
        console.log('Signing Taproot input 1 with manual tweaking...');

        // Manual Taproot signing with tweaking
        const tx = psbt.__CACHE.__TX.clone();
        const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;

        // Get witness scripts and values for both inputs
        const prevoutScripts = [
          psbt.data.inputs[0].witnessUtxo.script,
          psbt.data.inputs[1].witnessUtxo.script,
        ];

        // Convert values to BigInt, handling both number and bigint types
        const val0 = psbt.data.inputs[0].witnessUtxo.value;
        const val1 = psbt.data.inputs[1].witnessUtxo.value;
        console.log('val0 type:', typeof val0, 'value:', val0);
        console.log('val1 type:', typeof val1, 'value:', val1);

        // Helper to convert any type to BigInt
        const toBigInt = (val) => {
          if (typeof val === 'bigint') return val;
          if (typeof val === 'number') return BigInt(val);
          if (typeof val === 'string') return BigInt(val);
          return BigInt(String(val));
        };

        const prevoutValues = [
          toBigInt(val0),
          toBigInt(val1),
        ];

        // Calculate sighash for input 1
        const hash = tx.hashForWitnessV1(1, prevoutScripts, prevoutValues, sighashType);

        // Get x-only pubkey
        const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));

        // Create the tweak
        const tweakHashRaw = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
        const tweakHash = Buffer.isBuffer(tweakHashRaw) ? tweakHashRaw : Buffer.from(tweakHashRaw);

        // Get the private key
        let privateKey = taprootChild.privateKey;
        if (!Buffer.isBuffer(privateKey)) {
          privateKey = Buffer.from(privateKey);
        }

        // Check if we need to negate the private key
        // If the public key has odd y-coordinate (0x03 prefix), negate the private key
        if (taprootChild.publicKey[0] === 0x03) {
          const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
          const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
          const negatedNum = CURVE_ORDER - privKeyNum;
          privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
        }

        // Add the tweak
        const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
        const tweakNum = BigInt('0x' + tweakHash.toString('hex'));
        const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
        const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
        const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');

        console.log('Signing with Schnorr...');
        console.log('hash length:', hash.length, 'bytes');
        console.log('tweakedPrivateKey length:', tweakedPrivateKey.length, 'bytes');

        // Ensure buffers are the correct size
        if (hash.length !== 32) {
          throw new Error(`Hash must be 32 bytes, got ${hash.length}`);
        }
        if (tweakedPrivateKey.length !== 32) {
          throw new Error(`Private key must be 32 bytes, got ${tweakedPrivateKey.length}`);
        }

        // Sign with tweaked key
        const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
        console.log('Schnorr signature created, length:', signature.length);
        psbt.updateInput(1, { tapKeySig: Buffer.from(signature) });

        console.log('Both inputs signed');
      } else {
        // BTC transaction - all inputs are same type
        if (sendIntent.addressType === 'taproot') {
          const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
          const taprootChild = root.derivePath(taprootPath);
          const tweakedSigner = taprootChild.tweak(
            bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
          );

          for (let i = 0; i < sendIntent.inputs.length; i++) {
            psbt.signInput(i, tweakedSigner);
          }
        } else {
          const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
          const segwitChild = root.derivePath(segwitPath);

          for (let i = 0; i < sendIntent.inputs.length; i++) {
            psbt.signInput(i, segwitChild);
          }
        }
      }

      // Finalize all inputs
      console.log('Finalizing inputs...');
      if (sendIntent.assetType === 'UNIT') {
        // Try to finalize all inputs
        try {
          psbt.finalizeAllInputs();
          console.log('All inputs finalized successfully');
        } catch (e) {
          // Manual finalization for Taproot (matches working example)
          console.log('Finalization failed, doing manual finalization:', e.message);
          psbt.finalizeInput(0); // P2WPKH finalizes normally

          const tapKeySig = psbt.data.inputs[1].tapKeySig;
          if (!tapKeySig) {
            throw new Error('No tapKeySig found');
          }

          // Use bitcoin.script.compile like in the working example
          psbt.data.inputs[1].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
          console.log('Taproot input manually finalized');
        }
      } else {
        psbt.finalizeAllInputs();
      }

      // Extract signed transaction
      const signedTx = psbt.extractTransaction();
      const signedTxHex = signedTx.toHex();

      // VERIFY: Check that runestone is in the transaction (for UNIT transactions)
      if (sendIntent.assetType === 'UNIT') {
        console.log('=== TRANSACTION VERIFICATION ===');
        console.log('Transaction hex length:', signedTxHex.length);
        console.log('Transaction outputs:', signedTx.outs.length);

        signedTx.outs.forEach((output, index) => {
          const scriptHex = output.script.toString('hex');
          console.log(`Output ${index}: value=${output.value}, scriptLength=${output.script.length}, scriptHex=${scriptHex.substring(0, 100)}${scriptHex.length > 100 ? '...' : ''}`);

          if (scriptHex.startsWith('6a')) {
            console.log(`  ^^^ Output ${index} is OP_RETURN!`);
            console.log(`  Full OP_RETURN script: ${scriptHex}`);

            // Check if it contains the runestone marker (0x0d = 13 in decimal, the Runes protocol tag)
            if (scriptHex.includes('0d')) {
              console.log(`  ✓ OP_RETURN contains runestone marker (0x0d)`);
            } else {
              console.log(`  ✗ WARNING: OP_RETURN missing runestone marker!`);
            }
          }
        });
        console.log('=== END VERIFICATION ===');
      }

      // CRITICAL: Securely overwrite sensitive data
      const sensitiveData = [mnemonic, seed, root];
      sensitiveData.forEach(data => {
        if (data) {
          try {
            // Overwrite memory with random data 3 times
            for (let i = 0; i < 3; i++) {
              if (Buffer.isBuffer(data)) {
                Crypto.getRandomBytes(data.length).then(random => {
                  random.copy(data);
                });
              }
            }
          } catch (e) {
            // Best effort cleanup
          }
        }
      });

      // Update intent with signed transaction
      const signedIntent = {
        ...sendIntent,
        signedTxHex,
        txid: signedTx.getId(),
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

  // Broadcast the signed transaction to the network
  const broadcastIntent = async (intent = sendIntent) => {
    try {
      console.log('broadcastIntent called with intent:', intent);
      if (!intent || !intent.signedTxHex) {
        console.error('No signed transaction to broadcast');
        Alert.alert('Error', 'No signed transaction to broadcast');
        return;
      }

      console.log('Broadcasting to mutinynet.com/api/tx...');
      const response = await fetch('https://mutinynet.com/api/tx', {
        method: 'POST',
        body: intent.signedTxHex,
      });
      console.log('Broadcast response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to broadcast transaction');
      }

      const txid = await response.text();
      console.log('Transaction broadcast successful! TXID:', txid);

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
  if (showPinEntry || settingUpPin) {
    const currentPin = settingUpPin && pinStep === 'confirm' ? confirmPin : pin;
    return (
      <View style={styles.lockScreen}>
        <StatusBar style="light" />

        {/* Title */}
        <Text style={styles.lockTitle}>
          {settingUpPin
            ? (changingPin
                ? (pinStep === 'enter' ? 'Enter New PIN' : 'Confirm New PIN')
                : (pinStep === 'enter' ? 'Enter 6-Digit PIN' : 'Confirm Your PIN'))
            : 'Enter PIN'}
        </Text>

        {/* PIN Error */}
        {pinError ? <Text style={styles.lockPinError}>{pinError}</Text> : null}

        {/* PIN Dots */}
        <View style={styles.lockPinDots}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.lockPinDot,
                i < currentPin.length && styles.lockPinDotFilled
              ]}
            />
          ))}
        </View>

        {/* Keypad */}
        <View style={styles.lockKeypad}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.lockKeypadRow}>
              {row.map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.lockKey}
                  onPress={() => handlePinDigit(String(num))}
                >
                  <Text style={styles.lockKeyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.lockKeypadRow}>
            <View style={styles.lockKey} />
            <TouchableOpacity
              style={styles.lockKey}
              onPress={() => handlePinDigit('0')}
            >
              <Text style={styles.lockKeyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.lockKey}
              onPress={handlePinDelete}
            >
              <Text style={styles.lockKeyText}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Show locked screen if not authenticated and wallet exists AND seed backup confirmed AND not in setup flow
  if (!isAuthenticated && wallet && seedConfirmed && !showingIntro && !showingSeeds && !verifyingSeeds && !settingUpPin) {
    return (
      <>
        <View style={styles.lockScreen}>
          <StatusBar style="light" />

          {/* Title */}
          <Text style={styles.lockTitle}>Enter PIN to unlock wallet</Text>

          {/* FaceID Button */}
          {showFaceIdButton && !showBiometricPrompt && (
            <TouchableOpacity style={styles.faceIdButton} onPress={authenticateUser}>
              <Text style={styles.faceIdText}>FaceID</Text>
              <Text style={styles.faceIdArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* PIN Error */}
          {pinError ? <Text style={styles.lockPinError}>{pinError}</Text> : null}

          {/* PIN Dots */}
          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < pin.length && styles.lockPinDotFilled
                ]}
              />
            ))}
          </View>

          {/* Keypad */}
          <View style={styles.lockKeypad}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map(num => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handlePinDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handlePinDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lockKey}
                onPress={handlePinDelete}
              >
                <Text style={styles.lockKeyDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

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

      {!wallet && !importingWallet ? (
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeContent}>
            <Image
              source={require('./assets/unit-logo.png')}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.welcomeButtons}>
            <Text style={styles.welcomeTitle}>UNIT Wallet</Text>
            <Text style={styles.welcomeTagline} numberOfLines={1} adjustsFontSizeToFit>A Decentralised Credit Token</Text>
            <TouchableOpacity style={styles.button} onPress={createWallet}>
              <Text style={styles.buttonText}>Create a new wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setImportingWallet(true)}
            >
              <Text style={styles.buttonText}>Restore an existing wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : importingWallet ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Import Wallet</Text>
          <Text style={styles.label}>Enter your 12-word seed phrase:</Text>
          <View style={styles.seedWordsGrid}>
            {importSeedPhrase.map((word, index) => (
              <View key={index} style={styles.seedWordContainer}>
                <Text style={styles.seedWordNumber}>{index + 1}</Text>
                <TextInput
                  ref={(ref) => seedInputRefs.current[index] = ref}
                  style={styles.seedWordInput}
                  value={word}
                  onChangeText={(text) => {
                    // Handle paste - if text contains spaces, split across inputs
                    if (text.includes(' ')) {
                      const words = text.trim().split(/\s+/);
                      const newPhrase = [...importSeedPhrase];

                      // Fill in words starting from current index
                      words.forEach((word, i) => {
                        if (index + i < 12) {
                          newPhrase[index + i] = word.toLowerCase().trim();
                        }
                      });

                      setImportSeedPhrase(newPhrase);

                      // Focus next empty input or last filled input
                      const nextIndex = Math.min(index + words.length, 11);
                      if (seedInputRefs.current[nextIndex]) {
                        setTimeout(() => seedInputRefs.current[nextIndex].focus(), 50);
                      }
                    } else {
                      // Normal typing - update current input
                      const newPhrase = [...importSeedPhrase];
                      newPhrase[index] = text.toLowerCase().trim();
                      setImportSeedPhrase(newPhrase);

                      // Auto-advance if word looks complete (no spaces, reasonable length)
                      if (text.length >= 3 && index < 11 && text.trim() && !text.includes(' ')) {
                        // Small delay to ensure smooth typing experience
                        const checkAdvance = setTimeout(() => {
                          if (seedInputRefs.current[index + 1]) {
                            seedInputRefs.current[index + 1].focus();
                          }
                        }, 300);
                        return () => clearTimeout(checkAdvance);
                      }
                    }
                  }}
                  placeholder={`Word ${index + 1}`}
                  placeholderTextColor="#666666"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType={index < 11 ? 'next' : 'done'}
                  onSubmitEditing={() => {
                    if (index < 11 && seedInputRefs.current[index + 1]) {
                      seedInputRefs.current[index + 1].focus();
                    }
                  }}
                />
              </View>
            ))}
          </View>
          <Text style={styles.warning}>
            Enter each word in the correct order!
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={importWallet}
          >
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              setImportingWallet(false);
              setImportSeedPhrase(Array(12).fill(''));
            }}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : showingIntro ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Step 1 of 4: Getting Started</Text>

          <Text style={styles.introTitle}>Your Wallet Has Been Created!</Text>

          <Text style={styles.introText}>
            In the next steps, you'll receive a 12-word recovery phrase. This phrase is the master key to your Bitcoin wallet.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Important:</Text>
            <Text style={styles.infoText}>
              • Write it down on paper{'\n'}
              • Store it in a safe place{'\n'}
              • Never share it with anyone{'\n'}
              • You'll need it to recover your wallet
            </Text>
          </View>

          <Text style={styles.warningText}>
            ⚠️ If you lose your recovery phrase, you lose access to your Bitcoin forever. There is no way to recover it.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setShowingIntro(false);
              setShowingSeeds(true);
            }}
          >
            <Text style={styles.buttonText}>I Understand, Show My Recovery Phrase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetWallet}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : showingSeeds ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Step 2 of 4: Save Your Recovery Phrase</Text>

          <Text style={styles.label}>Write down these 12 words in order:</Text>

          <View style={styles.seedGrid}>
            {tempMnemonicWords.map((word, index) => (
              <View key={index} style={styles.seedBox}>
                <Text style={styles.seedNumber}>{index + 1}</Text>
                <Text style={styles.seedWord}>{word}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.warning}>
            ⚠️ Write these words down and keep them safe!{'\n'}
            This is the ONLY way to recover your wallet.{'\n'}
            Never share them with anyone!
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={proceedToVerification}
          >
            <Text style={styles.buttonText}>I've Written Down My Words</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetWallet}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : verifyingSeeds ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Step 3 of 4: Verify Your Recovery Phrase</Text>

          <Text style={styles.label}>Select the correct word for each position:</Text>

          {requiredIndices.map((index) => (
            <View key={index} style={styles.verifyBox}>
              <Text style={styles.verifyLabel}>Word #{index + 1}</Text>
              <View style={styles.choicesContainer}>
                {wordChoices[index]?.map((choice, choiceIndex) => (
                  <TouchableOpacity
                    key={choiceIndex}
                    style={[
                      styles.choiceButton,
                      verificationWords[index] === choice && styles.choiceButtonSelected
                    ]}
                    onPress={() => setVerificationWords({...verificationWords, [index]: choice})}
                  >
                    <Text style={[
                      styles.choiceText,
                      verificationWords[index] === choice && styles.choiceTextSelected
                    ]}>
                      {choice}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.button}
            onPress={verifySeeds}
          >
            <Text style={styles.buttonText}>Verify</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetWallet}
          >
            <Text style={styles.buttonText}>Start Over</Text>
          </TouchableOpacity>
        </View>
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
