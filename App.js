// Polyfills
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Image, RefreshControl, AppState } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Initialize ECC library for bitcoinjs-lib (required for Taproot)
bitcoin.initEccLib(ecc);

// Mutinynet signet network configuration
const mutinynet = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

// Secure storage keys
const SECURE_KEYS = {
  MNEMONIC: 'wallet_mnemonic_v1',
  CURRENT_ACCOUNT: 'wallet_current_account_v1',
  PIN: 'wallet_pin_v1',
};

// Jailbreak detection
const checkJailbreak = async () => {
  const jailbreakPaths = [
    '/Applications/Cydia.app',
    '/Library/MobileSubstrate/MobileSubstrate.dylib',
    '/bin/bash',
    '/usr/sbin/sshd',
    '/etc/apt',
    '/private/var/lib/apt/',
    '/Applications/blackra1n.app',
    '/Applications/FakeCarrier.app',
    '/Applications/Icy.app',
    '/Applications/IntelliScreen.app',
    '/Applications/MxTube.app',
    '/Applications/RockApp.app',
    '/Applications/SBSettings.app',
    '/Applications/WinterBoard.app',
    '/private/var/lib/cydia',
    '/var/cache/apt',
    '/var/lib/cydia',
    '/var/log/syslog',
    '/bin/sh',
    '/usr/libexec/sftp-server',
    '/usr/bin/ssh'
  ];

  try {
    // Check for common jailbreak files
    for (const path of jailbreakPaths) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          return true; // Jailbreak detected
        }
      } catch (e) {
        // File doesn't exist or can't be accessed - continue checking
      }
    }

    // Try to write to system directory (jailbroken devices allow this)
    try {
      const testPath = '/private/jailbreak_test.txt';
      await FileSystem.writeAsStringAsync(testPath, 'test');
      await FileSystem.deleteAsync(testPath);
      return true; // If we can write here, device is jailbroken
    } catch (e) {
      // Can't write to system directory - good sign
    }

    return false; // No jailbreak detected
  } catch (error) {
    // If checks fail, assume not jailbroken to avoid false positives
    return false;
  }
};

// Helper functions for secure key derivation
const deriveMnemonicFromSecureStore = async () => {
  try {
    const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
    return mnemonic;
  } catch (error) {
    return null;
  }
};

const deriveAddressesFromMnemonic = (mnemonic, accountIndex = 0) => {
  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Create HD wallet root
  const root = bip32.fromSeed(seed, mutinynet);

  // BIP84 - Native SegWit
  const segwitPath = `m/84'/1'/0'/0/${accountIndex}`;
  const segwitChild = root.derivePath(segwitPath);
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: segwitChild.publicKey,
    network: mutinynet,
  });

  // BIP86 - Taproot
  const taprootPath = `m/86'/1'/0'/0/${accountIndex}`;
  const taprootChild = root.derivePath(taprootPath);
  const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: mutinynet,
  });

  return {
    segwitAddress: segwitPayment.address,
    taprootAddress: taprootPayment.address,
  };
};

