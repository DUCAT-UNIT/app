/**
 * SeedPhraseDisplay - Step 2: Display seed phrase to user
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../../styles';

export default function SeedPhraseDisplay({
  seedWords,
  onContinue,
  onCancel,
}) {
  return (
    <View style={styles.walletInfo}>
      <Text style={styles.stepIndicator}>Step 2 of 4</Text>

      <Text style={styles.label}>Write down these 12 words:</Text>

      <View style={styles.seedGrid}>
        {seedWords.map((word, index) => (
          <View key={index} style={styles.seedBox}>
            <Text style={styles.seedNumber}>{index + 1}</Text>
            <Text style={styles.seedWord}>{word}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.warning}>⚠️ Write them down and keep them safe!</Text>

      <TouchableOpacity style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>I've Written Them Down</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={onCancel}
      >
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
