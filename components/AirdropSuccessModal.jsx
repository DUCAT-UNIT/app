/**
 * AirdropSuccessModal Component
 * Shows congratulations message with confetti animation when user receives airdrop
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, Text, Modal, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const _SCREEN_HEIGHT = Dimensions.get('window').height;

export default function AirdropSuccessModal({ visible, onClose, txId }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Trigger confetti
      if (confettiRef.current) {
        confettiRef.current.start();
      }

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
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

          {/* Transaction ID */}
          {txId && (
            <View style={localStyles.txIdContainer}>
              <Text style={localStyles.txIdLabel}>Transaction ID</Text>
              <Text style={localStyles.txIdText} numberOfLines={1} ellipsizeMode="middle">
                {txId.substring(0, 16)}...{txId.substring(txId.length - 16)}
              </Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={localStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={localStyles.closeButtonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Confetti */}
        <ConfettiCannon
          ref={confettiRef}
          count={150}
          origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
          autoStart={false}
          fadeOut={true}
          fallSpeed={2500}
          colors={[COLORS.PRIMARY_BLUE, COLORS.TEAL, COLORS.YELLOW, '#FF6B6B', '#4ECDC4']}
        />
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
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
  txIdContainer: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  txIdLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 6,
    textAlign: 'center',
  },
  txIdText: {
    fontSize: 11,
    color: COLORS.VERY_LIGHT_GRAY,
    textAlign: 'center',
    fontFamily: 'monospace',
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

AirdropSuccessModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  txId: PropTypes.string,
};
