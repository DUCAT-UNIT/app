import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode, MutableRefObject } from 'react';
import { Audio } from 'expo-av';
import { useBalance } from './WalletDataContext';
import { useWallet } from './WalletContext';
import { useAuthSession } from './AuthContext';
import { useAuthFlowHandlers } from './NavigationHandlersContext';
import * as AirdropService from '../services/airdropService';
import { logger } from '../utils/logger';
import {
  configureAudioMode,
  preloadConfettiSound,
  playConfettiSound,
  unloadSound,
  triggerConfettiHaptics,
  clearHapticTimeouts,
} from '../utils/airdropCelebration';
import {
  getLockKey,
  getAirdropKey,
  getPendingKey,
  isLockActive,
  acquireLock,
  releaseLock,
  cleanupExpiredLock,
  isCooldownExpired,
  recordAirdropTime,
  storePendingAirdrop,
  getPendingAirdrop,
  clearPendingAirdrop,
} from '../utils/airdropLock';

interface AirdropContextValue {
  showAirdropModal: boolean;
  setShowAirdropModal: React.Dispatch<React.SetStateAction<boolean>>;
  airdropTxId: string;
  triggerCelebration: () => void;
  audioReady: boolean;
}

const AirdropContext = createContext<AirdropContextValue | undefined>(undefined);

export const useAirdrop = (): AirdropContextValue => {
  const context = useContext(AirdropContext);
  if (!context) {
    throw new Error('useAirdrop must be used within an AirdropProvider');
  }
  return context;
};

interface AirdropProviderProps {
  children: ReactNode;
  seedConfirmed?: boolean;
}

