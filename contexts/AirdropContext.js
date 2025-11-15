import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { useBalance } from './WalletDataContext';
import { useWallet } from './WalletContext';
import { useAuth } from './AuthContext';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as AirdropService from '../services/airdropService';

const AirdropContext = createContext();

export const useAirdrop = () => {
  const context = useContext(AirdropContext);
  if (!context) {
    throw new Error('useAirdrop must be used within an AirdropProvider');
  }
  return context;
};

export const AirdropProvider = ({ children, seedConfirmed }) => {
  const { segwitBalance, taprootBalance } = useBalance();
  const { wallet, currentAccount } = useWallet();
  const { isAuthenticated } = useAuth();

  // Airdrop modal state
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropTxId, setAirdropTxId] = useState('');

  // Track if airdrop is in progress using ref + lock mechanism
  // Using ref avoids infinite loops from state updates triggering effects
  const airdropInProgress = useRef(false);

  // Store balance values in refs so airdrop logic always reads fresh values
  const segwitBalanceRef = useRef(segwitBalance);
  const taprootBalanceRef = useRef(taprootBalance);

  // Sound effect ref
  const confettiSoundRef = useRef(null);

  // Function to play confetti sound
  const playConfettiSound = async () => {
    try {
      // Load and configure audio if not already loaded
      if (!confettiSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/audio/confetti.mp3'),
          { shouldPlay: false }
        );
        confettiSoundRef.current = sound;
      }

      // Reset to beginning and play for 3 seconds
      await confettiSoundRef.current.setPositionAsync(0);
      await confettiSoundRef.current.playAsync();

      // Stop after 3 seconds
      setTimeout(async () => {
        if (confettiSoundRef.current) {
          await confettiSoundRef.current.stopAsync();
        }
      }, 3000);
    } catch (error) {
      // Silently fail if audio can't play
    }
  };

  // Function to trigger all celebration effects
  const triggerCelebration = () => {
    // Play confetti sound effect
    playConfettiSound();
    // Haptic feedback - confetti cannon explosion!
    // MASSIVE BOOM with long vibration!
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Single LARGE vibration for explosion: 500ms
    Vibration.vibrate(500);

    // Shower of confetti haptics that dwindles over 2.5 seconds
    // Start with dense haptics that gradually become sparse
    const totalDuration = 2500; // 2.5 seconds
    const totalTaps = 800; // Lots of taps

    for (let i = 0; i < totalTaps; i++) {
      // Calculate progress (0 to 1) for this tap
      const progress = i / totalTaps;

      // Bias delays towards later in the animation (dwindling effect)
      // Early taps are clustered at the beginning, later taps spread out
      const delay = Math.pow(progress, 0.5) * totalDuration;

      // Decrease intensity over time
      // First 30% = heavy/medium impacts
      // Middle 40% = light impacts
      // Last 30% = only selections (lightest)
      setTimeout(() => {
        const timeProgress = delay / totalDuration;
        if (timeProgress < 0.3) {
          // Early: mix of heavy and medium
          if (Math.random() > 0.5) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } else if (timeProgress < 0.7) {
          // Middle: mostly light
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          // End: very light selections only
          Haptics.selectionAsync();
        }
      }, delay);
    }
  };

  // Load audio on mount and cleanup on unmount
  useEffect(() => {
    // Configure audio for playback
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    return () => {
      // Cleanup sound on unmount
      if (confettiSoundRef.current) {
        confettiSoundRef.current.unloadAsync();
        confettiSoundRef.current = null;
      }
    };
  }, []);

  // Update refs whenever balances change
  useEffect(() => {
    segwitBalanceRef.current = segwitBalance;
    taprootBalanceRef.current = taprootBalance;
  }, [segwitBalance, taprootBalance]);

  // Clean up expired airdrop locks on mount
  useEffect(() => {
    const cleanupExpiredLocks = async () => {
      if (!wallet?.segwitAddress) return;

      const lockKey = `airdropLock_${wallet.segwitAddress}_${currentAccount}`;
      try {
        const existingLock = await SecureStore.getItemAsync(lockKey);
        if (existingLock) {
          const lockTime = parseInt(existingLock, 10);
          const now = Date.now();
          const lockTimeout = 60 * 1000; // 60 second timeout

          // If lock is expired (older than 60 seconds), clean it up
          if (now - lockTime >= lockTimeout) {
            await SecureStore.deleteItemAsync(lockKey);
          }
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    };

    cleanupExpiredLocks();
  }, [wallet?.segwitAddress, currentAccount]);

  // Check for pending airdrop modal on mount and when balance updates
  useEffect(() => {
    const checkPendingAirdrop = async () => {
      if (!wallet?.segwitAddress) return;

      const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
      const pendingTxId = await SecureStore.getItemAsync(pendingKey);

      // If there's a pending airdrop and balance is now > 0, show the modal
      if (pendingTxId && (segwitBalance > 0 || taprootBalance > 0)) {
        setAirdropTxId(pendingTxId);
        setShowAirdropModal(true);
        // Don't trigger effects here - wait for user to click "Get Started"
        // Clear the pending airdrop
        await SecureStore.deleteItemAsync(pendingKey);
      }
    };

    checkPendingAirdrop();
  }, [wallet, currentAccount, segwitBalance, taprootBalance]);

  // Auto-request airdrop when BTC balance is 0 (check once per day)
  useEffect(() => {
    if (!wallet?.segwitAddress) return;
    if (!isAuthenticated) return;
    if (!seedConfirmed) return;

    const requestAirdropIfNeeded = async () => {
      // Skip if already in progress
      if (airdropInProgress.current) return;

      const airdropKey = `lastAirdropTime_${wallet.segwitAddress}_${currentAccount}`;
      const lockKey = `airdropLock_${wallet.segwitAddress}_${currentAccount}`;

      try {
        // Check for existing lock (prevents race conditions across mounts)
        const existingLock = await SecureStore.getItemAsync(lockKey);
        if (existingLock) {
          const lockTime = parseInt(existingLock, 10);
          const now = Date.now();
          const lockTimeout = 60 * 1000; // 60 second timeout for locks

          // If lock is less than 60 seconds old, skip
          if (now - lockTime < lockTimeout) {
            return;
          }
          // Lock expired, we can proceed and will create a new one
        }

        // Get current balance from refs (always fresh, not stale closure values)
        const totalBtcBalance = segwitBalanceRef.current + taprootBalanceRef.current;

        // If balance is 0, request airdrop
        if (totalBtcBalance === 0) {
          // Check when we last requested an airdrop for this specific wallet+account combo
          const lastAirdropTime = await SecureStore.getItemAsync(airdropKey);
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours

          // Only allow airdrop once every 24 hours per account
          if (lastAirdropTime && now - parseInt(lastAirdropTime, 10) < twentyFourHours) {
            return;
          }

          // Acquire lock BEFORE setting ref
          await SecureStore.setItemAsync(lockKey, now.toString());
          airdropInProgress.current = true;

          try {
            // Store attempt time immediately to prevent duplicate requests (per account)
            await SecureStore.setItemAsync(airdropKey, now.toString());

            // Request airdrop
            const result = await AirdropService.requestAirdrop(wallet.segwitAddress);

            // Store pending airdrop in SecureStore (survives state resets during onboarding)
            const pendingKey = `pendingAirdrop_${wallet.segwitAddress}_${currentAccount}`;
            await SecureStore.setItemAsync(pendingKey, result.txId);

            // Show modal immediately - don't wait for balance update
            setTimeout(() => {
              setAirdropTxId(result.txId);
              setShowAirdropModal(true);
              // Don't trigger effects here - wait for user to click "Get Started"
              // Clean up pending state
              SecureStore.deleteItemAsync(pendingKey);
            }, 500);
          } catch (error) {
            // Keep the lastAirdropTime to prevent immediate retries
          } finally {
            // Release lock and clear ref
            airdropInProgress.current = false;
            await SecureStore.deleteItemAsync(lockKey);
          }
        }
      } catch (error) {
        // Ensure we clean up on any error
        airdropInProgress.current = false;
        await SecureStore.deleteItemAsync(lockKey).catch(() => {});
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
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [wallet, currentAccount, isAuthenticated, seedConfirmed]);

  const value = {
    // Airdrop modal state
    showAirdropModal,
    setShowAirdropModal,
    airdropTxId,
    // Celebration trigger
    triggerCelebration,
  };

  return <AirdropContext.Provider value={value}>{children}</AirdropContext.Provider>;
};
