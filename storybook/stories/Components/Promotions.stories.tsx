import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// AIRDROP SUCCESS MODAL
// ============================================================================
const AirdropSuccessModal = () => (
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <View style={styles.iconContainer}>
        <Icon name="party" size={55} color="#DDDDDD" />
      </View>
      <Text style={styles.modalTitle}>Mutiny BTC Airdropped</Text>
      <Text style={styles.modalMessage}>
        An airdrop is on the way.{'\n'}You should see it reflected in your balance in 30 seconds.
      </Text>
      <TouchableOpacity style={styles.modalButton}>
        <Text style={styles.modalButtonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const PromotionsStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Promotions</Text>
    <Text style={styles.description}>
      Promotional modals and celebratory screens for special events.
    </Text>

    <Text style={styles.sectionLabel}>AIRDROP SUCCESS</Text>
    <Text style={styles.sectionDesc}>
      Displayed when user receives a Mutinynet BTC airdrop. Includes confetti animation and celebration effects.
    </Text>
    <AirdropSuccessModal />

    <Text style={styles.sectionLabel}>EFFECTS</Text>
    <View style={styles.effectsList}>
      <View style={styles.effectItem}>
        <View style={[styles.effectIcon, { backgroundColor: COLORS.PRIMARY_BLUE + '20' }]}>
          <Icon name="party" size={20} color={COLORS.PRIMARY_BLUE} />
        </View>
        <View style={styles.effectContent}>
          <Text style={styles.effectTitle}>Confetti Animation</Text>
          <Text style={styles.effectDesc}>200 particles falling from top</Text>
        </View>
      </View>
      <View style={styles.effectItem}>
        <View style={[styles.effectIcon, { backgroundColor: COLORS.TEAL + '20' }]}>
          <Icon name="notification" size={20} color={COLORS.TEAL} />
        </View>
        <View style={styles.effectContent}>
          <Text style={styles.effectTitle}>Sound Effect</Text>
          <Text style={styles.effectDesc}>Celebration audio plays</Text>
        </View>
      </View>
      <View style={styles.effectItem}>
        <View style={[styles.effectIcon, { backgroundColor: COLORS.YELLOW + '20' }]}>
          <Icon name="wallet" size={20} color={COLORS.WARNING_ORANGE} />
        </View>
        <View style={styles.effectContent}>
          <Text style={styles.effectTitle}>Haptic Feedback</Text>
          <Text style={styles.effectDesc}>Device vibration pattern</Text>
        </View>
      </View>
    </View>

    <Text style={styles.sectionLabel}>ANIMATION</Text>
    <View style={styles.animationInfo}>
      <View style={styles.animationRow}>
        <Text style={styles.animationLabel}>Entry</Text>
        <Text style={styles.animationValue}>Scale + Fade (spring)</Text>
      </View>
      <View style={styles.animationRow}>
        <Text style={styles.animationLabel}>Duration</Text>
        <Text style={styles.animationValue}>300ms</Text>
      </View>
      <View style={styles.animationRow}>
        <Text style={styles.animationLabel}>Confetti Colors</Text>
        <View style={styles.colorDots}>
          {[COLORS.PRIMARY_BLUE, COLORS.TEAL, COLORS.YELLOW, '#FF6B6B', '#4ECDC4'].map((color, i) => (
            <View key={i} style={[styles.colorDot, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof PromotionsStory> = {
  title: 'Patterns/Promotions',
  component: PromotionsStory,
};

export default meta;
type Story = StoryObj<typeof PromotionsStory>;

export const AirdropSuccess: Story = {};

// ============================================================================
// STYLES - Matches AirdropSuccessModal
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
    lineHeight: 20,
  },

  // Modal
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  iconContainer: {
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },

  // Effects
  effectsList: {
    gap: 12,
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  effectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectContent: {
    flex: 1,
  },
  effectTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  effectDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 2,
  },

  // Animation info
  animationInfo: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  animationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  animationLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  animationValue: {
    fontSize: 14,
    color: COLORS.WHITE,
  },
  colorDots: {
    flexDirection: 'row',
    gap: 6,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