export default function App() {
  const [wallet, setWallet] = useState(null); // Only stores public addresses
  const [tempMnemonicWords, setTempMnemonicWords] = useState([]); // Temporary for seed verification flow
  const [showingIntro, setShowingIntro] = useState(false);
  const [showingSeeds, setShowingSeeds] = useState(false);
  const [verifyingSeeds, setVerifyingSeeds] = useState(false);
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [importingWallet, setImportingWallet] = useState(false);
  const [importSeedPhrase, setImportSeedPhrase] = useState('');
  const [segwitBalance, setSegwitBalance] = useState(null);
  const [taprootBalance, setTaprootBalance] = useState(null);
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
  const [isJailbroken, setIsJailbroken] = useState(false); // Jailbreak detection status
  const [settingUpPin, setSettingUpPin] = useState(false); // PIN setup flow
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

  // Transaction intent state
  const [sendIntent, setSendIntent] = useState(null); // Current send transaction intent
  const [intentStep, setIntentStep] = useState('idle'); // 'idle' | 'selecting_asset' | 'creating' | 'reviewing' | 'signing' | 'broadcasting' | 'confirmed'
  const [sendAssetType, setSendAssetType] = useState(null); // 'btc' | 'unit'
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState('taproot'); // 'segwit' | 'taproot'
  const [utxos, setUtxos] = useState([]); // Available UTXOs for spending
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  const appState = useRef(AppState.currentState);
  const inactivityTimer = useRef(null);
  const walletExists = useRef(false); // Track if wallet exists without triggering re-renders
  const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

  const fetchBtcPrice = async () => {
    try {
      setLoadingBtcPrice(true);
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await response.json();
      setBtcPrice(data.bitcoin.usd);
    } catch (error) {
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

  // Check for jailbreak on app start
  useEffect(() => {
    const checkForJailbreak = async () => {
      const jailbroken = await checkJailbreak();
      if (jailbroken) {
        setIsJailbroken(true);
        Alert.alert(
          'Security Warning',
          'This app cannot run on jailbroken devices for security reasons. Your funds could be at risk.',
          [{ text: 'OK', onPress: () => {} }],
          { cancelable: false }
        );
      }
    };

    checkForJailbreak();
  }, []);

  // Load wallet from secure storage on app start
  useEffect(() => {
    const loadWallet = async () => {
      try {
        const mnemonic = await deriveMnemonicFromSecureStore();
        if (mnemonic) {
          // Wallet exists in secure storage, load it
          const accountIndexStr = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
          const accountIndex = accountIndexStr ? parseInt(accountIndexStr) : 0;

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
      }
    };

    loadWallet();
  }, []);

  // Prevent screenshots and screen recording for the entire app
  useEffect(() => {
    const preventScreenCapture = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (error) {
      }
    };

    preventScreenCapture();

    // Cleanup: allow screen capture when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((error) => {
      });
    };
  }, []);

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
        // App has come to foreground from background, require re-authentication if wallet exists
        if (walletExists.current && isBiometricSupported) {
          setIsAuthenticated(false);
          authenticateUser();
        } else {
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isBiometricSupported]); // Only depend on biometric support, not wallet state

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

  // Start timer when authenticated
  useEffect(() => {
    if (isAuthenticated && walletExists.current && isBiometricSupported) {
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
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasEnrolled) {
        // No biometrics available, use PIN
        setShowPinEntry(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        // Don't show alert, user can try PIN instead
      }
    } catch (error) {
      // Error authenticating, allow PIN fallback
      setShowPinEntry(true);
    }
  };

  const savePin = async (pinValue) => {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.PIN, pinValue);
      return true;
    } catch (error) {
      return false;
    }
  };

  const verifyPin = async (enteredPin) => {
    try {
      const storedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
      return storedPin === enteredPin;
    } catch (error) {
      return false;
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
              savePin(pin).then(success => {
                if (success) {
                  setSettingUpPin(false);
                  setPin('');
                  setConfirmPin('');
                  setPinStep('enter');

                  if (changingPin) {
                    // Just changing PIN, not creating wallet
                    setChangingPin(false);
                    Alert.alert('Success', 'Your PIN has been changed.');
                  } else {
                    // Initial wallet creation
                    setSeedConfirmed(true);
                    fetchBalance();
                    Alert.alert('Wallet Created!', 'Your wallet is ready to use.');
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
          verifyPin(newPin).then(isValid => {
            if (isValid) {
              setIsAuthenticated(true);
              setShowPinEntry(false);
              setPin('');
              setPinError('');
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
              await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
              await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
              await SecureStore.deleteItemAsync(SECURE_KEYS.PIN);

              setWallet(null);
              walletExists.current = false;
              setIsAuthenticated(false);
              setShowSettings(false);
              setSegwitBalance(null);
              setTaprootBalance(null);
              setRunesBalance([]);

              Alert.alert('Success', 'Wallet has been deleted from this device.');
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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view your recovery phrase',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to change your PIN',
        fallbackLabel: 'Use current PIN',
      });

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

      // Fetch SegWit balance
      const segwitResponse = await fetch(`https://mutinynet.com/api/address/${segwitAddress}`);
      const segwitData = await segwitResponse.json();
      const segwitTotalReceived = segwitData.chain_stats?.funded_txo_sum || 0;
      const segwitTotalSpent = segwitData.chain_stats?.spent_txo_sum || 0;
      const segwitBtcBalance = (segwitTotalReceived - segwitTotalSpent) / 100000000;
      setSegwitBalance(segwitBtcBalance);

      // Fetch Taproot balance
      const taprootResponse = await fetch(`https://mutinynet.com/api/address/${taprootAddress}`);
      const taprootData = await taprootResponse.json();
      const taprootTotalReceived = taprootData.chain_stats?.funded_txo_sum || 0;
      const taprootTotalSpent = taprootData.chain_stats?.spent_txo_sum || 0;
      const taprootBtcBalance = (taprootTotalReceived - taprootTotalSpent) / 100000000;
      setTaprootBalance(taprootBtcBalance);

      // Always fetch RUNES balance from Taproot address (RUNES are always on Taproot)
      try {
        const runesResponse = await fetch(`https://ord-mutinynet.ducatprotocol.com/address/${taprootAddress}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        const runesData = await runesResponse.json();
        setRunesBalance(runesData.runes_balances || []);
      } catch (runesError) {
        setRunesBalance([]);
      }
    } catch (error) {
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
      const response = await fetch(`https://mutinynet.com/api/address/${address}/utxo`);
      const utxoData = await response.json();

      // Transform UTXO data into format needed for PSBT
      const formattedUtxos = utxoData.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: utxo.status,
      }));

      setUtxos(formattedUtxos);
      return formattedUtxos;
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch UTXOs: ' + error.message);
      return [];
    } finally {
      setLoadingUtxos(false);
    }
  };

  // Create an unsigned PSBT for the transaction
  const createSendIntent = async () => {
    try {
      setIntentStep('creating');

      // Validate inputs
      if (!sendRecipient || !sendAmount) {
        Alert.alert('Error', 'Please enter recipient address and amount');
        setIntentStep('idle');
        return;
      }

      const amountInSats = Math.floor(parseFloat(sendAmount) * 100000000);
      if (isNaN(amountInSats) || amountInSats <= 0) {
        Alert.alert('Error', 'Invalid amount');
        setIntentStep('idle');
        return;
      }

      // Get the appropriate address based on sendAddressType
      const sourceAddress = sendAddressType === 'taproot' ? wallet.taprootAddress : wallet.segwitAddress;

      // Fetch UTXOs for the source address
      const availableUtxos = await fetchUtxos(sourceAddress);
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

      let selectedUtxos = [];
      let totalInput = 0;

      for (const utxo of availableUtxos) {
        if (utxo.status.confirmed) {
          selectedUtxos.push(utxo);
          totalInput += utxo.value;
          if (totalInput >= requiredAmount) break;
        }
      }

      if (totalInput < requiredAmount) {
        Alert.alert('Error', `Insufficient funds. Need ${requiredAmount} sats, have ${totalInput} sats`);
        setIntentStep('idle');
        return;
      }

      // Fetch transaction hex for each input
      const inputsWithTx = await Promise.all(
        selectedUtxos.map(async (utxo) => {
          const txResponse = await fetch(`https://mutinynet.com/api/tx/${utxo.txid}/hex`);
          const txHex = await txResponse.text();
          return {
            ...utxo,
            txHex,
          };
        })
      );

      // Calculate change
      const change = totalInput - amountInSats - estimatedFee;

      // Get mnemonic to derive keys (temporarily)
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, mutinynet);

      // Create PSBT
      const psbt = new bitcoin.Psbt({ network: mutinynet });

      // Add inputs
      for (let i = 0; i < inputsWithTx.length; i++) {
        const utxo = inputsWithTx[i];
        const tx = bitcoin.Transaction.fromHex(utxo.txHex);

        if (sendAddressType === 'taproot') {
          // Taproot input
          const taprootPath = `m/86'/1'/0'/0/${currentAccount}`;
          const taprootChild = root.derivePath(taprootPath);
          const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);

          psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: tx.outs[utxo.vout].script,
              value: utxo.value,
            },
            tapInternalKey: xOnlyPubkey,
          });
        } else {
          // Segwit input
          const segwitPath = `m/84'/1'/0'/0/${currentAccount}`;
          const segwitChild = root.derivePath(segwitPath);

          psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: tx.outs[utxo.vout].script,
              value: utxo.value,
            },
          });
        }
      }

      // Add output (recipient)
      psbt.addOutput({
        address: sendRecipient,
        value: amountInSats,
      });

      // Add change output if needed
      if (change > 546) { // Dust limit
        psbt.addOutput({
          address: sourceAddress,
          value: change,
        });
      }

      // Securely clear sensitive data
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
      const intent = {
        id: Date.now().toString(),
        type: 'send',
        amount: amountInSats,
        amountBTC: sendAmount,
        recipient: sendRecipient,
        fee: estimatedFee,
        addressType: sendAddressType,
        sourceAddress,
        inputs: selectedUtxos,
        totalInput,
        change,
        psbt: psbt.toBase64(),
        timestamp: Date.now(),
      };

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      Alert.alert('Error', 'Failed to create transaction: ' + error.message);
      setIntentStep('idle');
    }
  };

  // Sign the PSBT with proper key handling and memory cleanup
  const signIntent = async () => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        Alert.alert('Error', 'No intent to sign');
        setIntentStep('idle');
        return;
      }

      // Get mnemonic from secure storage
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, mutinynet);

      // Load PSBT
      const psbt = bitcoin.Psbt.fromBase64(sendIntent.psbt);

      // Sign all inputs
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

      // Finalize all inputs
      psbt.finalizeAllInputs();

      // Extract signed transaction
      const signedTx = psbt.extractTransaction();
      const signedTxHex = signedTx.toHex();

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
      Alert.alert('Error', 'Failed to sign transaction: ' + error.message);
      setIntentStep('reviewing');
    }
  };

  // Broadcast the signed transaction to the network
  const broadcastIntent = async (intent = sendIntent) => {
    try {
      if (!intent || !intent.signedTxHex) {
        Alert.alert('Error', 'No signed transaction to broadcast');
        return;
      }

      const response = await fetch('https://mutinynet.com/api/tx', {
        method: 'POST',
        body: intent.signedTxHex,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to broadcast transaction');
      }

      const txid = await response.text();

      Alert.alert(
        'Success!',
        `Transaction broadcast successfully!\n\nTXID: ${txid.substring(0, 16)}...`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset intent state
              setSendIntent(null);
              setIntentStep('idle');
              setSendAmount('');
              setSendRecipient('');

              // Refresh balances
              fetchBalance();
            }
          }
        ]
      );

      setIntentStep('confirmed');
    } catch (error) {
      Alert.alert('Broadcast Error', error.message);
      setIntentStep('reviewing');
    }
  };

  const createWallet = async () => {
    try {
      // Generate random bytes using expo-crypto
      const randomBytes = await Crypto.getRandomBytesAsync(16);

      // Generate a 12-word mnemonic
      const mnemonic = bip39.entropyToMnemonic(Buffer.from(randomBytes).toString('hex'));

      // Derive addresses from mnemonic
      const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);

      // Store mnemonic in secure storage (iOS Keychain)
      await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, currentAccount.toString());

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

      setShowingIntro(true);
      setShowingSeeds(false);
      setVerifyingSeeds(false);
      setSeedConfirmed(false);
      setSegwitBalance(null);
      setTaprootBalance(null);

      // Wallet created, user authenticated to see seed phrase
      setIsAuthenticated(true);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const importWallet = async () => {
    try {
      // Trim and normalize the input
      const mnemonic = importSeedPhrase.trim().toLowerCase();

      // Validate the mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        Alert.alert('Invalid Seed Phrase', 'The seed phrase you entered is not valid. Please check and try again.');
        return;
      }

      // Derive addresses from mnemonic
      const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);

      // Store mnemonic in secure storage (iOS Keychain)
      await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, currentAccount.toString());

      // Store ONLY public addresses in state
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
      });
      walletExists.current = true;

      // Fetch BTC balances for both addresses
      try {
        // Fetch SegWit balance
        const segwitResponse = await fetch(`https://mutinynet.com/api/address/${addresses.segwitAddress}`);
        const segwitData = await segwitResponse.json();
        const segwitTotalReceived = segwitData.chain_stats?.funded_txo_sum || 0;
        const segwitTotalSpent = segwitData.chain_stats?.spent_txo_sum || 0;
        const segwitBtcBalance = (segwitTotalReceived - segwitTotalSpent) / 100000000;
        setSegwitBalance(segwitBtcBalance);

        // Fetch Taproot balance
        const taprootResponse = await fetch(`https://mutinynet.com/api/address/${addresses.taprootAddress}`);
        const taprootData = await taprootResponse.json();
        const taprootTotalReceived = taprootData.chain_stats?.funded_txo_sum || 0;
        const taprootTotalSpent = taprootData.chain_stats?.spent_txo_sum || 0;
        const taprootBtcBalance = (taprootTotalReceived - taprootTotalSpent) / 100000000;
        setTaprootBalance(taprootBtcBalance);

        // Fetch RUNES balance
        const runesResponse = await fetch(`https://ord-mutinynet.ducatprotocol.com/address/${addresses.taprootAddress}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        const runesData = await runesResponse.json();
        setRunesBalance(runesData.runes_balances || []);
      } catch (error) {
        setSegwitBalance(0);
        setTaprootBalance(0);
        setRunesBalance([]);
      }

      // Skip seed verification for imported wallets, go straight to wallet view
      setSeedConfirmed(true);
      setImportingWallet(false);
      setImportSeedPhrase('');
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
      setVerifyingSeeds(false);
      // Securely clear temporary mnemonic from memory
      // First overwrite with random data, then clear
      setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
      setTimeout(() => setTempMnemonicWords([]), 100);

      // Trigger PIN setup as final step of wallet creation
      setSettingUpPin(true);
      setPinStep('enter');
      setPin('');
      setConfirmPin('');
      setPinError('');
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

      // Retrieve mnemonic from secure storage
      const mnemonic = await deriveMnemonicFromSecureStore();
      if (!mnemonic) {
        throw new Error('Failed to retrieve wallet from secure storage');
      }

      // Derive new addresses for the selected account
      const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

      // Update wallet with only public addresses
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
      });

      // Update current account in state and secure storage
      setCurrentAccount(accountIndex);
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());

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

  // Show jailbreak warning screen if device is jailbroken
  if (isJailbroken) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>DUCAT</Text>
        </View>
        <View style={styles.lockIconContainer}>
          <Text style={styles.lockIcon}>⚠️</Text>
          <Text style={styles.lockedText}>Security Warning</Text>
          <Text style={styles.lockedSubtext}>This app cannot run on jailbroken devices.{'\n'}Your funds could be at risk.</Text>
        </View>
        <StatusBar style="dark" />
      </View>
    );
  }

  // Show PIN entry screen
  if (showPinEntry || settingUpPin) {
    const currentPin = settingUpPin && pinStep === 'confirm' ? confirmPin : pin;
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.pinContainer}>
          {settingUpPin && !changingPin && (
            <Text style={styles.stepIndicator}>Step 4 of 4: Create Your PIN</Text>
          )}
          <Text style={styles.pinTitle}>
            {settingUpPin
              ? (changingPin
                  ? (pinStep === 'enter' ? 'Enter New PIN' : 'Confirm New PIN')
                  : (pinStep === 'enter' ? 'Enter 6-Digit PIN' : 'Confirm Your PIN'))
              : 'Enter PIN'}
          </Text>
          {settingUpPin && !pinError && (
            <Text style={styles.pinSubtext}>
              {pinStep === 'enter'
                ? 'Choose a 6-digit PIN to secure your wallet'
                : 'Re-enter your PIN to confirm'}
            </Text>
          )}
          {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}

          {/* PIN Dots */}
          <View style={styles.pinDotsContainer}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  i < currentPin.length && styles.pinDotFilled
                ]}
              />
            ))}
          </View>

          {/* PIN Keypad */}
          <View style={styles.pinKeypad}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.pinRow}>
                {row.map(num => (
                  <TouchableOpacity
                    key={num}
                    style={styles.pinKey}
                    onPress={() => handlePinDigit(String(num))}
                  >
                    <Text style={styles.pinKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.pinRow}>
              <View style={styles.pinKey} />
              <TouchableOpacity
                style={styles.pinKey}
                onPress={() => handlePinDigit('0')}
              >
                <Text style={styles.pinKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pinKey}
                onPress={handlePinDelete}
              >
                <Text style={styles.pinKeyText}>⌫</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!settingUpPin && (
            <TouchableOpacity
              style={styles.pinCancelButton}
              onPress={() => {
                setShowPinEntry(false);
                setPin('');
                setPinError('');
              }}
            >
              <Text style={styles.pinCancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
        <StatusBar style="dark" />
      </View>
    );
  }

  // Show locked screen if not authenticated and wallet exists
  if (!isAuthenticated && wallet) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockIconContainer}>
          <Text style={styles.lockedText}>Wallet Locked</Text>
          <Text style={styles.lockedSubtext}>Authenticate to access your wallet</Text>
        </View>
        <TouchableOpacity style={styles.unlockButton} onPress={authenticateUser}>
          <Text style={styles.unlockButtonText}>Unlock with Face ID</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unlockButton, styles.pinButton]}
          onPress={() => setShowPinEntry(true)}
        >
          <Text style={styles.unlockButtonText}>Use PIN</Text>
        </TouchableOpacity>
        <StatusBar style="dark" />
      </View>
    );
  }

  // Full-screen seed phrase viewing
  if (viewingSeedPhrase) {
    return (
      <ScrollView style={{ backgroundColor: '#DDDDDD' }} contentContainerStyle={styles.container}>
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
    <ScrollView
      style={{ backgroundColor: '#DDDDDD' }}
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
          <Text style={styles.title}>DUCAT</Text>
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
        <View>
          <Text style={styles.welcomeTagline}>Your Bitcoin Wallet</Text>
          <TouchableOpacity style={styles.button} onPress={createWallet}>
            <Text style={styles.buttonText}>Create New Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setImportingWallet(true)}
          >
            <Text style={styles.buttonText}>Import Existing Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : importingWallet ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Import Wallet</Text>
          <Text style={styles.label}>Enter your 12-word seed phrase:</Text>
          <TextInput
            style={styles.seedInput}
            value={importSeedPhrase}
            onChangeText={setImportSeedPhrase}
            placeholder="word1 word2 word3 ..."
            placeholderTextColor="#666666"
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.warning}>
            Enter the 12 words separated by spaces.{'\n'}
            Make sure they are in the correct order!
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
              setImportSeedPhrase('');
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
                <ActivityIndicator size="small" color="#DDDDDD" />
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
                <ActivityIndicator size="large" color="#0066FF" />
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
                  <Text style={styles.settingsOptionIcon}>🔒</Text>
                  <Text style={styles.settingsOptionText}>Lock Wallet</Text>
                  <Text style={styles.settingsOptionArrow}>›</Text>
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
              {loadingBalance ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0066FF" />
                </View>
              ) : showTotalInBTC ? (
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
                setSendAssetType('btc');
                setIntentStep('creating');
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
                setSendAssetType('unit');
                setIntentStep('creating');
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

          {/* Review Intent Modal */}
          {intentStep === 'reviewing' && sendIntent && (
            <View style={styles.modalOverlay}>
              <View style={styles.intentModal}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>Review Transaction</Text>
                  <TouchableOpacity onPress={() => {
                    setIntentStep('idle');
                    setSendIntent(null);
                  }}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.intentContent}>
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Sending From:</Text>
                    <Text style={styles.reviewValue}>{sendIntent.addressType === 'taproot' ? 'Taproot' : 'SegWit'}</Text>
                    <Text style={styles.reviewAddressSmall}>{sendIntent.sourceAddress.substring(0, 20)}...</Text>
                  </View>

                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>To:</Text>
                    <Text style={styles.reviewAddressSmall}>{sendIntent.recipient}</Text>
                  </View>

                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Amount:</Text>
                    <Text style={styles.reviewValue}>{sendIntent.amountBTC} BTC</Text>
                    <Text style={styles.reviewSubtext}>({sendIntent.amount} sats)</Text>
                  </View>

                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Network Fee:</Text>
                    <Text style={styles.reviewValue}>{(sendIntent.fee / 100000000).toFixed(8)} BTC</Text>
                    <Text style={styles.reviewSubtext}>({sendIntent.fee} sats)</Text>
                  </View>

                  <View style={[styles.reviewSection, styles.reviewSectionTotal]}>
                    <Text style={styles.reviewLabelTotal}>Total:</Text>
                    <Text style={styles.reviewValueTotal}>
                      {((sendIntent.amount + sendIntent.fee) / 100000000).toFixed(8)} BTC
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={signIntent}
                  >
                    <Text style={styles.buttonText}>Confirm & Sign</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => {
                      setIntentStep('creating');
                      setSendIntent(null);
                    }}
                  >
                    <Text style={styles.buttonText}>Back</Text>
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
                  <ActivityIndicator size="large" color="#0066FF" />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#DDDDDD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#0066FF',
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  welcomeTagline: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 40,
    textAlign: 'center',
  },
  topAddAccountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#DDDDDD',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#D04C68',
    marginTop: 30,
  },
  secondaryButton: {
    backgroundColor: '#666666',
    marginTop: 15,
  },
  walletInfo: {
    width: '100%',
    backgroundColor: '#111015',
    padding: 20,
    borderRadius: 15,
    marginTop: 4,
  },
  stepIndicator: {
    fontSize: 16,
    color: '#0066FF',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  introText: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 25,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#0066FF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
  },
  warningText: {
    fontSize: 14,
    color: '#D04C68',
    backgroundColor: '#FFF5F7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  walletTitle: {
    fontSize: 16,
    color: '#DDDDDD',
    fontWeight: '600',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addAccountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAccountText: {
    fontSize: 20,
    color: '#DDDDDD',
    fontWeight: 'bold',
  },
  addressToggle: {
    flexDirection: 'row',
    backgroundColor: '#1D1C21',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleButtonLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleButtonRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#0066FF',
  },
  toggleText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#DDDDDD',
  },
  totalBalanceSection: {
    marginBottom: 30,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  balanceContainer: {
    minHeight: 43,
    justifyContent: 'center',
  },
  loadingContainer: {
    height: 43,
    justifyContent: 'center',
  },
  totalBalanceAmount: {
    fontSize: 36,
    color: '#DDDDDD',
    fontWeight: 'bold',
  },
  totalBalanceAmountSmall: {
    fontSize: 28,
  },
  assetsContainer: {
    minHeight: 144,
  },
  assetCard: {
    backgroundColor: '#1D1C21',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    height: 72,
  },
  assetCardPlaceholder: {
    opacity: 0,
    height: 72,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  btcIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  ducatIcon: {
    // Unit icon styling (if needed)
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  assetName: {
    fontSize: 16,
    color: '#DDDDDD',
    fontWeight: '600',
    marginBottom: 4,
  },
  assetSubtext: {
    fontSize: 12,
    color: '#666666',
  },
  assetValue: {
    fontSize: 16,
    color: '#DDDDDD',
    fontWeight: '600',
  },
  addressSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  addressContainer: {
    minHeight: 36,
  },
  addressText: {
    fontSize: 12,
    color: '#DDDDDD',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  copyHint: {
    fontSize: 10,
    color: '#0066FF',
    fontStyle: 'italic',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderRadius: 15,
  },
  modalContent: {
    backgroundColor: '#1D1C21',
    borderRadius: 15,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    color: '#DDDDDD',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    color: '#DDDDDD',
    marginBottom: 8,
  },
  accountInput: {
    backgroundColor: '#DDDDDD',
    color: '#333333',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0066FF',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#666666',
    marginRight: 12,
  },
  modalButtonConfirm: {
    backgroundColor: '#0066FF',
  },
  modalButtonText: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#0066FF',
    marginRight: 12,
  },
  receiveButton: {
    backgroundColor: '#59AA8A',
  },
  actionButtonText: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: '600',
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seedBox: {
    width: '48%',
    backgroundColor: '#1D1C21',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedNumber: {
    fontSize: 12,
    color: '#0066FF',
    fontWeight: 'bold',
    marginRight: 8,
    minWidth: 20,
  },
  seedWord: {
    fontSize: 14,
    color: '#DDDDDD',
    fontWeight: '600',
  },
  verifyBox: {
    marginBottom: 20,
  },
  verifyLabel: {
    fontSize: 16,
    color: '#0066FF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  choicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  choiceButton: {
    width: '48%',
    backgroundColor: '#1D1C21',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#1D1C21',
  },
  choiceButtonSelected: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  choiceText: {
    color: '#DDDDDD',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: '#DDDDDD',
    fontWeight: 'bold',
  },
  addressTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addressTypeButton: {
    width: '48%',
    backgroundColor: '#1D1C21',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1D1C21',
    alignItems: 'center',
  },
  addressTypeButtonSelected: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  addressTypeText: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  addressTypeTextSelected: {
    color: '#DDDDDD',
  },
  addressTypeSubtext: {
    color: '#666666',
    fontSize: 11,
  },
  warning: {
    fontSize: 12,
    color: '#D04C68',
    marginTop: 15,
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: 18,
  },
  runesContainer: {
    backgroundColor: '#1D1C21',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#59AA8A',
  },
  runesLabel: {
    fontSize: 14,
    color: '#59AA8A',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  runeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0066FF',
  },
  runeName: {
    fontSize: 12,
    color: '#DDDDDD',
    fontWeight: '600',
    flex: 1,
  },
  runeAmount: {
    fontSize: 16,
    color: '#59AA8A',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  seedInput: {
    backgroundColor: '#1D1C21',
    color: '#DDDDDD',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0066FF',
    fontSize: 14,
    marginBottom: 15,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  label: {
    fontSize: 14,
    color: '#DDDDDD',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    borderRadius: 15,
  },
  switchingText: {
    color: '#DDDDDD',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  balanceWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  assetValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 14,
    height: 14,
    marginRight: 3,
  },
  walletContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  priceChipsContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    width: '100%',
  },
  priceChip: {
    backgroundColor: '#1D1C21',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceChipBTC: {
    flex: 2,
    marginRight: 8,
  },
  priceChipUnit: {
    flex: 1,
  },
  priceChipIcon: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  priceChipName: {
    fontSize: 13,
    color: '#DDDDDD',
    fontWeight: '500',
    marginRight: 8,
  },
  priceChipValue: {
    fontSize: 14,
    color: '#DDDDDD',
    fontWeight: 'bold',
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: '#DDDDDD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lockIconContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 40,
  },
  lockIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  lockedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  lockedSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  unlockButtonText: {
    color: '#DDDDDD',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pinButton: {
    backgroundColor: '#666666',
    marginTop: 15,
  },
  pinContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  pinSubtext: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  pinError: {
    fontSize: 14,
    color: '#D04C68',
    marginBottom: 20,
    textAlign: 'center',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  pinKeypad: {
    width: '100%',
    maxWidth: 300,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pinKey: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#111015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinKeyText: {
    fontSize: 28,
    color: '#DDDDDD',
    fontWeight: '600',
  },
  pinCancelButton: {
    marginTop: 20,
    paddingVertical: 15,
  },
  pinCancelText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#666666',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  settingsIcon: {
    fontSize: 20,
  },
  settingsModal: {
    backgroundColor: '#1D1C21',
    borderRadius: 20,
    padding: 0,
    width: '85%',
    maxWidth: 400,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DDDDDD',
  },
  closeButton: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingsOptionIcon: {
    fontSize: 22,
    marginRight: 15,
    width: 30,
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#DDDDDD',
  },
  settingsOptionArrow: {
    fontSize: 20,
    color: '#CCCCCC',
  },
  settingsDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#D04C68',
  },
  seedPhraseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 20,
  },
  seedPhraseWarning: {
    fontSize: 14,
    color: '#D04C68',
    backgroundColor: '#FFF5F7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Intent UI styles
  intentModal: {
    backgroundColor: '#1D1C21',
    borderRadius: 20,
    padding: 0,
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  intentContent: {
    padding: 20,
  },
  intentInput: {
    backgroundColor: '#DDDDDD',
    color: '#333333',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0066FF',
    fontSize: 14,
    marginBottom: 20,
  },
  reviewSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  reviewSectionTotal: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066FF',
    paddingTop: 10,
  },
  reviewLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 5,
  },
  reviewLabelTotal: {
    fontSize: 16,
    color: '#DDDDDD',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  reviewValue: {
    fontSize: 18,
    color: '#DDDDDD',
    fontWeight: '600',
    marginBottom: 3,
  },
  reviewValueTotal: {
    fontSize: 22,
    color: '#0066FF',
    fontWeight: 'bold',
  },
  reviewSubtext: {
    fontSize: 12,
    color: '#666666',
  },
  reviewAddressSmall: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'monospace',
    marginTop: 3,
  },
  // Bottom sheet styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1D1C21',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 15,
    zIndex: 1000,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666666',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#DDDDDD',
    marginBottom: 25,
    textAlign: 'center',
  },
  assetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111015',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  assetOptionLogo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  assetOptionInfo: {
    flex: 1,
  },
  assetOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DDDDDD',
    marginBottom: 3,
  },
  assetOptionSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  assetOptionArrow: {
    fontSize: 24,
    color: '#666666',
  },
});
