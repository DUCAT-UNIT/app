/**
 * Airdrop Celebration Utilities
 * Handles confetti sound effects and haptic feedback for airdrop celebrations
 */

import { Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { logger } from './logger';

/**
 * Configure audio settings for airdrop sounds
 */
export async function configureAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

/**
 * Preload the confetti sound for immediate playback
 * @returns The preloaded sound object
 */
export async function preloadConfettiSound(): Promise<Audio.Sound> {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/audio/confetti.mp3'),
      { shouldPlay: false, volume: 1.0 }
    );
    logger.debug('Confetti audio preloaded and ready');
    return sound;
  } catch (error) {
    logger.debug('Could not preload confetti audio', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Play confetti sound effect
 * @param soundRef - The preloaded sound object
 */
export async function playConfettiSound(soundRef: Audio.Sound | null): Promise<void> {
  try {
    let sound = soundRef;
    if (!sound) {
      // If for some reason sound isn't loaded, try loading it
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../assets/audio/confetti.mp3'),
        { shouldPlay: false }
      );
      sound = newSound;
    }

    // Reset to beginning and play for 3 seconds
    await sound.setPositionAsync(0);
    await sound.playAsync();

    // Stop after 3 seconds
    setTimeout(async () => {
      if (sound) {
        await sound.stopAsync();
      }
    }, 3000);
  } catch (error) {
    // Silent fail in production, log in development
    if (__DEV__) {
      logger.debug('Audio playback failed', { error: (error as Error).message });
    }
  }
}

/**
 * Unload audio sound from memory
 * @param soundRef - The sound to unload
 */
export async function unloadSound(soundRef: Audio.Sound | null): Promise<void> {
  if (soundRef) {
    await soundRef.unloadAsync();
  }
}

/**
 * Trigger confetti cannon haptic effect
 * Creates a dwindling shower of haptic feedback over 2.5 seconds
 * @returns Array of timeout IDs for cleanup
 */
export function triggerConfettiHaptics(): NodeJS.Timeout[] {
  const timeoutIds: NodeJS.Timeout[] = [];

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
    const timeoutId = setTimeout(() => {
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

    timeoutIds.push(timeoutId);
  }

  return timeoutIds;
}

/**
 * Clear all haptic timeouts
 * @param timeoutIds - Array of timeout IDs to clear
 */
export function clearHapticTimeouts(timeoutIds: NodeJS.Timeout[] | null | undefined): void {
  if (timeoutIds && timeoutIds.length > 0) {
    timeoutIds.forEach(id => clearTimeout(id));
  }
}
