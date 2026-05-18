/**
 * ImportWalletScreen - Enter a seed phrase to import wallet
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
import { WALLET_IMPORT_PROFILE_OPTIONS, type WalletImportProfile } from '../../constants/bitcoin';
import {
  MAX_SEED_PHRASE_WORD_COUNT,
  SUPPORTED_SEED_PHRASE_WORD_COUNTS,
  createEmptySeedPhrase,
  getSeedPhraseWordCountForPaste,
  getSeedPhraseWordCountForWords,
  type SeedPhraseWordCount,
} from '../../constants/mnemonic';

interface ImportWalletScreenProps {
  importSeedPhrase: string[];
  importWalletProfile?: WalletImportProfile;
  setImportSeedPhrase: (phrase: string[]) => void;
  setImportWalletProfile?: (profile: WalletImportProfile) => void;
  seedInputRefs: React.MutableRefObject<(TextInput | null)[]>;
  isImporting: boolean;
  keyboardHeight: number;
  onImport: () => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  importButtonLabel?: string;
  cancelButtonLabel?: string;
  warningText?: string;
}

const isSmallScreen = layout.screen.width <= 375;

export default function ImportWalletScreen({
  importSeedPhrase,
  importWalletProfile = 'xverse',
  setImportSeedPhrase,
  setImportWalletProfile,
  seedInputRefs,
  isImporting,
  onImport,
  onCancel,
  title = 'Import Wallet',
  subtitle = 'Enter your 12 or 24-word recovery phrase',
  importButtonLabel = 'Import Wallet',
  cancelButtonLabel = 'Cancel',
  warningText,
}: ImportWalletScreenProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const wordCount = useMemo(
    () => getSeedPhraseWordCountForWords(importSeedPhrase),
    [importSeedPhrase]
  );

  const filledCount = useMemo(() => {
    return importSeedPhrase.filter((word) => word.trim().length > 0).length;
  }, [importSeedPhrase]);

  const isComplete = filledCount === wordCount;

  const resizeSeedPhrase = useCallback(
    (nextWordCount: SeedPhraseWordCount) => {
      const nextPhrase = createEmptySeedPhrase(nextWordCount);
      importSeedPhrase.slice(0, nextWordCount).forEach((word, index) => {
        nextPhrase[index] = word;
      });
      setImportSeedPhrase(nextPhrase);
      setFocusedIndex((currentIndex) =>
        currentIndex !== null && currentIndex >= nextWordCount ? null : currentIndex
      );
    },
    [importSeedPhrase, setImportSeedPhrase]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;

      const words = text
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .slice(0, MAX_SEED_PHRASE_WORD_COUNT);

      if (words.length > 0) {
        const nextWordCount = getSeedPhraseWordCountForPaste(words.length);
        const newPhrase = createEmptySeedPhrase(nextWordCount);
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
      logger.debug('[ImportWalletScreen] Clipboard access failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [setImportSeedPhrase]);

  const handleClear = useCallback(() => {
    setImportSeedPhrase(createEmptySeedPhrase(wordCount));
    seedInputRefs.current[0]?.focus();
  }, [setImportSeedPhrase, seedInputRefs, wordCount]);

  const handleTextChange = useCallback(
    (text: string, index: number) => {
      if (text.includes(' ')) {
        const words = text
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const nextWordCount =
          index + words.length > wordCount
            ? getSeedPhraseWordCountForPaste(index + words.length)
            : wordCount;
        const newPhrase = createEmptySeedPhrase(nextWordCount);
        importSeedPhrase.slice(0, nextWordCount).forEach((word, wordIndex) => {
          newPhrase[wordIndex] = word;
        });

        words.forEach((pastedWord: string, i: number) => {
          if (index + i < nextWordCount) {
            newPhrase[index + i] = pastedWord.trim();
          }
        });

        setImportSeedPhrase(newPhrase);
        const nextIndex = Math.min(index + words.length, nextWordCount - 1);
        setTimeout(() => seedInputRefs.current[nextIndex]?.focus(), 50);
      } else {
        const newPhrase = [...importSeedPhrase];
        newPhrase[index] = text.toLowerCase().replace(/\s/g, '');
        setImportSeedPhrase(newPhrase);
      }
    },
    [importSeedPhrase, setImportSeedPhrase, seedInputRefs, wordCount]
  );

  const handleSubmitEditing = useCallback(
    (index: number) => {
      if (index < wordCount - 1) {
        seedInputRefs.current[index + 1]?.focus();
      } else if (isComplete && !isImporting) {
        // On the final word, trigger import if form is complete
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
    [seedInputRefs, isComplete, isImporting, onImport, importSeedPhrase, wordCount]
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
              returnKeyType={index < wordCount - 1 ? 'next' : 'done'}
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
      wordCount,
      seedInputRefs,
      handleTextChange,
      handleFocus,
      handleBlur,
      handleSubmitEditing,
    ]
  );

  const rows = useMemo(() => {
    const result: number[][] = [];
    for (let i = 0; i < wordCount; i += 2) {
      result.push([i, i + 1]);
    }
    return result;
  }, [wordCount]);

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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {warningText ? <Text style={styles.warningText}>{warningText}</Text> : null}
        </View>

        {setImportWalletProfile ? (
          <View style={styles.profileBlock}>
            <Text style={styles.profileLabel}>Wallet source</Text>
            <View style={styles.profileSelector}>
              {WALLET_IMPORT_PROFILE_OPTIONS.map((profile) => {
                const isSelected = importWalletProfile === profile.id;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityLabel={`Import ${profile.label} seed phrase`}
                    accessibilityRole="button"
                    key={profile.id}
                    onPress={() => setImportWalletProfile(profile.id)}
                    style={[styles.profileOption, isSelected && styles.profileOptionSelected]}
                    testID={`import-wallet-profile-${profile.id}`}
                  >
                    <Text
                      style={[
                        styles.profileOptionText,
                        isSelected && styles.profileOptionTextSelected,
                      ]}
                    >
                      {profile.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.profileDescription}>
              {WALLET_IMPORT_PROFILE_OPTIONS.find((profile) => profile.id === importWalletProfile)
                ?.description ?? 'Choose the wallet app this seed phrase came from.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.wordCountBlock}>
          <Text style={styles.wordCountLabel}>Recovery phrase length</Text>
          <View style={styles.wordCountSelector}>
            {SUPPORTED_SEED_PHRASE_WORD_COUNTS.map((count) => {
              const isSelected = wordCount === count;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityLabel={`Use ${count} recovery words`}
                  accessibilityRole="button"
                  key={count}
                  onPress={() => resizeSeedPhrase(count)}
                  style={[styles.wordCountOption, isSelected && styles.wordCountOptionSelected]}
                  testID={`import-word-count-${count}`}
                >
                  <Text
                    style={[
                      styles.wordCountOptionText,
                      isSelected && styles.wordCountOptionTextSelected,
                    ]}
                  >
                    {count} words
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Progress row with paste/clear button */}
        <View style={styles.progressRow}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(filledCount / wordCount) * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {filledCount}/{wordCount}
            </Text>
          </View>

          {filledCount === 0 ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePaste}
              activeOpacity={0.7}
              testID="import-paste-btn"
            >
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
          style={[styles.importButton, (!isComplete || isImporting) && styles.buttonDisabled]}
          onPress={onImport}
          disabled={!isComplete || isImporting}
          activeOpacity={0.8}
          testID="import-wallet-btn"
        >
          <Text
            style={[
              styles.importButtonText,
              (!isComplete || isImporting) && styles.buttonTextDisabled,
            ]}
          >
            {isImporting ? 'Importing...' : importButtonLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>{cancelButtonLabel}</Text>
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
  warningText: {
    marginTop: 10,
    color: colors.semantic.error,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    textAlign: 'center',
  },
  profileBlock: {
    gap: 8,
    marginBottom: isSmallScreen ? 14 : 18,
  },
  profileLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  profileSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  profileOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    backgroundColor: colors.bg.secondary,
  },
  profileOptionSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.tertiary,
  },
  profileOptionText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  profileOptionTextSelected: {
    color: colors.text.primary,
  },
  profileDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  wordCountBlock: {
    gap: 8,
    marginBottom: isSmallScreen ? 14 : 18,
  },
  wordCountLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  wordCountSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  wordCountOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    backgroundColor: colors.bg.secondary,
  },
  wordCountOptionSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.tertiary,
  },
  wordCountOptionText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  wordCountOptionTextSelected: {
    color: colors.text.primary,
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
