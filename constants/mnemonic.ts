export const DEFAULT_SEED_PHRASE_WORD_COUNT = 12;
export const SUPPORTED_SEED_PHRASE_WORD_COUNTS = [12, 24] as const;
export const MAX_SEED_PHRASE_WORD_COUNT = 24;

export type SeedPhraseWordCount = (typeof SUPPORTED_SEED_PHRASE_WORD_COUNTS)[number];

export function createEmptySeedPhrase(
  wordCount: SeedPhraseWordCount = DEFAULT_SEED_PHRASE_WORD_COUNT
): string[] {
  return Array(wordCount).fill('');
}

export function getSupportedSeedPhraseWordCount(wordCount: number): SeedPhraseWordCount {
  return SUPPORTED_SEED_PHRASE_WORD_COUNTS.includes(wordCount as SeedPhraseWordCount)
    ? (wordCount as SeedPhraseWordCount)
    : DEFAULT_SEED_PHRASE_WORD_COUNT;
}

export function getSeedPhraseWordCountForWords(words: string[]): SeedPhraseWordCount {
  return getSupportedSeedPhraseWordCount(words.length);
}

export function getSeedPhraseWordCountForPaste(wordCount: number): SeedPhraseWordCount {
  return wordCount > DEFAULT_SEED_PHRASE_WORD_COUNT
    ? MAX_SEED_PHRASE_WORD_COUNT
    : DEFAULT_SEED_PHRASE_WORD_COUNT;
}
