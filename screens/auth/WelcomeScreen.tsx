/**
 * WelcomeScreen Component
 * Handles wallet onboarding flows:
 * - Initial welcome screen (create/import wallet)
 * - Restore choice (seed phrase / passkey)
 * - Import wallet flow
 */

import React from 'react';
import { TextInput } from 'react-native';
import {
  InitialWelcome,
  RestoreChoiceScreen,
  ImportWalletScreen,
} from '../../components/onboarding';
import type { WalletImportProfile } from '../../constants/bitcoin';
import { createEmptySeedPhrase } from '../../constants/mnemonic';

/**
 * Seed input refs for managing focus in import flow
 */
type SeedInputRefs = React.MutableRefObject<(TextInput | null)[]>;

/**
 * Props for the WelcomeScreen component
 */
interface WelcomeScreenProps {
  /** Whether the user is in the import wallet flow */
  importingWallet: boolean;
  /** Import seed phrase array being filled by user during import */
  importSeedPhrase: string[];
  /** Selected wallet source for seed import */
  importWalletProfile: WalletImportProfile;
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
  /** Setter for selected wallet source */
  setImportWalletProfile: (value: WalletImportProfile) => void;
  /** Setter for restoringWithPasskey state */
  setRestoringWithPasskey?: (value: boolean) => void;
  /** Function to create a new wallet with passkey support */
  createWalletWithPasskey?: () => void | Promise<void>;
  /** Function to import wallet from seed phrase */
  importWallet: () => void | Promise<void>;
  /** Function to restore wallet using passkey */
  restoreWithPasskey?: () => void | Promise<void>;
  /** Current keyboard height for layout adjustments */
  keyboardHeight?: number;
}

export default function WelcomeScreen({
  // State
  importingWallet,
  importSeedPhrase,
  importWalletProfile,
  seedInputRefs,
  isImporting,
  restoringWithPasskey,

  // State setters
  setImportingWallet,
  setImportSeedPhrase,
  setImportWalletProfile,
  setRestoringWithPasskey,

  // Functions
  createWalletWithPasskey,
  importWallet,
  restoreWithPasskey,

  // Keyboard
  keyboardHeight,
}: WelcomeScreenProps): React.JSX.Element | null {
  // Initial welcome screen — always use passkey creation flow
  if (!importingWallet && !restoringWithPasskey) {
    return (
      <InitialWelcome
        onCreateWallet={createWalletWithPasskey}
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
        importWalletProfile={importWalletProfile}
        setImportSeedPhrase={setImportSeedPhrase}
        setImportWalletProfile={setImportWalletProfile}
        seedInputRefs={seedInputRefs}
        isImporting={isImporting ?? false}
        keyboardHeight={keyboardHeight ?? 0}
        onImport={importWallet}
        onCancel={() => {
          setImportingWallet(false);
          setImportSeedPhrase(createEmptySeedPhrase());
          setRestoringWithPasskey?.(true);
        }}
      />
    );
  }

  return null;
}
