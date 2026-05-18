import {
  createEmptySeedPhrase,
  getSeedPhraseWordCountForPaste,
  getSeedPhraseWordCountForWords,
} from '../mnemonic';

describe('mnemonic constants', () => {
  it('creates a 12-word empty phrase by default', () => {
    expect(createEmptySeedPhrase()).toEqual(Array(12).fill(''));
  });

  it('supports 24-word empty phrases', () => {
    expect(createEmptySeedPhrase(24)).toEqual(Array(24).fill(''));
  });

  it('resolves supported word counts from phrase arrays', () => {
    expect(getSeedPhraseWordCountForWords(Array(12).fill('word'))).toBe(12);
    expect(getSeedPhraseWordCountForWords(Array(24).fill('word'))).toBe(24);
  });

  it('expands pasted phrases longer than 12 words to 24 words', () => {
    expect(getSeedPhraseWordCountForPaste(12)).toBe(12);
    expect(getSeedPhraseWordCountForPaste(24)).toBe(24);
  });
});
