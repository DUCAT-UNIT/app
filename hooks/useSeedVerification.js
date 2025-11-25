/**
 * useSeedVerification Hook
 * Manages seed phrase verification for new wallets
 * - Selects 3 random words for verification
 * - Generates multiple choice options
 * - Validates user selections
 * - Persists verification state across app backgrounding
 */

import { usePersistedObject } from './usePersistedState';
import { ERRORS } from '../utils/messages';

const VERIFICATION_STATE_KEY = 'seed_verification_state';

export function useSeedVerification({
  tempMnemonicWords,
  setSettingUpPin,
  setShowingSeeds,
  showToast,
}) {
  // Persisted verification state - automatically loads/saves
  const [verificationState, updateVerificationState, clearPersistedState] =
    usePersistedObject(
      VERIFICATION_STATE_KEY,
      {
        verifyingSeeds: false,
        verificationWords: {},
        requiredIndices: [],
        wordChoices: {},
      },
      { silent: true } // Silently fail on errors
    );

  // Extract state for backwards compatibility
  const { verifyingSeeds, verificationWords, requiredIndices, wordChoices } = verificationState;

  // Helper setters for individual fields (backwards compatibility)
  const setVerifyingSeeds = (value) => updateVerificationState({ verifyingSeeds: value });
  const setVerificationWords = (value) => updateVerificationState({ verificationWords: value });
  const setRequiredIndices = (value) => updateVerificationState({ requiredIndices: value });
  const setWordChoices = (value) => updateVerificationState({ wordChoices: value });

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
