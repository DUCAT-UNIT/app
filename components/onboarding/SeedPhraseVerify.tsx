/**
 * SeedPhraseVerify - Step 3: Verify seed phrase with word selection
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../../styles';

interface SeedPhraseVerifyProps {
  requiredIndices: number[];
  wordChoices: { [key: number]: string[] };
  verificationWords: { [key: number]: string };
  setVerificationWords: (words: { [key: number]: string }) => void;
  onVerify: () => void;
  onCancel: () => void;
}

export default function SeedPhraseVerify({
  requiredIndices,
  wordChoices,
  verificationWords,
  setVerificationWords,
  onVerify,
  onCancel,
}: SeedPhraseVerifyProps) {
  const handleWordSelect = (index: number, choice: string) => {
    setVerificationWords({ ...verificationWords, [index]: choice });
  };

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
                  verificationWords[index] === choice && styles.choiceButtonSelected,
                ]}
                onPress={() => handleWordSelect(index, choice)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    verificationWords[index] === choice && styles.choiceTextSelected,
                  ]}
                >
                  {choice}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={onVerify}>
        <Text style={styles.buttonText}>Verify</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={onCancel}
      >
        <Text style={styles.buttonText}>Start Over</Text>
      </TouchableOpacity>
    </View>
  );
}
