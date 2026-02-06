/**
 * Tests for airdropCelebration utilities
 */

import { Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

// Mock the audio file before importing the module
jest.mock('../../assets/audio/confetti.mp3', () => 'mocked-audio-file', { virtual: true });

// Mock dependencies
jest.mock('react-native', () => ({
  Vibration: {
    vibrate: jest.fn(),
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setPositionAsync: jest.fn().mockResolvedValue(undefined),
          playAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Heavy: 'heavy',
    Medium: 'medium',
    Light: 'light',
  },
}));

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

declare const global: typeof globalThis & { __DEV__?: boolean };

// Import after mocks are set up
import {
  configureAudioMode,
  preloadConfettiSound,
  playConfettiSound,
  unloadSound,
  triggerConfettiHaptics,
  clearHapticTimeouts,
} from '../airdropCelebration';

describe('airdropCelebration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('configureAudioMode', () => {
    it('should configure audio settings for iOS and Android', async () => {
      await configureAudioMode();

      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    });
  });

  describe('preloadConfettiSound', () => {
    it('should preload confetti sound and return sound object', async () => {
      const mockSound = {
        setPositionAsync: jest.fn(),
        playAsync: jest.fn(),
      };

      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound: mockSound });

      const result = await preloadConfettiSound();

      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        expect.anything(),
        { shouldPlay: false, volume: 1.0 }
      );
      expect(result).toBe(mockSound);
    });

    it('should throw error when sound creation fails', async () => {
      const error = new Error('Failed to create sound');
      (Audio.Sound.createAsync as jest.Mock).mockRejectedValue(error);

      await expect(preloadConfettiSound()).rejects.toThrow('Failed to create sound');
    });
  });

  describe('playConfettiSound', () => {
    it('should play sound when soundRef is provided', async () => {
      const mockSound = {
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        playAsync: jest.fn().mockResolvedValue(undefined),
        stopAsync: jest.fn().mockResolvedValue(undefined),
      };

      await playConfettiSound(mockSound as any);

      expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
      expect(mockSound.playAsync).toHaveBeenCalled();
    });

    it('should create sound when soundRef is null', async () => {
      const mockSound = {
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        playAsync: jest.fn().mockResolvedValue(undefined),
        stopAsync: jest.fn().mockResolvedValue(undefined),
      };

      (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound: mockSound });

      await playConfettiSound(null);

      expect(Audio.Sound.createAsync).toHaveBeenCalled();
      expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
      expect(mockSound.playAsync).toHaveBeenCalled();
    });

    it('should stop sound after 3 seconds', async () => {
      const mockSound = {
        setPositionAsync: jest.fn().mockResolvedValue(undefined),
        playAsync: jest.fn().mockResolvedValue(undefined),
        stopAsync: jest.fn().mockResolvedValue(undefined),
      };

      await playConfettiSound(mockSound as any);

      // Fast-forward 3 seconds
      jest.advanceTimersByTime(3000);

      // Need to flush promises
      await Promise.resolve();

      expect(mockSound.stopAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully in development', async () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = true;

      const mockSound = {
        setPositionAsync: jest.fn().mockRejectedValue(new Error('Playback failed')),
      };

      // Should not throw
      await playConfettiSound(mockSound as any);

      global.__DEV__ = originalDev;
    });

    it('should handle errors silently in production', async () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = false;

      const mockSound = {
        setPositionAsync: jest.fn().mockRejectedValue(new Error('Playback failed')),
      };

      // Should not throw
      await playConfettiSound(mockSound as any);

      global.__DEV__ = originalDev;
    });
  });

  describe('unloadSound', () => {
    it('should unload sound when soundRef is provided', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      await unloadSound(mockSound as any);

      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    it('should do nothing when soundRef is null', async () => {
      // Should not throw
      await unloadSound(null);
    });
  });

  describe('triggerConfettiHaptics', () => {
    it('should trigger initial heavy haptic and vibration', () => {
      triggerConfettiHaptics();

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
      expect(Vibration.vibrate).toHaveBeenCalledWith(500);
    });

    it('should return array of timeout IDs', () => {
      const timeoutIds = triggerConfettiHaptics();

      expect(Array.isArray(timeoutIds)).toBe(true);
      expect(timeoutIds.length).toBe(800);
    });

    it('should schedule haptics with different intensities based on progress', () => {
      // Mock Math.random to control the random behavior
      const originalRandom = Math.random;
      let randomCallCount = 0;
      Math.random = () => {
        randomCallCount++;
        return randomCallCount % 2 === 0 ? 0.3 : 0.7;
      };

      triggerConfettiHaptics();

      // Fast-forward through all timers
      jest.runAllTimers();

      // Should have called various haptic functions
      expect(Haptics.impactAsync).toHaveBeenCalled();
      expect(Haptics.selectionAsync).toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should trigger early haptics (0-30% progress)', () => {
      Math.random = () => 0.6; // Will trigger Medium

      triggerConfettiHaptics();

      // Fast-forward a small amount of time
      jest.advanceTimersByTime(500);

      // Early haptics should be medium or light
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('should trigger middle haptics (30-70% progress)', () => {
      triggerConfettiHaptics();

      // Fast-forward to middle of animation
      jest.advanceTimersByTime(1500);

      // Middle haptics should be light
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('should trigger end haptics (70-100% progress)', () => {
      triggerConfettiHaptics();

      // Fast-forward to end of animation
      jest.advanceTimersByTime(2500);

      // End haptics should be selection
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  describe('clearHapticTimeouts', () => {
    it('should clear all timeout IDs', () => {
      const timeoutIds = triggerConfettiHaptics();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      clearHapticTimeouts(timeoutIds);

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(800);

      clearTimeoutSpy.mockRestore();
    });

    it('should handle null timeoutIds', () => {
      // Should not throw
      clearHapticTimeouts(null);
    });

    it('should handle undefined timeoutIds', () => {
      // Should not throw
      clearHapticTimeouts(undefined);
    });

    it('should handle empty array', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      clearHapticTimeouts([]);

      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});
