/**
 * useSeedVerification Hook
 * Manages seed phrase verification for new wallets
 * - Selects 3 random words for verification
 * - Generates multiple choice options
 * - Validates user selections
 * - Persists verification state across app backgrounding
 */

import * as Crypto from 'expo-crypto';
import { usePersistedObject } from './usePersistedState';
import { notify } from '../utils/notify';

const VERIFICATION_STATE_KEY = 'seed_verification_state';

type WordChoices = Record<number, string[]>;
type VerificationWords = Record<number, string>;

interface VerificationState {
  verifyingSeeds: boolean;
  verificationWords: VerificationWords;
  requiredIndices: number[];
  wordChoices: WordChoices;
  [key: string]: unknown;
}

interface UseSeedVerificationParams {
  tempMnemonicWords: string[];
  setSettingUpPin: (value: boolean) => void;
  setShowingSeeds: (value: boolean) => void;
}

interface UseSeedVerificationReturn {
  verifyingSeeds: boolean;
  verificationWords: VerificationWords;
  requiredIndices: number[];
  wordChoices: WordChoices;
  setVerificationWords: (value: VerificationWords) => void;
  proceedToVerification: () => void;
  verifySeeds: () => void;
  resetVerificationState: () => Promise<void>;
}

export function useSeedVerification({
  tempMnemonicWords,
  setSettingUpPin,
  setShowingSeeds,
}: UseSeedVerificationParams): UseSeedVerificationReturn {
  // Persisted verification state - automatically loads/saves
  const [verificationState, updateVerificationState, clearPersistedState] =
    usePersistedObject<VerificationState>(
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
  const setVerifyingSeeds = (value: boolean): void => updateVerificationState({ verifyingSeeds: value });
  const setVerificationWords = (value: VerificationWords): void => updateVerificationState({ verificationWords: value });
  const setRequiredIndices = (value: number[]): void => updateVerificationState({ requiredIndices: value });
  const setWordChoices = (value: WordChoices): void => updateVerificationState({ wordChoices: value });

  /**
   * Generate cryptographically secure random index
   */
  const secureRandomIndex = (max: number): number => {
    const randomBytes = Crypto.getRandomBytes(4);
    const randomValue = new DataView(randomBytes.buffer).getUint32(0, true);
    return randomValue % max;
  };

  /**
   * Cryptographically secure shuffle using Fisher-Yates
   */
  const secureShuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = secureRandomIndex(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  /**
   * Generate multiple choice options for seed word verification
   */
  const generateChoicesForWord = (correctWord: string, allWords: string[]): string[] => {
    const choices = [correctWord];
    const otherWords = allWords.filter((w) => w !== correctWord);

    // Add 3 random wrong choices using secure random
    while (choices.length < 4) {
      const randomWord = otherWords[secureRandomIndex(otherWords.length)];
      if (!choices.includes(randomWord)) {
        choices.push(randomWord);
      }
    }

    // Shuffle choices using secure shuffle
    return secureShuffleArray(choices);
  };

  /**
   * Proceed from seed phrase display to verification
   */
  const proceedToVerification = (): void => {
    // Select 3 random indices for verification using secure random
    const indices: number[] = [];
    while (indices.length < 3) {
      const randomIndex = secureRandomIndex(12);
      if (!indices.includes(randomIndex)) {
        indices.push(randomIndex);
      }
    }
    setRequiredIndices(indices.sort((a, b) => a - b));

    // Generate multiple choice options for each word
    const choices: WordChoices = {};
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
  const verifySeeds = (): void => {
    // Check if all words have been selected
    if (Object.keys(verificationWords).length !== requiredIndices.length) {
      notify.seed.incomplete();
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
      notify.seed.incorrect();
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
