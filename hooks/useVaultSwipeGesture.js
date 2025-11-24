/**
 * useVaultSwipeGesture - Hook for handling swipe gestures between wallet and vault
 * Extracts swipe gesture logic from WalletPage
 */

import { useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Hook for managing swipe gestures between wallet and vault screens
 * @param {Object} params
 * @param {string} params.activeTab - Current active tab (wallet/vault)
 * @param {Function} params.setActiveTab - Function to set active tab
 * @param {Function} params.openVault - Function to open vault
 * @returns {Object} Swipe gesture state and responders
 */
export function useVaultSwipeGesture({ activeTab, setActiveTab, openVault }) {
  // Vault swipe animation state
  const vaultTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current; // Start on left
  const walletTranslateX = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const isAnimatingRef = useRef(false);

  // Keep positions in sync with activeTab - runs on mount and whenever activeTab changes
  useEffect(() => {
    // Don't interfere with swipe animations
    if (isSwiping || isAnimatingRef.current) return;

    if (activeTab === 'vault') {
      // Vault is active - wallet should be off screen right, vault centered
      walletTranslateX.setValue(SCREEN_WIDTH);
      vaultTranslateX.setValue(0);
    } else {
      // Wallet is active - wallet centered, vault off screen left
      walletTranslateX.setValue(0);
      vaultTranslateX.setValue(-SCREEN_WIDTH);
    }
  }, [activeTab, isSwiping, walletTranslateX, vaultTranslateX]);

  // Pan responder for wallet screen - right swipe to reveal vault
  const walletPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate for horizontal swipes on wallet screen
        if (activeTab !== 'wallet') return false;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMinimumMovement = Math.abs(gestureState.dx) > 20; // Increased from 10 for less sensitivity
        return isHorizontal && hasMinimumMovement;
      },
      onPanResponderGrant: () => {
        setIsSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow right swipe (positive dx) - wallet moves right, vault reveals from left
        if (gestureState.dx > 0) {
          walletTranslateX.setValue(gestureState.dx);
          vaultTranslateX.setValue(-SCREEN_WIDTH + gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSwiping(false);

        // Determine if we should complete the transition based on:
        // 1. Distance (30% threshold instead of 50%)
        // 2. Velocity (fast swipes trigger easier)
        const swipeDistance = gestureState.dx;
        const swipeVelocity = gestureState.vx;
        const distanceThreshold = SCREEN_WIDTH * 0.3;
        const velocityThreshold = 0.5;

        const shouldComplete =
          swipeDistance > distanceThreshold || swipeVelocity > velocityThreshold;

        if (shouldComplete) {
          isAnimatingRef.current = true;
          // Complete animation to vault - wallet moves right off screen, vault moves to center
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start(() => {
            openVault();
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: 0,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Pan responder for vault screen - left swipe to go back to wallet
  // Now only attached to the edge area, so simplified logic
  const vaultPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Since this is only on the edge, we can be more permissive
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMovement = Math.abs(gestureState.dx) > 10;
        const isLeftSwipe = gestureState.dx < -10;
        return isHorizontal && isLeftSwipe && hasMovement;
      },
      onPanResponderGrant: () => {
        setIsSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative dx) - vault moves left, wallet reveals from right
        if (gestureState.dx < 0) {
          vaultTranslateX.setValue(gestureState.dx);
          walletTranslateX.setValue(SCREEN_WIDTH + gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSwiping(false);

        // Determine if we should complete the transition based on:
        // 1. Distance (30% threshold instead of 50%)
        // 2. Velocity (fast swipes trigger easier)
        const swipeDistance = Math.abs(gestureState.dx);
        const swipeVelocity = Math.abs(gestureState.vx);
        const distanceThreshold = SCREEN_WIDTH * 0.3;
        const velocityThreshold = 0.5;

        const shouldComplete =
          swipeDistance > distanceThreshold || swipeVelocity > velocityThreshold;

        if (shouldComplete) {
          isAnimatingRef.current = true;
          // Complete animation to wallet - vault moves left off screen, wallet moves to center
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(walletTranslateX, {
              toValue: 0,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setActiveTab('wallet');
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  return {
    vaultTranslateX,
    walletTranslateX,
    isSwiping,
    walletPanResponder,
    vaultPanResponder,
  };
}
