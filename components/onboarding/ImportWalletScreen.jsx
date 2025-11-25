/**
 * ImportWalletScreen - Enter 12-word seed phrase to import wallet
 */

import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from 'react-native';
import styles from '../../styles';

export default function ImportWalletScreen({
  importSeedPhrase,
  setImportSeedPhrase,
  seedInputRefs,
  isImporting,
  keyboardHeight,
  onImport,
  onCancel,
}) {
  const scrollViewRef = useRef(null);

  // Auto-scroll when keyboard appears
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setTimeout(() => {
        const scrollOffset = e.endCoordinates.height * 0.1;
        scrollViewRef.current?.scrollTo({ y: scrollOffset, animated: true });
      }, 100);
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleTextChange = (text, index) => {
    // Handle paste - if text contains spaces, split across inputs
    if (text.includes(' ')) {
      const words = text.trim().split(/\s+/);
      const newPhrase = [...importSeedPhrase];

      words.forEach((pastedWord, i) => {
        if (index + i < 12) {
          newPhrase[index + i] = pastedWord.toLowerCase().trim();
        }
      });

      setImportSeedPhrase(newPhrase);

      const nextIndex = Math.min(index + words.length, 11);
      if (seedInputRefs.current[nextIndex]) {
        setTimeout(() => seedInputRefs.current[nextIndex].focus(), 50);
      }
    } else {
      // Normal typing
      const newPhrase = [...importSeedPhrase];
      newPhrase[index] = text.toLowerCase().trim();
      setImportSeedPhrase(newPhrase);

      // Auto-advance if word looks complete
      if (text.length >= 3 && index < 11 && text.trim() && !text.includes(' ')) {
        setTimeout(() => {
          if (seedInputRefs.current[index + 1]) {
            seedInputRefs.current[index + 1].focus();
          }
        }, 300);
      }
    }
  };

  const scrollContentStyle = [
    localStyles.scrollContent,
    { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 60 },
  ];

  return (
    <View style={localStyles.importContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={scrollViewRef}
          style={localStyles.scrollContainer}
          contentContainerStyle={scrollContentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.walletInfo}>
            <Text style={styles.stepIndicator}>Import Wallet</Text>
            <Text style={styles.label}>Enter your 12-word seed phrase:</Text>
            <View style={styles.seedWordsGrid}>
              {importSeedPhrase.map((word, index) => (
                <View key={index} style={styles.seedWordContainer}>
                  <Text style={styles.seedWordNumber}>{index + 1}</Text>
                  <TextInput
                    ref={(ref) => (seedInputRefs.current[index] = ref)}
                    style={styles.seedWordInput}
                    value={word}
                    onChangeText={(text) => handleTextChange(text, index)}
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
              style={[styles.button, localStyles.importButton, isImporting && styles.buttonDisabled]}
              onPress={onImport}
              disabled={isImporting}
            >
              <Text style={styles.buttonText}>
                {isImporting ? 'Importing...' : 'Import Wallet'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const localStyles = StyleSheet.create({
  importContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    // Base style, paddingBottom is dynamic
  },
  importButton: {
    marginTop: 5,
  },
});
