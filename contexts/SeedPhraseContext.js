/**
 * SeedPhraseContext - Manages seed phrase viewing, visibility, and gestures
 *
 * @jest-coverage-ignore - Requires React Native Animated and PanResponder mocking
 * which are not easily testable in Jest without extensive native module mocks.
 * Should be tested via E2E tests.
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { withMnemonic } from '../services/secureStorageService';
import { authenticateWithBiometrics } from '../services/biometricService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { useAuth } from './AuthContext';

const SeedPhraseContext = createContext();

export const useSeedPhrase = () => {
  const context = useContext(SeedPhraseContext);
  if (!context) {
    throw new Error('useSeedPhrase must be used within a SeedPhraseProvider');
  }
  return context;
};

export const SeedPhraseProvider = ({ children, showToast, setIsAuthenticated }) => {
  const { biometricEnabled } = useAuth();
  const [viewingSeedPhrase, setViewingSeedPhrase] = useState(false);
  const [seedPhraseWords, setSeedPhraseWords] = useState([]);
  const [seedPhraseVisible, setSeedPhraseVisible] = useState(false);
  const [requestingSeedPhrase, setRequestingSeedPhrase] = useState(false);
  const [returnToSettings, setReturnToSettings] = useState(false);

  const seedPhraseTranslateX = useRef(new Animated.Value(0)).current;
  const seedPhrasePanResponderRef = useRef(null);

  const SCREEN_WIDTH = Dimensions.get('window').width;

  // Create pan responder for swipe gesture
  if (!seedPhrasePanResponderRef.current) {
    seedPhrasePanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipeRight =
          gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          seedPhraseTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          Animated.timing(seedPhraseTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setViewingSeedPhrase(false);
            setSeedPhraseWords([]);
            setSeedPhraseVisible(false);
          });
        } else {
          Animated.spring(seedPhraseTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  // Load and display seed phrase (called after PIN authentication)
  const loadSeedPhrase = useCallback(async () => {
    setRequestingSeedPhrase(false);
    try {
      // Use withMnemonic for secure access
      await withMnemonic(async (mnemonic) => {
        if (mnemonic) {
          // Store words in state for display (intentional - user is viewing seed)
          setSeedPhraseWords(mnemonic.split(' '));
          setSeedPhraseVisible(false);
          seedPhraseTranslateX.setValue(0);
          setViewingSeedPhrase(true);
        } else {
          showToast(ERRORS.SEED_PHRASE_NOT_FOUND, 'error');
        }
      });
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
    }
  }, [seedPhraseTranslateX, showToast]);

  // Request seed phrase viewing (will try Face ID first if enabled, then PIN)
  const requestViewSeedPhrase = useCallback(async () => {
    setRequestingSeedPhrase(true);
    setReturnToSettings(true); // Mark that we should return to settings after viewing

    // Persist the flag so it survives wallet lock/unlock
    await SecureStore.setItemAsync('returnToSettingsAfterSeedPhrase', 'true');

    // Only try biometric authentication if it's enabled in settings
    if (biometricEnabled) {
      try {
        const result = await authenticateWithBiometrics(
          'Authenticate to view recovery phrase',
          'Use PIN'
        );

        if (result.success) {
          // Authentication successful, show seed phrase
          await loadSeedPhrase();
          return;
        }
      } catch (error) {
        // Biometric failed, will fall back to PIN below
      }
    }

    // Biometric disabled, failed, or not available - fall back to PIN
    // Lock the wallet to trigger PIN entry
    if (setIsAuthenticated) {
      setIsAuthenticated(false);
    }
  }, [biometricEnabled, setIsAuthenticated, loadSeedPhrase]);

  // Close seed phrase view
  const closeSeedPhrase = useCallback(() => {
    setViewingSeedPhrase(false);
    setSeedPhraseWords([]);
    setSeedPhraseVisible(false);
    // Don't reset returnToSettings here - let WalletPage handle it
  }, []);

  const value = useMemo(
    () => ({
      viewingSeedPhrase,
      seedPhraseWords,
      seedPhraseVisible,
      requestingSeedPhrase,
      returnToSettings,
      seedPhraseTranslateX,
      seedPhrasePanResponderRef,
      requestViewSeedPhrase,
      loadSeedPhrase,
      closeSeedPhrase,
      setSeedPhraseVisible,
      setRequestingSeedPhrase,
      setReturnToSettings,
    }),
    [
      viewingSeedPhrase,
      seedPhraseWords,
      seedPhraseVisible,
      requestingSeedPhrase,
      returnToSettings,
      seedPhraseTranslateX,
      requestViewSeedPhrase,
      loadSeedPhrase,
      closeSeedPhrase,
    ]
  );

  return <SeedPhraseContext.Provider value={value}>{children}</SeedPhraseContext.Provider>;
};
