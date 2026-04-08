/**
 * Remote Config Store (Zustand)
 * Runtime state for remote configuration + user overrides.
 * Persists dismissed announcements and network preferences via AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_REMOTE_CONFIG,
  fetchRemoteConfig,
  loadCachedConfig,
} from '../services/remoteConfigService';
import { logger } from '../utils/logger';
import { APP_NETWORK_CONFIG } from '../utils/networkConfig';
import type { RemoteConfig, AppNetworkId } from '../types/remoteConfig';

// ============================================================
// Storage Keys
// ============================================================

const DISMISSED_ANN_KEY = '@ducat/dismissed_announcements';
const USER_NETWORK_KEY = '@ducat/user_network_override';
const INIT_TIMEOUT_MS = 3000;

// ============================================================
// Types
// ============================================================

interface RemoteConfigState {
  config: RemoteConfig;
  isLoading: boolean;
  lastFetchedAt: number | null;
  error: string | null;
  userNetworkOverride: AppNetworkId | null;
  dismissedAnnouncementIds: string[];
  pendingNetworkChange: boolean;
}

interface RemoteConfigActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  dismissAnnouncement: (id: string) => void;
  setUserNetworkOverride: (networkId: AppNetworkId | null) => void;
  resetOverrides: () => void;
  shouldShowAnnouncement: () => boolean;
}

type RemoteConfigStore = RemoteConfigState & RemoteConfigActions;

// ============================================================
// Initial State
// ============================================================

const initialState: RemoteConfigState = {
  config: DEFAULT_REMOTE_CONFIG,
  isLoading: false,
  lastFetchedAt: null,
  error: null,
  userNetworkOverride: null,
  dismissedAnnouncementIds: [],
  pendingNetworkChange: false,
};

// ============================================================
// Store
// ============================================================

export const useRemoteConfigStore = create<RemoteConfigStore>((set, get) => ({
  ...initialState,

  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load user overrides from storage
      const [dismissedRaw, networkOverride] = await Promise.all([
        AsyncStorage.getItem(DISMISSED_ANN_KEY),
        AsyncStorage.getItem(USER_NETWORK_KEY),
      ]);

      const dismissedAnnouncementIds = dismissedRaw
        ? (JSON.parse(dismissedRaw) as string[])
        : [];
      const userNetworkOverride = networkOverride as AppNetworkId | null;

      // Load cached config immediately (instant)
      const cached = await loadCachedConfig();
      set({
        config: cached,
        dismissedAnnouncementIds,
        userNetworkOverride,
      });

      // Background fetch with timeout
      const fetchPromise = fetchRemoteConfig();
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), INIT_TIMEOUT_MS),
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (result) {
        set({ config: result, lastFetchedAt: Date.now() });

        // Check for network change
        const currentNetworkId = result.network.id;
        if (currentNetworkId !== APP_NETWORK_CONFIG.id && !userNetworkOverride) {
          set({ pendingNetworkChange: true });
        }
      }

      logger.debug('[RemoteConfig] Initialized', {
        version: get().config.version,
        networkOverride: userNetworkOverride,
        dismissedCount: dismissedAnnouncementIds.length,
      });
    } catch (err: unknown) {
      logger.warn('[RemoteConfig] Initialize failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      set({ error: err instanceof Error ? err.message : 'Init failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await fetchRemoteConfig();
      set({ config, lastFetchedAt: Date.now() });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Refresh failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  dismissAnnouncement: (id: string) => {
    const current = get().dismissedAnnouncementIds;
    if (current.includes(id)) return;
    const updated = [...current, id];
    set({ dismissedAnnouncementIds: updated });
    void AsyncStorage.setItem(DISMISSED_ANN_KEY, JSON.stringify(updated));
  },

  setUserNetworkOverride: (networkId: AppNetworkId | null) => {
    set({ userNetworkOverride: networkId, pendingNetworkChange: networkId !== null });
    if (networkId) {
      void AsyncStorage.setItem(USER_NETWORK_KEY, networkId);
    } else {
      void AsyncStorage.removeItem(USER_NETWORK_KEY);
    }
  },

  resetOverrides: () => {
    set({
      userNetworkOverride: null,
      dismissedAnnouncementIds: [],
      pendingNetworkChange: false,
    });
    void AsyncStorage.multiRemove([DISMISSED_ANN_KEY, USER_NETWORK_KEY]);
  },

  shouldShowAnnouncement: () => {
    const { config, dismissedAnnouncementIds } = get();
    const ann = config.announcement;
    if (!ann.enabled || !ann.id || !ann.title) return false;
    if (ann.showMode === 'once' && dismissedAnnouncementIds.includes(ann.id)) return false;
    return true;
  },
}));

// ============================================================
// Selectors
// ============================================================

export const useRemoteConfig = () => useRemoteConfigStore((s) => s.config);
export const useBannerConfig = () => useRemoteConfigStore((s) => s.config.banner);
export const useAnnouncementConfig = () => useRemoteConfigStore((s) => s.config.announcement);
export const usePendingNetworkChange = () => useRemoteConfigStore((s) => s.pendingNetworkChange);

// Reset (for testing)
export const resetRemoteConfigStore = (): void => {
  useRemoteConfigStore.setState(initialState);
};
