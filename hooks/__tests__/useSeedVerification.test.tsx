// @ts-nocheck
/**
 * Tests for useSeedVerification Hook
 * Validates seed phrase verification for new wallets
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSeedVerification } from '../useSeedVerification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ERRORS } from '../../utils/messages';
import { notify } from '../../utils/notify';

// Mock messages
jest.mock('../../utils/messages', () => ({
  ERRORS: {
    SEED_PHRASE_INCOMPLETE: 'Please select all verification words',
    SEED_PHRASE_INCORRECT: 'Incorrect seed phrase',
  },
}));

// Helper to render hooks with props
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useSeedVerification', () => {
  let mockProps;
  const mockMnemonic = [
    'abandon',
    'ability',
    'able',
    'about',
    'above',
    'absent',
    'absorb',
    'abstract',
    'absurd',
    'abuse',
    'access',
    'accident',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    AsyncStorage.removeItem.mockResolvedValue();

    mockProps = {
      tempMnemonicWords: mockMnemonic,
      setSettingUpPin: jest.fn(),
      setShowingSeeds: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should start with verifying seeds false', async () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.verifyingSeeds).toBe(false);
    });

    it('should load persisted state on mount', async () => {
      const savedState = {
        verifyingSeeds: true,
        verificationWords: { 0: 'abandon' },
        requiredIndices: [0, 3, 6],
        wordChoices: { 0: ['abandon', 'ability', 'able', 'about'] },
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.verifyingSeeds).toBe(true);
      expect(result.current.verificationWords).toEqual({ 0: 'abandon' });
      expect(result.current.requiredIndices).toEqual([0, 3, 6]);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.verifyingSeeds).toBe(false);
    });
  });

  describe('Proceed to Verification', () => {
    it('should select 3 random indices', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      expect(result.current.requiredIndices).toHaveLength(3);
    });

    it('should generate choices for each selected word', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      expect(Object.keys(result.current.wordChoices)).toHaveLength(3);

      indices.forEach((index) => {
        expect(result.current.wordChoices[index]).toHaveLength(4);
        expect(result.current.wordChoices[index]).toContain(mockMnemonic[index]);
      });
    });

    it('should set verifying seeds true', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      expect(result.current.verifyingSeeds).toBe(true);
    });

    it('should hide showing seeds screen', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      expect(mockProps.setShowingSeeds).toHaveBeenCalledWith(false);
    });

    it('should reset verification words', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      // Set some words first
      act(() => {
        result.current.setVerificationWords({ 0: 'test' });
      });

      act(() => {
        result.current.proceedToVerification();
      });

      expect(result.current.verificationWords).toEqual({});
    });

    it('should select unique indices', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const uniqueIndices = [...new Set(indices)];
      expect(uniqueIndices.length).toBe(3);
    });

    it('should sort indices in ascending order', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const sortedIndices = [...indices].sort((a, b) => a - b);
      expect(indices).toEqual(sortedIndices);
    });
  });

  describe('Verify Seeds', () => {
    it('should show error if words are incomplete', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(notify.seed.incomplete).toHaveBeenCalled();
    });

    it('should proceed to PIN setup if all words are correct', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const correctWords = {};
      indices.forEach((index) => {
        correctWords[index] = mockMnemonic[index];
      });

      act(() => {
        result.current.setVerificationWords(correctWords);
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
      expect(result.current.verifyingSeeds).toBe(false);
    });

    it('should show error if any word is incorrect', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const incorrectWords = {};
      indices.forEach((index, i) => {
        incorrectWords[index] = i === 0 ? 'wrong' : mockMnemonic[index];
      });

      act(() => {
        result.current.setVerificationWords(incorrectWords);
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(notify.seed.incorrect).toHaveBeenCalled();
      expect(mockProps.setSettingUpPin).not.toHaveBeenCalled();
    });

    it('should clear verification words on incorrect verification', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const incorrectWords = {};
      indices.forEach((index) => {
        incorrectWords[index] = 'wrong';
      });

      act(() => {
        result.current.setVerificationWords(incorrectWords);
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(result.current.verificationWords).toEqual({});
    });

    it('should handle case-insensitive word comparison', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const mixedCaseWords = {};
      indices.forEach((index) => {
        mixedCaseWords[index] = mockMnemonic[index].toUpperCase();
      });

      act(() => {
        result.current.setVerificationWords(mixedCaseWords);
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
    });

    it('should handle words with extra whitespace', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const wordsWithSpaces = {};
      indices.forEach((index) => {
        wordsWithSpaces[index] = `  ${mockMnemonic[index]}  `;
      });

      act(() => {
        result.current.setVerificationWords(wordsWithSpaces);
      });

      act(() => {
        result.current.verifySeeds();
      });

      expect(mockProps.setSettingUpPin).toHaveBeenCalledWith(true);
    });

    it('should clear persisted state on successful verification', async () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      const correctWords = {};
      indices.forEach((index) => {
        correctWords[index] = mockMnemonic[index];
      });

      act(() => {
        result.current.setVerificationWords(correctWords);
      });

      await act(async () => {
        result.current.verifySeeds();
        await Promise.resolve();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('seed_verification_state');
    });
  });

  describe('Reset Verification State', () => {
    it('should reset all verification state', async () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      await act(async () => {
        await result.current.resetVerificationState();
      });

      expect(result.current.verifyingSeeds).toBe(false);
      expect(result.current.verificationWords).toEqual({});
      expect(result.current.requiredIndices).toEqual([]);
      expect(result.current.wordChoices).toEqual({});
    });

    it('should clear persisted state', async () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.resetVerificationState();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('seed_verification_state');
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes to AsyncStorage', async () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.proceedToVerification();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'seed_verification_state',
        expect.any(String)
      );
    });

  });

  describe('Choice Generation', () => {
    it('should generate 4 choices including correct word', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      indices.forEach((index) => {
        const choices = result.current.wordChoices[index];
        expect(choices).toHaveLength(4);
        expect(choices).toContain(mockMnemonic[index]);
      });
    });

    it('should generate unique choices (no duplicates)', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      const indices = result.current.requiredIndices;
      indices.forEach((index) => {
        const choices = result.current.wordChoices[index];
        const uniqueChoices = [...new Set(choices)];
        expect(uniqueChoices.length).toBe(4);
      });
    });
  });

  describe('State persistence branches', () => {
    it('should load saved state with all properties when they exist', async () => {
      const savedState = {
        verifyingSeeds: true,
        verificationWords: { 0: 'word1', 1: 'word2' },
        requiredIndices: [0, 1, 2],
        wordChoices: { 0: ['a', 'b', 'c', 'd'] },
      };

      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Lines 38-41 branches - should load all saved properties
      expect(result.current.verifyingSeeds).toBe(true);
      expect(result.current.verificationWords).toEqual(savedState.verificationWords);
      expect(result.current.requiredIndices).toEqual(savedState.requiredIndices);
      expect(result.current.wordChoices).toEqual(savedState.wordChoices);
    });

    it('should handle verification with mismatched words', () => {
      const { result } = renderHook(() => useSeedVerification(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.proceedToVerification();
      });

      // Set incorrect verification words
      const indices = result.current.requiredIndices;
      const wrongWords = {};
      indices.forEach((index) => {
        wrongWords[index] = 'wrongword'; // Intentionally wrong
      });

      act(() => {
        result.current.setVerificationWords(wrongWords);
      });

      act(() => {
        result.current.verifySeeds();
      });

      // Lines 142-145 branches - allCorrect should be false due to mismatch
      expect(notify.seed.incorrect).toHaveBeenCalled();
      expect(result.current.verificationWords).toEqual({});
    });
  });
});
