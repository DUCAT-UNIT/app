/**
 * useOnboarding Hook
 * Manages wallet creation and import onboarding flow
 * - Wallet creation with seed phrase verification
 * - Wallet import from existing seed phrase
 * - Seed phrase display and verification
 */

import { useState, useRef } from 'react';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';

export function useOnboarding({
  currentAccount,
  setIsAuthenticated,
  setSettingUpPin,
  setSeedConfirmed,
  showToast,
}) {
  const { setWalletAddresses, resetWallet } = useWallet();
  const walletExistsRef = useRef(false);

  // Onboarding state
  const [tempMnemonicWords, setTempMnemonicWords] = useState([]); // Temporary for seed verification
  const [tempMnemonic, setTempMnemonic] = useState(''); // Full mnemonic string to save after PIN setup
  const [showingIntro, setShowingIntro] = useState(false);
  const [showingSeeds, setShowingSeeds] = useState(false);
  const [verifyingSeeds, setVerifyingSeeds] = useState(false);
  const [importingWallet, setImportingWallet] = useState(false);
  const [importSeedPhrase, setImportSeedPhrase] = useState(Array(12).fill(''));
  const [verificationWords, setVerificationWords] = useState({});
  const [requiredIndices, setRequiredIndices] = useState([]);
  const [wordChoices, setWordChoices] = useState({});
  const [isImportedWallet, setIsImportedWallet] = useState(false); // Track if wallet was imported
  const seedInputRefs = useRef([]);

  /**
   * Generate multiple choice options for seed word verification
   */
  const generateChoicesForWord = (correctWord, allWords) => {
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

  /**
   * Create a new wallet
   */
  const createWallet = async () => {
    try {
      // Generate wallet using WalletService
      const { mnemonic, addresses } = await WalletService.generateWallet(currentAccount);

      // DO NOT save wallet to secure storage yet - wait until after PIN setup
      // This prevents users from closing the app and skipping verification/PIN setup

      // Set showingIntro FIRST, before setting wallet, to prevent lock screen flash
      setShowingIntro(true);
      setShowingSeeds(false);
      setVerifyingSeeds(false);
      setSeedConfirmed(false);
      // Wallet created, user authenticated to see seed phrase
      setIsAuthenticated(true);

      // Store addresses in context and fetch balances
      setWalletAddresses(addresses, 0);
      walletExistsRef.current = false; // Not truly created until PIN is set

      // Temporarily store mnemonic for later saving after PIN setup
      setTempMnemonic(mnemonic);
      setTempMnemonicWords(mnemonic.split(' '));
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
    }
  };

  /**
   * Import existing wallet from seed phrase
   */
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

      // Store addresses in context and fetch balances
      // Don't let balance fetch errors break the import flow
      try {
        setWalletAddresses(addresses, currentAccount);
      } catch (balanceError) {
        console.error('Failed to fetch balance during import:', balanceError);
        // Continue anyway - wallet is imported, balance will be fetched later
      }

      walletExistsRef.current = true;

      // Skip seed verification for imported wallets
      // settingUpPin and other setup states were already set above
      // Don't set seedConfirmed here - it will be set after PIN is saved
      setImportingWallet(false);
      setImportSeedPhrase(Array(12).fill(''));
    } catch (error) {
      console.error('Import wallet error:', error);
      showToast(ERRORS.WALLET_IMPORT_FAILED, 'error');
    }
  };

  /**
   * Proceed from seed phrase display to verification
   */
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

  /**
   * Verify seed phrase words
   */
  const verifySeeds = () => {
    let allCorrect = true;

    // Check if all words have been selected
    if (Object.keys(verificationWords).length !== requiredIndices.length) {
      showToast(ERRORS.SEED_PHRASE_INCOMPLETE, 'error');
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

      // Securely clear temporary mnemonic from memory
      // First overwrite with random data, then clear
      setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
      setTimeout(() => setTempMnemonicWords([]), 100);
    } else {
      showToast(ERRORS.SEED_PHRASE_INCORRECT, 'error');
      setVerificationWords({});
    }
  };

  /**
   * Save wallet after PIN setup completes
   * This is called from PinSetupScreen after PIN is successfully saved
   */
  const saveWalletAfterPinSetup = async () => {
    try {
      if (!tempMnemonic) {
        console.error('No mnemonic to save');
        return false;
      }

      // Save wallet to secure storage
      await WalletService.saveWalletToStorage(tempMnemonic, currentAccount);

      // Mark wallet as truly existing now
      walletExistsRef.current = true;

      // Securely clear temporary mnemonic from memory
      setTempMnemonic('*'.repeat(tempMnemonic.length));
      setTimeout(() => setTempMnemonic(''), 100);
      setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
      setTimeout(() => setTempMnemonicWords([]), 100);

      return true;
    } catch (error) {
      console.error('Failed to save wallet after PIN setup:', error);
      return false;
    }
  };

  /**
   * Reset onboarding state
   */
  const resetOnboarding = () => {
    // Securely clear temporary mnemonic from memory
    setTempMnemonic('');
    setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
    setTimeout(() => setTempMnemonicWords([]), 100);

    // Clear state
    resetWallet(); // Reset context wallet state
    walletExistsRef.current = false;
    setShowingSeeds(false);
    setVerifyingSeeds(false);
    setShowingIntro(false);
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setVerificationWords({});
    setRequiredIndices([]);
    setWordChoices({});
  };

  return {
    // State
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
    walletExistsRef,

    // Setters
    setShowingIntro,
    setShowingSeeds,
    setImportingWallet,
    setImportSeedPhrase,
    setVerificationWords,
    setIsImportedWallet,

    // Functions
    createWallet,
    importWallet,
    proceedToVerification,
    verifySeeds,
    saveWalletAfterPinSetup,
    resetOnboarding,
  };
}
