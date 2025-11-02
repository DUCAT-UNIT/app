// Polyfills
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';
import * as LocalAuthentication from 'expo-local-authentication';

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Image, RefreshControl, AppState } from 'react-native';
import { useState, useEffect, useRef } from 'react';
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
};

// Helper functions for secure key derivation
const deriveMnemonicFromSecureStore = async () => {
  try {
    const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
    return mnemonic;
  } catch (error) {
    console.error('Error retrieving mnemonic from secure storage:', error);
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
  const appState = useRef(AppState.currentState);
  const inactivityTimer = useRef(null);
  const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

  const fetchBtcPrice = async () => {
    try {
      setLoadingBtcPrice(true);
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await response.json();
      setBtcPrice(data.bitcoin.usd);
    } catch (error) {
      console.error('Error fetching BTC price:', error);
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

          // Fetch balances
          fetchBalance(addresses.segwitAddress, addresses.taprootAddress);
        }
      } catch (error) {
        console.error('Error loading wallet from secure storage:', error);
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
        console.error('Error preventing screen capture:', error);
      }
    };

    preventScreenCapture();

    // Cleanup: allow screen capture when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((error) => {
        console.error('Error allowing screen capture:', error);
      });
    };
  }, []);

  // Check biometric support and authenticate on app start
  useEffect(() => {
    const checkBiometricSupport = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);

      if (compatible && wallet) {
        // If wallet exists, require authentication
        await authenticateUser();
      } else if (!wallet) {
        // No wallet yet, allow access to create/import
        setIsAuthenticated(true);
      }
    };

    checkBiometricSupport();
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground, require re-authentication if wallet exists
        if (wallet && isBiometricSupported) {
          setIsAuthenticated(false);
          // Clear inactivity timer when app goes to background
          if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
          }
          authenticateUser();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [wallet, isBiometricSupported]);

  // Cleanup inactivity timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // Start/restart inactivity timer when authenticated
  useEffect(() => {
    if (isAuthenticated && wallet && isBiometricSupported) {
      // Start the inactivity timer
      startInactivityTimer();
    } else {
      // Clear timer if not authenticated
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    }
  }, [isAuthenticated, wallet, isBiometricSupported]);

  const authenticateUser = async () => {
    try {
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasEnrolled) {
        Alert.alert(
          'No Biometrics Enrolled',
          'Please set up Face ID or Touch ID in your device settings to use this wallet.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        Alert.alert(
          'Authentication Failed',
          'You must authenticate to access your wallet.',
          [{ text: 'Try Again', onPress: authenticateUser }]
        );
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.');
    }
  };

  const startInactivityTimer = () => {
    // Clear any existing timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set new timer
    inactivityTimer.current = setTimeout(() => {
      // Lock the wallet after inactivity timeout
      setIsAuthenticated(false);
    }, INACTIVITY_TIMEOUT);
  };

  const resetInactivityTimer = () => {
    // Only reset if authenticated
    if (isAuthenticated && wallet && isBiometricSupported) {
      startInactivityTimer();
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
        console.error('Error fetching runes:', runesError);
        setRunesBalance([]);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
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
        console.error('Error pre-fetching runes:', error);
        setRunesBalance([]);
      }

      setShowingSeeds(true);
      setVerifyingSeeds(false);
      setSeedConfirmed(false);
      setSegwitBalance(null);
      setTaprootBalance(null);

      // Wallet created, user authenticated to see seed phrase
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error creating wallet:', error);
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
        console.error('Error fetching balances:', error);
        setSegwitBalance(0);
        setTaprootBalance(0);
        setRunesBalance([]);
      }

      // Skip seed verification for imported wallets, go straight to wallet view
      setSeedConfirmed(true);
      setImportingWallet(false);
      setImportSeedPhrase('');
    } catch (error) {
      console.error('Error importing wallet:', error);
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
      setSeedConfirmed(true);
      setVerifyingSeeds(false);
      // Clear temporary mnemonic from memory after successful verification
      setTempMnemonicWords([]);

      // Fetch balances immediately
      fetchBalance();
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

    // Clear state
    setWallet(null);
    setTempMnemonicWords([]);
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
      console.error('Error switching account:', error);
      Alert.alert('Error', 'Failed to switch account');
    } finally {
      setSwitchingAccount(false);
    }
  };

  // Show locked screen if not authenticated and wallet exists
  if (!isAuthenticated && wallet) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>DUCAT</Text>
        </View>
        <View style={styles.lockIconContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockedText}>Wallet Locked</Text>
          <Text style={styles.lockedSubtext}>Authenticate to access your wallet</Text>
        </View>
        <TouchableOpacity style={styles.unlockButton} onPress={authenticateUser}>
          <Text style={styles.unlockButtonText}>Unlock with Face ID</Text>
        </TouchableOpacity>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <ScrollView
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

      {!wallet && !importingWallet ? (
        <View>
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
      ) : showingSeeds ? (
        <View style={styles.walletInfo}>
          <Text style={styles.stepIndicator}>Step 1 of 3: Save Your Recovery Phrase</Text>

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
          <Text style={styles.stepIndicator}>Step 2 of 3: Verify Your Recovery Phrase</Text>

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
              <TouchableOpacity
                style={styles.addAccountButton}
                onPress={() => setShowAccountPicker(true)}
              >
                <Text style={styles.addAccountText}>+</Text>
              </TouchableOpacity>
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
              onPress={() => Alert.alert('Send', 'Send functionality coming soon')}
            >
              <Text style={styles.actionButtonText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.receiveButton]}
              onPress={() => Alert.alert('Receive', 'Receive functionality coming soon')}
            >
              <Text style={styles.actionButtonText}>Receive</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#000000',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#000000',
    color: '#DDDDDD',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    alignItems: 'center',
  },
  addressTypeButtonSelected: {
    backgroundColor: '#000000',
    borderColor: '#0066FF',
  },
  addressTypeText: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  addressTypeTextSelected: {
    color: '#0066FF',
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
    backgroundColor: '#1A1A1A',
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
    borderBottomColor: '#000000',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
    backgroundColor: '#1A1A1A',
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
  },
});
