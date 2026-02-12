/**
 * ImportWalletScreen - Enter 12-word seed phrase to import wallet
 * Compact, responsive design for all screen sizes
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, fontSizes, fontWeights, radii, layout } from '../../styles/theme';
import Icon from '../icons';
import { logger } from '../../utils/logger';
import { notify } from '../../utils/notify';

interface ImportWalletScreenProps {
  importSeedPhrase: string[];
  setImportSeedPhrase: (phrase: string[]) => void;
  seedInputRefs: React.MutableRefObject<(TextInput | null)[]>;
  isImporting: boolean;
  keyboardHeight: number;
  onImport: () => void;
  onCancel: () => void;
}

const WORD_COUNT = 12;
const isSmallScreen = layout.screen.width <= 375;

export default function ImportWalletScreen({
  importSeedPhrase,
  setImportSeedPhrase,
  seedInputRefs,
  isImporting,
  onImport,
  onCancel,
}: ImportWalletScreenProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const filledCount = useMemo(() => {
    return importSeedPhrase.filter((word) => word.trim().length > 0).length;
  }, [importSeedPhrase]);

  const isComplete = filledCount === WORD_COUNT;

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;

      const words = text
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .slice(0, WORD_COUNT);

      if (words.length > 0) {
        const newPhrase = Array(WORD_COUNT).fill('');
        words.forEach((word, i) => {
          newPhrase[i] = word;
        });
        setImportSeedPhrase(newPhrase);

        // SECURITY: Clear clipboard after pasting seed phrase to prevent leakage
        try {
          await Clipboard.setStringAsync('');
        } catch {
          // Clipboard clear failure is non-critical
        }
      }
    } catch (error: unknown) {
      // Clipboard access may be denied by user or system
      logger.debug('[ImportWalletScreen] Clipboard access failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [setImportSeedPhrase]);

  const handleClear = useCallback(() => {
    setImportSeedPhrase(Array(WORD_COUNT).fill(''));
    seedInputRefs.current[0]?.focus();
  }, [setImportSeedPhrase, seedInputRefs]);

  const handleTextChange = useCallback(
    (text: string, index: number) => {
      if (text.includes(' ')) {
        const words = text
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const newPhrase = [...importSeedPhrase];

        words.forEach((pastedWord: string, i: number) => {
          if (index + i < WORD_COUNT) {
            newPhrase[index + i] = pastedWord.trim();
          }
        });

        setImportSeedPhrase(newPhrase);
        const nextIndex = Math.min(index + words.length, WORD_COUNT - 1);
        setTimeout(() => seedInputRefs.current[nextIndex]?.focus(), 50);
      } else {
        const newPhrase = [...importSeedPhrase];
        newPhrase[index] = text.toLowerCase().replace(/\s/g, '');
        setImportSeedPhrase(newPhrase);
      }
    },
    [importSeedPhrase, setImportSeedPhrase, seedInputRefs]
  );

  const handleSubmitEditing = useCallback(
    (index: number) => {
      if (index < WORD_COUNT - 1) {
        seedInputRefs.current[index + 1]?.focus();
      } else if (isComplete && !isImporting) {
        // On the 12th word, trigger import if form is complete
        onImport();
      } else if (!isComplete) {
        // Show error with missing word position and focus on first empty word
        const firstEmptyIndex = importSeedPhrase.findIndex((word) => word.trim().length === 0);
        if (firstEmptyIndex !== -1) {
          notify.error(`Please enter a word for position ${firstEmptyIndex + 1}`);
          seedInputRefs.current[firstEmptyIndex]?.focus();
        }
      }
    },
    [seedInputRefs, isComplete, isImporting, onImport, importSeedPhrase]
  );

  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  const renderWordInput = useCallback(
    (index: number) => {
      const word = importSeedPhrase[index] || '';
      const isFocused = focusedIndex === index;
      const hasContent = word.trim().length > 0;

      return (
        <View key={index} style={styles.wordWrapper}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => seedInputRefs.current[index]?.focus()}
            testID={`seed-word-container-${index}`}
            style={[
              styles.wordContainer,
              isFocused && styles.wordContainerFocused,
              hasContent && !isFocused && styles.wordContainerFilled,
            ]}
          >
            <Text
              style={[
                styles.wordNumber,
                isFocused && styles.wordNumberFocused,
                hasContent && !isFocused && styles.wordNumberFilled,
              ]}
            >
              {index + 1}
            </Text>
            <TextInput
              ref={(ref) => {
                seedInputRefs.current[index] = ref;
              }}
              testID={`seed-input-${index}`}
              style={styles.wordInput}
              value={word}
              onChangeText={(text) => handleTextChange(text, index)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType={index < WORD_COUNT - 1 ? 'next' : 'done'}
              onSubmitEditing={() => handleSubmitEditing(index)}
              blurOnSubmit={false}
              selectTextOnFocus
            />
          </TouchableOpacity>
        </View>
      );
    },
    [
      importSeedPhrase,
      focusedIndex,
      seedInputRefs,
      handleTextChange,
      handleFocus,
      handleBlur,
      handleSubmitEditing,
    ]
  );

  const rows = useMemo(() => {
    const result: number[][] = [];
    for (let i = 0; i < WORD_COUNT; i += 2) {
      result.push([i, i + 1]);
    }
    return result;
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      testID="import-wallet-screen"
    >
      <ScrollView
        testID="import-scroll-view"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.subtitle}>Enter your 12-word recovery phrase</Text>
        </View>

        {/* Progress row with paste/clear button */}
        <View style={styles.progressRow}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(filledCount / WORD_COUNT) * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{filledCount}/{WORD_COUNT}</Text>
          </View>

          {filledCount === 0 ? (
            <TouchableOpacity style={styles.actionButton} onPress={handlePaste} activeOpacity={0.7} testID="import-paste-btn">
              <Icon name="copy" size={14} color={colors.brand.primary} />
              <Text style={styles.actionButtonText}>Paste</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={handleClear} activeOpacity={0.7}>
              <Icon name="x" size={14} color={colors.text.secondary} />
              <Text style={[styles.actionButtonText, styles.clearButtonText]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Seed phrase grid */}
        <View style={styles.gridContainer}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((wordIndex) => renderWordInput(wordIndex))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Buttons pinned to bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.importButton,
            (!isComplete || isImporting) && styles.buttonDisabled,
          ]}
          onPress={onImport}
          disabled={(!isComplete && !(__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true')) || isImporting}
          activeOpacity={0.8}
          testID="import-wallet-btn"
        >
          <Text style={[styles.importButtonText, (!isComplete || isImporting) && styles.buttonTextDisabled]}>
            {isImporting ? 'Importing...' : 'Import Wallet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.padding,
    paddingTop: isSmallScreen ? 12 : 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: isSmallScreen ? fontSizes.xl : fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: isSmallScreen ? fontSizes.sm : fontSizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 14 : 18,
    gap: 12,
  },
  progressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    minWidth: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: colors.bg.secondary,
  },
  actionButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.brand.primary,
  },
  clearButtonText: {
    color: colors.text.secondary,
  },
  gridContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 8 : 10,
  },
  wordWrapper: {
    width: '48.5%',
  },
  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    height: isSmallScreen ? 44 : 48,
    paddingLeft: 10,
    paddingRight: 6,
  },
  wordContainerFocused: {
    borderColor: colors.brand.primary,
    borderWidth: 2,
    paddingLeft: 9,
    paddingRight: 5,
  },
  wordContainerFilled: {
    borderColor: colors.border.light,
    backgroundColor: colors.bg.secondary,
  },
  wordNumber: {
    fontFamily: fonts.bold,
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: fontWeights.bold,
    color: colors.text.tertiary,
    width: 18,
    textAlign: 'center',
  },
  wordNumberFocused: {
    color: colors.brand.primary,
  },
  wordNumberFilled: {
    color: colors.text.secondary,
  },
  wordInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: isSmallScreen ? 14 : 15,
    color: colors.text.primary,
    paddingVertical: 0,
    paddingHorizontal: 6,
    height: '100%',
  },
  buttonContainer: {
    gap: 10,
    paddingHorizontal: layout.padding,
    paddingBottom: isSmallScreen ? 20 : 30,
    paddingTop: 10,
  },
  importButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: isSmallScreen ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
  importButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  buttonTextDisabled: {
    color: colors.text.tertiary,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: radii.lg,
    paddingVertical: isSmallScreen ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
});
