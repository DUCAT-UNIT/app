/**
 * usePersistedState Hook
 * React hook for state that persists to AsyncStorage
 * Automatically loads on mount and saves on every change
 */

import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

type PersistedStateOperation = 'load' | 'save' | 'clear';

interface PersistedStateOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  onLoad?: (state: T) => void;
  onSave?: (state: T) => void;
  onError?: (error: unknown, operation: PersistedStateOperation) => void;
  silent?: boolean;
}

/**
 * Hook that persists state to AsyncStorage
 */
export function usePersistedState<T>(
  key: string,
  initialState: T,
  options: PersistedStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, () => Promise<void>, boolean] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    onLoad,
    onSave,
    onError,
    silent = false,
  } = options;

  const [state, setStateInternal] = useState<T>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Load persisted state on mount
  useEffect(() => {
    isMountedRef.current = true;

    const loadState = async (): Promise<void> => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      try {
        const savedValue = await AsyncStorage.getItem(key);

        if (savedValue !== null && isMountedRef.current) {
          const deserialized = deserializer(savedValue) as T;
          // Merge with initial state to fill in missing fields with defaults
          // Only override default values with non-null/undefined values from persisted state
          let mergedState: T = deserialized;
          if (typeof initialState === 'object' && initialState !== null && !Array.isArray(initialState) && typeof deserialized === 'object' && deserialized !== null && !Array.isArray(deserialized)) {
            mergedState = { ...initialState } as T;
            const deserializedObj = deserialized as Record<string, unknown>;
            const mergedObj = mergedState as Record<string, unknown>;
            for (const propKey in deserializedObj) {
              if (deserializedObj[propKey] !== null && deserializedObj[propKey] !== undefined) {
                mergedObj[propKey] = deserializedObj[propKey];
              }
            }
          }
          setStateInternal(mergedState);

          if (onLoad) {
            onLoad(mergedState);
          }
        }
      } catch (error: unknown) {
        if (!silent) {
          logger.error(`usePersistedState: Error loading state for key "${key}":`, { error: error instanceof Error ? error.message : String(error) });
        }

        if (onError) {
          onError(error, 'load');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoaded(true);
          isLoadingRef.current = false;
        }
      }
    };

    loadState();

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only run on mount and key change - intentionally omitting deserializer, initialState, onError, onLoad, silent

  // Save state whenever it changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load completes

    const saveState = async (): Promise<void> => {
      try {
        const serialized = serializer(state);
        await AsyncStorage.setItem(key, serialized);

        if (onSave) {
          onSave(state);
        }
      } catch (error: unknown) {
        if (!silent) {
          logger.error(`usePersistedState: Error saving state for key "${key}":`, { error: error instanceof Error ? error.message : String(error) });
        }

        if (onError) {
          onError(error, 'save');
        }
      }
    };

    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isLoaded, key]); // Save when state changes - intentionally omitting onError, onSave, serializer, silent

  /**
   * Clear persisted state from AsyncStorage and reset to initial
   */
  const clearState = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
      setStateInternal(initialState);

      if (onSave) {
        onSave(initialState);
      }
    } catch (error: unknown) {
      if (!silent) {
        logger.error(`usePersistedState: Error clearing state for key "${key}":`, { error: error instanceof Error ? error.message : String(error) });
      }

      if (onError) {
        onError(error, 'clear');
      }
    }
  }, [key, initialState, onSave, onError, silent]);

  return [state, setStateInternal, clearState, isLoaded];
}

/**
 * Hook for persisting multiple related state values as an object
 */
export function usePersistedObject<T extends Record<string, unknown>>(
  key: string,
  initialState: T = {} as T,
  options: PersistedStateOptions<T> = {}
): [T, (updates: Partial<T> | ((prev: T) => T)) => void, () => Promise<void>, boolean] {
  const [state, setState, clearState, isLoaded] = usePersistedState<T>(key, initialState, options);

  /**
   * Update specific fields in the state object
   * Similar to setState in class components - merges partial updates
   */
  const updateState = useCallback(
    (updates: Partial<T> | ((prev: T) => T)): void => {
      if (typeof updates === 'function') {
        // Support functional updates: updateState(prev => ({ ...prev, field: value }))
        setState((prev) => updates(prev));
      } else {
        // Support object merge: updateState({ field: value })
        setState((prev) => ({ ...prev, ...updates }));
      }
    },
    [setState]
  );

  return [state, updateState, clearState, isLoaded];
}

interface PersistedArrayHelpers<T> {
  push: (item: T) => void;
  remove: (predicate: (item: T) => boolean) => void;
  update: (predicate: (item: T) => boolean, updates: Partial<T>) => void;
  replace: (newItems: T[]) => void;
}

/**
 * Hook for persisting an array with helper methods
 */
export function usePersistedArray<T>(
  key: string,
  initialState: T[] = [],
  options: PersistedStateOptions<T[]> = {}
): [T[], PersistedArrayHelpers<T>, () => Promise<void>, boolean] {
  const [items, setItems, clearState, isLoaded] = usePersistedState<T[]>(key, initialState, options);

  const helpers: PersistedArrayHelpers<T> = {
    push: useCallback(
      (item: T): void => {
        setItems((prev) => [...prev, item]);
      },
      [setItems]
    ),

    remove: useCallback(
      (predicate: (item: T) => boolean): void => {
        setItems((prev) => prev.filter((item) => !predicate(item)));
      },
      [setItems]
    ),

    update: useCallback(
      (predicate: (item: T) => boolean, updates: Partial<T>): void => {
        setItems((prev) =>
          prev.map((item) => (predicate(item) ? { ...item, ...updates } : item))
        );
      },
      [setItems]
    ),

    replace: useCallback(
      (newItems: T[]): void => {
        setItems(newItems);
      },
      [setItems]
    ),
  };

  return [items, helpers, clearState, isLoaded];
}
