import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_CONFIGS = [
  { width: 320, size: 'XS', label: 'iPhone 5', scale: 0.8 },
  { width: 375, size: 'S', label: 'iPhone SE/8', scale: 0.9 },
  { width: 390, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.0 },
];

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

// ============================================================================
// AIRDROP SUCCESS MODAL
// ============================================================================
interface AirdropModalProps {
  scale?: number;
}

const AirdropModal = ({ scale = 1 }: AirdropModalProps) => {
  const iconSize = 55 * scale;
  const titleSize = 22 * scale;
  const messageSize = 16 * scale;
  const buttonTextSize = 16 * scale;
  const padding = 32 * scale;
  const buttonPadding = 16 * scale;

  return (
    <View style={[styles.modalOverlay, { padding: 24 * scale }]}>
      <View style={[styles.modalContent, { padding, borderRadius: 24 * scale }]}>
        <View style={[styles.iconContainer, { paddingBottom: 24 * scale }]}>
          <Icon name="party" size={iconSize} color="#DDDDDD" />
        </View>
        <Text style={[styles.modalTitle, { fontSize: titleSize, marginBottom: 12 * scale }]}>
          Mutiny BTC Airdropped
        </Text>
        <Text style={[styles.modalMessage, { fontSize: messageSize, lineHeight: messageSize * 1.5, marginBottom: 24 * scale }]}>
          An airdrop is on the way.{'\n'}You should see it reflected in your balance in 30 seconds.
        </Text>
        <TouchableOpacity style={[styles.modalButton, { paddingVertical: buttonPadding, borderRadius: 12 * scale }]}>
          <Text style={[styles.modalButtonText, { fontSize: buttonTextSize }]}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// CONFIGURABLE STORY
// ============================================================================
interface ConfigurableProps {
  deviceSize: DeviceSize;
}

const ConfigurableStory = ({ deviceSize }: ConfigurableProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === deviceSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.container}>
      <View style={{ width: config.width }}>
        <AirdropModal scale={config.scale} />
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {DEVICE_CONFIGS.map(({ width, size, label, scale }) => (
      <View key={width} style={styles.deviceSection}>
        <Text style={styles.sizeLabel}>{size}</Text>
        <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
        <View style={{ width }}>
          <AirdropModal scale={scale} />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/Promotions',
};

export default meta;
export const AirdropSuccess: StoryObj<ConfigurableProps> = {
  render: (args) => <ConfigurableStory {...args} />,
  args: {
    deviceSize: 'L',
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
  },
};

export const DeviceSizeOverview: StoryObj = {
  render: () => <DeviceSizeOverviewStory />,
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    gap: 32,
    alignItems: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  // Modal
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {},
  modalTitle: {
    fontWeight: '700',
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  modalMessage: {
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
