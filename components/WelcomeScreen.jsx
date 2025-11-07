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
import { Text, View, TouchableOpacity, TextInput } from 'react-native';
import Icon from './Icon';
import styles from '../styles';

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

  // State setters
  setImportingWallet,
  setImportSeedPhrase,
  setVerificationWords,
  setShowingIntro,
  setShowingSeeds,

  // Functions
  createWallet,
  importWallet,
  resetWallet,
  proceedToVerification,
  verifySeeds,
}) {
  // Initial welcome screen (no wallet exists)
  if (!wallet && !importingWallet) {
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <Icon name="unit_logo" size={120} />
        </View>
        <View style={styles.welcomeButtons}>
          <Text style={styles.welcomeTitle}>UNIT Wallet</Text>
          <Text style={styles.welcomeTagline} numberOfLines={1} adjustsFontSizeToFit>
            A Decentralised Credit Token
          </Text>
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
    );
  }

  // Import wallet screen
  if (importingWallet) {
    return (
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
        <TouchableOpacity
          style={[styles.button, { marginTop: 5 }]}
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
    );
  }

  // Step 1: Intro screen (after wallet creation)
  if (showingIntro) {
    return (
      <View style={styles.walletInfo}>
        <Text style={styles.stepIndicator}>Step 1 of 4</Text>

        <View style={styles.introIconContainer}>
          <Text style={styles.introIcon}>✓</Text>
        </View>

        <Text style={styles.introTitle}>Wallet Created</Text>

        <Text style={styles.introText}>
          Your recovery phrase is the only way to restore your wallet. Keep it safe.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoItem}>✓ Write it down</Text>
          <Text style={styles.infoItem}>✓ Store it safely</Text>
          <Text style={styles.infoItem}>✓ Never share it</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setShowingIntro(false);
            setShowingSeeds(true);
          }}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={resetWallet}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 2: Show seed phrase
  if (showingSeeds) {
    return (
      <View style={styles.walletInfo}>
        <Text style={styles.stepIndicator}>Step 2 of 4</Text>

        <Text style={styles.label}>Write down these 12 words:</Text>

        <View style={styles.seedGrid}>
          {tempMnemonicWords.map((word, index) => (
            <View key={index} style={styles.seedBox}>
              <Text style={styles.seedNumber}>{index + 1}</Text>
              <Text style={styles.seedWord}>{word}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.warning}>
          ⚠️ Write them down and keep them safe!
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={proceedToVerification}
        >
          <Text style={styles.buttonText}>I've Written Them Down</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={resetWallet}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 3: Verify seed phrase
  if (verifyingSeeds) {
    return (
      <View style={styles.walletInfo}>
        <Text style={styles.stepIndicator}>Step 3 of 4</Text>

        <Text style={styles.label}>Select the correct word:</Text>

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
    );
  }

  // If we get here, something's wrong - return null
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

  // State setters
  setImportingWallet: PropTypes.func.isRequired,
  setImportSeedPhrase: PropTypes.func.isRequired,
  setVerificationWords: PropTypes.func.isRequired,
  setShowingIntro: PropTypes.func.isRequired,
  setShowingSeeds: PropTypes.func.isRequired,

  // Functions
  createWallet: PropTypes.func.isRequired,
  importWallet: PropTypes.func.isRequired,
  resetWallet: PropTypes.func.isRequired,
  proceedToVerification: PropTypes.func.isRequired,
  verifySeeds: PropTypes.func.isRequired,
};
