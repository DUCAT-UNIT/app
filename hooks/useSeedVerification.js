/**
 * useSeedVerification Hook
 * Manages seed phrase verification for new wallets
 * - Selects 3 random words for verification
 * - Generates multiple choice options
 * - Validates user selections
 * - Persists verification state across app backgrounding
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ERRORS } from '../utils/messages';

const VERIFICATION_STATE_KEY = 'seed_verification_state';

export function useSeedVerification({
  tempMnemonicWords,
  setSettingUpPin,
  setShowingSeeds,
  showToast,
}) {
  const [stateLoaded, setStateLoaded] = useState(false);

  // Verification state
  const [verifyingSeeds, setVerifyingSeeds] = useState(false);
  const [verificationWords, setVerificationWords] = useState({});
  const [requiredIndices, setRequiredIndices] = useState([]);
  const [wordChoices, setWordChoices] = useState({});

  // Load persisted verification state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(VERIFICATION_STATE_KEY);
        if (savedState) {
          const state = JSON.parse(savedState);

          if (state.verifyingSeeds !== undefined) setVerifyingSeeds(state.verifyingSeeds);
          if (state.verificationWords) setVerificationWords(state.verificationWords);
          if (state.requiredIndices) setRequiredIndices(state.requiredIndices);
          if (state.wordChoices) setWordChoices(state.wordChoices);
        }
      } catch (error) {
        // Silently fail
      } finally {
        setStateLoaded(true);
      }
    };

    loadState();
  }, []);

  // Persist verification state whenever it changes
  useEffect(() => {
    if (!stateLoaded) return;

    const saveState = async () => {
      try {
        const state = {
          verifyingSeeds,
          verificationWords,
          requiredIndices,
          wordChoices,
        };
        await AsyncStorage.setItem(VERIFICATION_STATE_KEY, JSON.stringify(state));
      } catch (error) {
        // Silently fail
      }
    };

    saveState();
  }, [stateLoaded, verifyingSeeds, verificationWords, requiredIndices, wordChoices]);

  /**
   * Clear persisted state
   */
  const clearPersistedState = async () => {
    try {
      await AsyncStorage.removeItem(VERIFICATION_STATE_KEY);
    } catch (error) {
      // Silently fail
    }
  };

  /**
   * Generate multiple choice options for seed word verification
   */
  const generateChoicesForWord = (correctWord, allWords) => {
    const choices = [correctWord];
    const otherWords = allWords.filter((w) => w !== correctWord);

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
    indices.forEach((index) => {
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
    // Check if all words have been selected
    if (Object.keys(verificationWords).length !== requiredIndices.length) {
      showToast(ERRORS.SEED_PHRASE_INCOMPLETE, 'error');
      return;
    }

    // Check if words are correct
    let allCorrect = true;
    for (const index of requiredIndices) {
      const userWord = (verificationWords[index] || '').trim().toLowerCase();
      const correctWord = (tempMnemonicWords[index] || '').trim().toLowerCase();
      if (userWord !== correctWord) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      // Set both states immediately to prevent lock screen flash
      setVerifyingSeeds(false);
      setSettingUpPin(true);

      // Clear persisted state
      clearPersistedState();
    } else {
      showToast(ERRORS.SEED_PHRASE_INCORRECT, 'error');
      setVerificationWords({});
    }
  };

  /**
   * Reset verification state
   */
  const resetVerificationState = async () => {
    setVerifyingSeeds(false);
    setVerificationWords({});
    setRequiredIndices([]);
    setWordChoices({});
    await clearPersistedState();
  };

  return {
    // State
    verifyingSeeds,
    verificationWords,
    requiredIndices,
    wordChoices,

    // Setters
    setVerificationWords,

    // Functions
    proceedToVerification,
    verifySeeds,
    resetVerificationState,
  };
}
