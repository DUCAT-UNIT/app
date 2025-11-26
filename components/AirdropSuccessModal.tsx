/**
 * AirdropSuccessModal Component
 * Shows congratulations message with confetti animation when user receives airdrop
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { COLORS } from '../theme';
import Icon from './icons';
import { useAirdrop } from '../contexts/AirdropContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AirdropSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  txId?: string;
}

export default function AirdropSuccessModal({ visible, onClose }: AirdropSuccessModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<any>(null);
  const { triggerCelebration, audioReady } = useAirdrop();
  const hasTriggered = useRef(false);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (visible && audioReady && !hasTriggered.current) {
      // Trigger everything automatically when modal opens and audio is ready
      hasTriggered.current = true;

      // Small delay to ensure modal is visible
      timeoutId = setTimeout(() => {
        // Trigger confetti animation
        if (confettiRef.current) {
          confettiRef.current.start();
        }
        // Trigger all celebration effects (sound, haptics, vibration)
        triggerCelebration();
      }, 100);

      celebrationTimeoutRef.current = timeoutId;

      // Animate modal in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!visible) {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      hasTriggered.current = false; // Reset for next time
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = null;
      }
    };
  }, [visible, audioReady, triggerCelebration, scaleAnim, opacityAnim]);

  return (
    <Modal visible={visible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View style={localStyles.modalOverlay}>
        <Animated.View
          style={[
            localStyles.modalContent,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Success Icon */}
          <View style={{ paddingBottom: 24 }}>
            <Icon name="party" size={55} color="#DDDDDD" />
          </View>

          {/* Title */}
          <Text style={localStyles.title}>Mutiny BTC Airdropped</Text>

          {/* Message */}
          <Text style={localStyles.message}>
            An airdrop is on the way.{'\n'}You should see it reflected in your balance in 30 seconds.
          </Text>

          {/* Get Started Button - Simply dismisses modal */}
          <TouchableOpacity
            style={localStyles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={localStyles.closeButtonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Confetti - Origin set above the screen */}
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: SCREEN_WIDTH / 2, y: -50 }}
          explosionSpeed={350}
          fallSpeed={2500}
          autoStart={false}
          fadeOut={true}
          colors={[COLORS.PRIMARY_BLUE, COLORS.TEAL, COLORS.YELLOW, '#FF6B6B', '#4ECDC4']}
        />
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10000,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});