export const AirdropProvider: React.FC<AirdropProviderProps> = ({ children, seedConfirmed }) => {
  const { segwitBalance, taprootBalance } = useBalance();
  const { wallet, currentAccount } = useWallet();
  const { isAuthenticated } = useAuthSession();
  const { showBiometricSetupModal } = useAuthFlowHandlers();

  // Airdrop modal state
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropTxId, setAirdropTxId] = useState('');
  const [audioReady, setAudioReady] = useState(false);

  // Track pending airdrop txId to show modal after biometric modal is dismissed
  const pendingAirdropTxIdRef = useRef<string | null>(null);

  // Store biometric modal state in ref for use in async functions (avoids stale closures)
  const showBiometricSetupModalRef = useRef(showBiometricSetupModal);
  useEffect(() => {
    showBiometricSetupModalRef.current = showBiometricSetupModal;
  }, [showBiometricSetupModal]);

  // Track if airdrop is in progress using ref + lock mechanism
  // Using ref avoids infinite loops from state updates triggering effects
  const airdropInProgress = useRef(false);

  // Store balance values in refs so airdrop logic always reads fresh values
  const segwitBalanceRef = useRef(segwitBalance);
  const taprootBalanceRef = useRef(taprootBalance);

  // Sound effect ref
  const confettiSoundRef = useRef<Audio.Sound | null>(null);
  // Store haptic timeout IDs for cleanup
  const hapticTimeoutsRef: MutableRefObject<NodeJS.Timeout[]> = useRef([]);

  // Function to trigger all celebration effects
  const triggerCelebration = useCallback(() => {
    // Clear any existing haptic timeouts first
    clearHapticTimeouts(hapticTimeoutsRef.current);
    hapticTimeoutsRef.current = [];

    // Play confetti sound effect
    playConfettiSound(confettiSoundRef.current);

    // Trigger haptic feedback and store timeout IDs
    const newTimeouts = triggerConfettiHaptics();
    hapticTimeoutsRef.current = newTimeouts;
  }, []);

  // Load audio on mount and cleanup on unmount
  useEffect(() => {
    const initAudio = async () => {
      // Configure audio for playback
      await configureAudioMode();

      // Preload the confetti sound so it's ready immediately
      try {
        const sound = await preloadConfettiSound();
        confettiSoundRef.current = sound;
        setAudioReady(true);
      } catch (error: unknown) {
        logger.warn('Failed to preload confetti sound', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    initAudio();

    return () => {
      // Cleanup sound on unmount
      unloadSound(confettiSoundRef.current);
      confettiSoundRef.current = null;

      // Cleanup haptic timeouts
      clearHapticTimeouts(hapticTimeoutsRef.current);
      hapticTimeoutsRef.current = [];
    };
  }, []);

  // Update refs whenever balances change
  useEffect(() => {
    segwitBalanceRef.current = segwitBalance;
    taprootBalanceRef.current = taprootBalance;
  }, [segwitBalance, taprootBalance]);

  // Show pending airdrop modal when biometric modal is dismissed
  useEffect(() => {
    if (!showBiometricSetupModal && pendingAirdropTxIdRef.current) {
      setAirdropTxId(pendingAirdropTxIdRef.current);
      setShowAirdropModal(true);
      pendingAirdropTxIdRef.current = null;
    }
  }, [showBiometricSetupModal]);

  // Clean up expired airdrop locks on mount
  useEffect(() => {
    if (!wallet?.segwitAddress) return;
    let cancelled = false;

    const cleanup = async () => {
      try {
        const lockKey = getLockKey(wallet.segwitAddress, currentAccount);
        await cleanupExpiredLock(lockKey);
      } catch (error) {
        if (!cancelled) {
          logger.warn('[Airdrop] Failed to clean expired lock', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    cleanup();
    return () => { cancelled = true; };
  }, [wallet?.segwitAddress, currentAccount]);

  // Check for pending airdrop modal on mount and when balance updates
  useEffect(() => {
    if (!wallet?.segwitAddress) return;
    let cancelled = false;

    const checkPending = async () => {
      const pendingKey = getPendingKey(wallet.segwitAddress, currentAccount);
      const pendingTxId = await getPendingAirdrop(pendingKey);
      if (cancelled) return;

      // If there's a pending airdrop and balance is now > 0, show the modal
      if (pendingTxId && (segwitBalance > 0 || taprootBalance > 0)) {
        // Defer showing modal if biometric setup modal is visible
        if (showBiometricSetupModal) {
          pendingAirdropTxIdRef.current = pendingTxId;
        } else {
          setAirdropTxId(pendingTxId);
          setShowAirdropModal(true);
        }
        // Don't trigger effects here - wait for user to click "Get Started"
        // Clear the pending airdrop
        await clearPendingAirdrop(pendingKey);
      }
    };

    checkPending();
    return () => { cancelled = true; };
  }, [wallet, currentAccount, segwitBalance, taprootBalance, showBiometricSetupModal]);

  // Store wallet address in ref so the async closure always reads the fresh value
  // without needing the entire wallet object in the dependency array.
  const walletAddressRef = useRef(wallet?.segwitAddress);
  useEffect(() => {
    walletAddressRef.current = wallet?.segwitAddress;
  }, [wallet?.segwitAddress]);

  // Auto-request airdrop when BTC balance is 0 (check once per day)
  // Deps use wallet?.segwitAddress (a stable string) instead of the wallet object
  // to prevent the 24-hour interval from resetting on every wallet state change.
  useEffect(() => {
    const segwitAddress = wallet?.segwitAddress;
    if (!segwitAddress) {
      logger.debug('[Airdrop] Skipping: no wallet address');
      return;
    }
    if (!isAuthenticated) {
      logger.debug('[Airdrop] Skipping: not authenticated');
      return;
    }
    if (!seedConfirmed) {
      logger.debug('[Airdrop] Skipping: seed not confirmed');
      return;
    }

    let cancelled = false;

    logger.debug('[Airdrop] All conditions met, scheduling check in 3s', {
      address: segwitAddress.slice(0, 12) + '...',
      currentAccount,
    });

    const requestAirdropIfNeeded = async () => {
      // Skip if already in progress
      if (airdropInProgress.current) {
        logger.debug('[Airdrop] Skipping: already in progress');
        return;
      }

      // Read fresh address from ref in case it changed between interval ticks
      const address = walletAddressRef.current;
      if (!address) return;

      const airdropKey = getAirdropKey(address, currentAccount);
      const lockKey = getLockKey(address, currentAccount);
      const pendingKey = getPendingKey(address, currentAccount);

      try {
        // Check for existing lock (prevents race conditions across mounts)
        if (await isLockActive(lockKey)) {
          logger.debug('[Airdrop] Skipping: lock active');
          return;
        }
        if (cancelled) return;

        // Get current balance from refs (always fresh, not stale closure values)
        const totalBtcBalance = segwitBalanceRef.current + taprootBalanceRef.current;
        logger.debug('[Airdrop] Balance check', { totalBtcBalance, segwit: segwitBalanceRef.current, taproot: taprootBalanceRef.current });

        // If balance is 0, request airdrop
        if (totalBtcBalance === 0) {
          // Check if cooldown period has passed
          if (!(await isCooldownExpired(airdropKey))) {
            logger.debug('[Airdrop] Skipping: cooldown not expired');
            return;
          }
          if (cancelled) return;

          // Acquire lock BEFORE setting ref
          await acquireLock(lockKey);
          if (cancelled) return;
          airdropInProgress.current = true;

          try {
            // Store attempt time immediately to prevent duplicate requests (per account)
            await recordAirdropTime(airdropKey);
            if (cancelled) return;

            // Request airdrop
            logger.debug('[Airdrop] Requesting airdrop for', { address: address.slice(0, 12) + '...' });
            const result = await AirdropService.requestAirdrop(address);
            if (cancelled) return;

            logger.debug('[Airdrop] Airdrop received!', { txId: result.txId });

            // Store pending airdrop in SecureStore (survives state resets during onboarding)
            await storePendingAirdrop(pendingKey, result.txId);
            if (cancelled) return;

            // Show modal - defer if biometric setup modal is visible
            pendingAirdropTxIdRef.current = result.txId;
            // If biometric modal is not showing, display immediately (use ref for fresh value)
            if (!showBiometricSetupModalRef.current) {
              setAirdropTxId(result.txId);
              setShowAirdropModal(true);
              pendingAirdropTxIdRef.current = null;
            }
            // Don't trigger effects here - wait for user to click "Get Started"

            // Clear pending airdrop outside setTimeout to avoid race condition
            await clearPendingAirdrop(pendingKey);
          } catch (error: unknown) {
            logger.warn('[Airdrop] Failed to request airdrop', {
              error: error instanceof Error ? error.message : String(error)
            });
            // Keep the lastAirdropTime to prevent immediate retries
          } finally {
            // Release lock and clear ref
            airdropInProgress.current = false;
            await releaseLock(lockKey);
          }
        }
      } catch (error: unknown) {
        // Ensure we clean up on any error
        airdropInProgress.current = false;
        await releaseLock(lockKey);
      }
    };

    // Wait for app to be fully ready before checking airdrop
    const initialTimeout = setTimeout(() => {
      requestAirdropIfNeeded();
    }, 3000);

    // Then check once per day
    const intervalId = setInterval(
      () => {
        requestAirdropIfNeeded();
      },
      24 * 60 * 60 * 1000
    ); // 24 hours

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [wallet?.segwitAddress, currentAccount, isAuthenticated, seedConfirmed]);

  const value = useMemo(() => ({
    // Airdrop modal state
    showAirdropModal,
    setShowAirdropModal,
    airdropTxId,
    // Celebration trigger
    triggerCelebration,
    // Audio state
    audioReady,
  }), [showAirdropModal, airdropTxId, triggerCelebration, audioReady]);

  return <AirdropContext.Provider value={value}>{children}</AirdropContext.Provider>;
};
