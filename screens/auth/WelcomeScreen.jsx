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
import PropTypes from 'prop-types';
import {
  InitialWelcome,
  RestoreChoiceScreen,
  ImportWalletScreen,
  WalletCreatedIntro,
  SeedPhraseDisplay,
  SeedPhraseVerify,
} from '../../components/onboarding';

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
  createWalletWithPasskey,
  importWallet,
  restoreWithPasskey,
  resetCreationState,
  resetVerificationState,
  proceedToVerification,
  verifySeeds,

  // Keyboard
  keyboardHeight,
}) {
  // Handle cancel for create wallet flow
  const handleCancelCreateWallet = async () => {
    await resetCreationState();
    await resetVerificationState();
  };

  // Initial welcome screen (no wallet exists)
  if (!wallet && !importingWallet && !restoringWithPasskey) {
    return (
      <InitialWelcome
        onCreateWallet={createWalletWithPasskey}
        onRestoreWallet={() => setRestoringWithPasskey(true)}
      />
    );
  }

  // Restore choice screen
  if (restoringWithPasskey && !importingWallet) {
    return (
      <RestoreChoiceScreen
        onSeedPhrase={() => {
          setRestoringWithPasskey(false);
          setImportingWallet(true);
        }}
        onPasskey={restoreWithPasskey}
        onCancel={() => setRestoringWithPasskey(false)}
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
        isImporting={isImporting}
        keyboardHeight={keyboardHeight}
        onImport={importWallet}
        onCancel={() => {
          setImportingWallet(false);
          setImportSeedPhrase(Array(12).fill(''));
          setRestoringWithPasskey(true);
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

WelcomeScreen.propTypes = {
  // State
  wallet: PropTypes.object,
  importingWallet: PropTypes.bool.isRequired,
  showingIntro: PropTypes.bool.isRequired,
  showingSeeds: PropTypes.bool.isRequired,
  verifyingSeeds: PropTypes.bool.isRequired,
  tempMnemonicWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  importSeedPhrase: PropTypes.arrayOf(PropTypes.string).isRequired,
  verificationWords: PropTypes.object.isRequired,
  requiredIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  wordChoices: PropTypes.object.isRequired,
  seedInputRefs: PropTypes.object.isRequired,
  isImporting: PropTypes.bool,
  restoringWithPasskey: PropTypes.bool,

  // State setters
  setImportingWallet: PropTypes.func.isRequired,
  setImportSeedPhrase: PropTypes.func.isRequired,
  setVerificationWords: PropTypes.func.isRequired,
  setShowingIntro: PropTypes.func.isRequired,
  setShowingSeeds: PropTypes.func.isRequired,
  setRestoringWithPasskey: PropTypes.func,

  // Functions
  createWallet: PropTypes.func.isRequired,
  createWalletWithPasskey: PropTypes.func,
  importWallet: PropTypes.func.isRequired,
  restoreWithPasskey: PropTypes.func,
  resetWallet: PropTypes.func.isRequired,
  resetCreationState: PropTypes.func.isRequired,
  resetVerificationState: PropTypes.func.isRequired,
  proceedToVerification: PropTypes.func.isRequired,
  verifySeeds: PropTypes.func.isRequired,

  // Keyboard
  keyboardHeight: PropTypes.number,
};
