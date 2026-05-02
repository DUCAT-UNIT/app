/**
 * SeedPhraseContext - Manages seed phrase viewing, visibility, and gestures
 *
 * @jest-coverage-ignore - Requires React Native Animated and PanResponder mocking
 * which are not easily testable in Jest without extensive native module mocks.
 * Should be tested via E2E tests.
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect, ReactNode, MutableRefObject } from 'react';
import { Animated, Dimensions, PanResponder, GestureResponderHandlers, AppState } from 'react-native';
import { withMnemonic } from '../services/secureStorageService';
import { authenticateWithBiometrics } from '../services/biometricService';
import { setBoolean, SettingKeys } from '../services/settingsService';
import { ERRORS } from '../utils/messages';
import { useAuthSession } from './AuthContext';
import { notify } from '../utils/notify';

interface SeedPhraseContextValue {
  viewingSeedPhrase: boolean;
  seedPhraseWords: string[];
  seedPhraseVisible: boolean;
  requestingSeedPhrase: boolean;
  returnToSettings: boolean;
  seedPhraseTranslateX: Animated.Value;
  seedPhrasePanResponderRef: MutableRefObject<{ panHandlers: GestureResponderHandlers } | null>;
  requestViewSeedPhrase: () => Promise<void>;
  loadSeedPhrase: () => Promise<void>;
  closeSeedPhrase: () => Promise<void>;
  setSeedPhraseVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setRequestingSeedPhrase: React.Dispatch<React.SetStateAction<boolean>>;
  setReturnToSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

const SeedPhraseContext = createContext<SeedPhraseContextValue | undefined>(undefined);

export const useSeedPhrase = (): SeedPhraseContextValue => {
  const context = useContext(SeedPhraseContext);
  if (!context) {
    throw new Error('useSeedPhrase must be used within a SeedPhraseProvider');
  }
  return context;
};

interface SeedPhraseProviderProps {
  children: ReactNode;
  setIsAuthenticated?: (value: boolean) => void;
}

export const SeedPhraseProvider: React.FC<SeedPhraseProviderProps> = ({ children, setIsAuthenticated }) => {
  const { biometricEnabled } = useAuthSession();
  const [viewingSeedPhrase, setViewingSeedPhrase] = useState(false);
  const [seedPhraseWords, setSeedPhraseWords] = useState<string[]>([]);
  const [seedPhraseVisible, setSeedPhraseVisible] = useState(false);
  const [requestingSeedPhrase, setRequestingSeedPhrase] = useState(false);
  const [returnToSettings, setReturnToSettings] = useState(false);

  const seedPhraseTranslateX = useRef(new Animated.Value(0)).current;

  const SCREEN_WIDTH = Dimensions.get('window').width;

  // Create pan responder for swipe gesture — initialized once via useRef
  const seedPhrasePanResponderRef = useRef<{ panHandlers: GestureResponderHandlers } | null>(PanResponder.create({
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
  }));

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
          notify.error(ERRORS.SEED_PHRASE_NOT_FOUND);
        }
      });
    } catch (error: unknown) {
      notify.error(error instanceof Error ? error.message : String(error));
    }
  }, [seedPhraseTranslateX]);

  // Request seed phrase viewing (will try Face ID first if enabled, then PIN)
  const requestViewSeedPhrase = useCallback(async () => {
    setRequestingSeedPhrase(true);
    setReturnToSettings(true); // Mark that we should return to settings after viewing

    // Persist the flag so it survives wallet lock/unlock
    await setBoolean(SettingKeys.RETURN_TO_SETTINGS_AFTER_SEED_PHRASE, true);

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
      } catch (error: unknown) {
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
  const closeSeedPhrase = useCallback(async () => {
    setViewingSeedPhrase(false);
    setSeedPhraseWords([]);
    setSeedPhraseVisible(false);
    setRequestingSeedPhrase(false);
    // Keep returnToSettings flag so useSettingsNavigation can re-open settings
    // The flag will be cleared by useSettingsNavigation after re-opening settings
  }, []);

  // SECURITY: Auto-clear seed phrase from memory after 30 seconds
  useEffect(() => {
    if (seedPhraseWords.length === 0) return;

    const timer = setTimeout(() => {
      setSeedPhraseWords([]);
      setSeedPhraseVisible(false);
      setViewingSeedPhrase(false);
    }, 30_000);

    return () => clearTimeout(timer);
  }, [seedPhraseWords]);

  // SECURITY: Clear seed phrase when app goes to background
  useEffect(() => {
    if (seedPhraseWords.length === 0) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        setSeedPhraseWords([]);
        setSeedPhraseVisible(false);
        setViewingSeedPhrase(false);
      }
    });

    return () => subscription.remove();
  }, [seedPhraseWords]);

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
