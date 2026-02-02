/**
 * WelcomeScreen Component
 * Handles all wallet onboarding flows:
 * - Initial welcome screen (create/import wallet)
 * - Import wallet flow
 * - Wallet creation intro (Step 1)
 * - Seed phrase display (Step 2)
 * - Seed phrase verification (Step 3)
 */

import React from 'react';
import { TextInput } from 'react-native';
import {
  InitialWelcome,
  RestoreChoiceScreen,
  ImportWalletScreen,
  WalletCreatedIntro,
  SeedPhraseDisplay,
  SeedPhraseVerify,
} from '../../components/onboarding';

/**
 * Wallet object shape
 */
interface Wallet {
  [key: string]: unknown;
}

/**
 * Verification words map (index -> selected word)
 */
interface VerificationWords {
  [index: number]: string;
}

/**
 * Word choices for each required index during verification
 */
interface WordChoices {
  [index: number]: string[];
}

/**
 * Seed input refs for managing focus in import flow
 */
type SeedInputRefs = React.MutableRefObject<(TextInput | null)[]>;

/**
 * Props for the WelcomeScreen component
 */
interface WelcomeScreenProps {
  /** The wallet object if it exists, null/undefined if no wallet created yet */
  wallet?: Wallet | null;
  /** Whether the user is in the import wallet flow */
  importingWallet: boolean;
  /** Whether showing the wallet creation intro screen (Step 1) */
  showingIntro: boolean;
  /** Whether showing the seed phrase display screen (Step 2) */
  showingSeeds: boolean;
  /** Whether showing the seed phrase verification screen (Step 3) */
  verifyingSeeds: boolean;
  /** Temporary mnemonic words array for the newly created wallet */
  tempMnemonicWords: string[];
  /** Import seed phrase array being filled by user during import */
  importSeedPhrase: string[];
  /** Map of verification word selections during seed verification */
  verificationWords: VerificationWords;
  /** Array of required indices for seed phrase verification */
  requiredIndices: number[];
  /** Map of word choices for each required index during verification */
  wordChoices: WordChoices;
  /** Refs for seed input fields during import flow */
  seedInputRefs: SeedInputRefs;
  /** Whether wallet import is in progress */
  isImporting?: boolean;
  /** Whether user is in the restore with passkey flow */
  restoringWithPasskey?: boolean;
  /** Setter for importingWallet state */
  setImportingWallet: (value: boolean) => void;
  /** Setter for importSeedPhrase state */
  setImportSeedPhrase: (value: string[]) => void;
  /** Setter for verificationWords state */
  setVerificationWords: (value: VerificationWords) => void;
  /** Setter for showingIntro state */
  setShowingIntro: (value: boolean) => void;
  /** Setter for showingSeeds state */
  setShowingSeeds: (value: boolean) => void;
  /** Setter for restoringWithPasskey state */
  setRestoringWithPasskey?: (value: boolean) => void;
  /** Function to create a new wallet (seed phrase flow, no passkey) */
  createWallet?: () => void | Promise<void>;
  /** Function to create a new wallet with passkey support */
  createWalletWithPasskey?: () => void | Promise<void>;
  /** Function to import wallet from seed phrase */
  importWallet: () => void | Promise<void>;
  /** Function to restore wallet using passkey */
  restoreWithPasskey?: () => void | Promise<void>;
  /** Function to reset wallet creation state */
  resetCreationState: () => void | Promise<void>;
  /** Function to reset seed phrase verification state */
  resetVerificationState: () => void | Promise<void>;
  /** Function to proceed from seed display to verification */
  proceedToVerification: () => void | Promise<void>;
  /** Function to verify the selected seed words */
  verifySeeds: () => void | Promise<void>;
  /** Current keyboard height for layout adjustments */
  keyboardHeight?: number;
}

export default function WelcomeScreen({
  // State
  wallet,
  importingWallet,
  showingIntro,
  showingSeeds,
  verifyingSeeds,
  tempMnemonicWords,
  importSeedPhrase,
  verificationWords,
  requiredIndices,
  wordChoices,
  seedInputRefs,
  isImporting,
  restoringWithPasskey,

  // State setters
  setImportingWallet,
  setImportSeedPhrase,
  setVerificationWords,
  setShowingIntro,
  setShowingSeeds,
  setRestoringWithPasskey,

  // Functions
  createWallet,
  createWalletWithPasskey,
  importWallet,
  restoreWithPasskey,
  resetCreationState,
  resetVerificationState,
  proceedToVerification,
  verifySeeds,

  // Keyboard
  keyboardHeight,
}: WelcomeScreenProps): React.JSX.Element | null {
  // Handle cancel for create wallet flow
  const handleCancelCreateWallet = async (): Promise<void> => {
    await resetCreationState();
    await resetVerificationState();
  };

  // Initial welcome screen (no wallet exists)
  // In E2E mode, use seed phrase creation to avoid passkey system dialogs
  const isE2E = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true';
  if (!wallet && !importingWallet && !restoringWithPasskey) {
    return (
      <InitialWelcome
        onCreateWallet={isE2E ? createWallet : createWalletWithPasskey}
        onRestoreWallet={() => setRestoringWithPasskey?.(true)}
      />
    );
  }

  // Restore choice screen
  if (restoringWithPasskey && !importingWallet) {
    return (
      <RestoreChoiceScreen
        onSeedPhrase={() => {
          setRestoringWithPasskey?.(false);
          setImportingWallet(true);
        }}
        onPasskey={restoreWithPasskey || (() => {})}
        onCancel={() => setRestoringWithPasskey?.(false)}
        hasPasskeyRestore={!!restoreWithPasskey}
      />
    );
  }

  // Import wallet screen
  if (importingWallet) {
    return (
      <ImportWalletScreen
        importSeedPhrase={importSeedPhrase}
        setImportSeedPhrase={setImportSeedPhrase}
        seedInputRefs={seedInputRefs}
        isImporting={isImporting ?? false}
        keyboardHeight={keyboardHeight ?? 0}
        onImport={importWallet}
        onCancel={() => {
          setImportingWallet(false);
          setImportSeedPhrase(Array(12).fill(''));
          setRestoringWithPasskey?.(true);
        }}
      />
    );
  }

  // Step 1: Intro screen
  if (showingIntro) {
    return (
      <WalletCreatedIntro
        onContinue={() => {
          setShowingIntro(false);
          setShowingSeeds(true);
        }}
        onCancel={handleCancelCreateWallet}
      />
    );
  }

  // Step 2: Show seed phrase
  if (showingSeeds) {
    return (
      <SeedPhraseDisplay
        seedWords={tempMnemonicWords}
        onContinue={proceedToVerification}
        onCancel={handleCancelCreateWallet}
      />
    );
  }

  // Step 3: Verify seed phrase
  if (verifyingSeeds) {
    return (
      <SeedPhraseVerify
        requiredIndices={requiredIndices}
        wordChoices={wordChoices}
        verificationWords={verificationWords}
        setVerificationWords={setVerificationWords}
        onVerify={verifySeeds}
        onCancel={handleCancelCreateWallet}
      />
    );
  }

  return null;
}
