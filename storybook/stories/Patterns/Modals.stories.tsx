import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, BORDER_RADIUS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_CONFIGS = [
  { width: 320, height: 568, size: 'XS', label: 'iPhone 5', scale: 0.8 },
  { width: 375, height: 667, size: 'S', label: 'iPhone SE/8', scale: 0.9 },
  { width: 390, height: 844, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, height: 852, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, height: 932, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.0 },
];

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
type DialogType = 'destructive' | 'confirmation' | 'informational';

const TYPE_CONFIG = {
  destructive: {
    icon: 'warning',
    color: COLORS.DANGER_RED,
    buttonColor: COLORS.DANGER_RED,
  },
  confirmation: {
    icon: 'done',
    color: COLORS.SUCCESS_GREEN,
    buttonColor: COLORS.PRIMARY_BLUE,
  },
  informational: {
    icon: 'notification',
    color: COLORS.PRIMARY_BLUE,
    buttonColor: COLORS.PRIMARY_BLUE,
  },
};

// ============================================================================
// DIALOG COMPONENT
// ============================================================================
interface DialogProps {
  type: DialogType;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
  scale?: number;
}

const Dialog = ({ type, title, message, primaryLabel, secondaryLabel, scale = 1 }: DialogProps) => {
  const config = TYPE_CONFIG[type];

  const iconSize = 32 * scale;
  const iconCircleSize = 64 * scale;
  const titleSize = 20 * scale;
  const messageSize = 14 * scale;
  const buttonTextSize = 16 * scale;
  const padding = 24 * scale;
  const buttonPadding = 14 * scale;

  return (
    <View style={[styles.dialogOverlay, { padding: padding }]}>
      <View style={[styles.dialogContent, { padding: padding, borderRadius: 20 * scale }]}>
        <View style={[
          styles.iconCircle,
          {
            backgroundColor: config.color + '20',
            width: iconCircleSize,
            height: iconCircleSize,
            borderRadius: iconCircleSize / 2,
            marginBottom: 16 * scale,
          }
        ]}>
          <Icon name={config.icon} size={iconSize} color={config.color} />
        </View>
        <Text style={[styles.dialogTitle, { fontSize: titleSize, marginBottom: 8 * scale }]}>{title}</Text>
        <Text style={[styles.dialogMessage, { fontSize: messageSize, lineHeight: messageSize * 1.4, marginBottom: 24 * scale }]}>{message}</Text>
        <View style={[styles.dialogButtons, { gap: 12 * scale }]}>
          {secondaryLabel && (
            <TouchableOpacity style={[styles.secondaryButton, { paddingVertical: buttonPadding, borderRadius: 12 * scale }]}>
              <Text style={[styles.secondaryButtonText, { fontSize: buttonTextSize }]}>{secondaryLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: config.buttonColor, paddingVertical: buttonPadding, borderRadius: 12 * scale }]}>
            <Text style={[styles.primaryButtonText, { fontSize: buttonTextSize }]}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// CONFIGURABLE DIALOG STORY
// ============================================================================
interface ConfigurableProps {
  type: DialogType;
  deviceSize: DeviceSize;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

const ConfigurableStory = ({ type, deviceSize, title, message, primaryLabel, secondaryLabel }: ConfigurableProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === deviceSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.container}>
      <View style={{ width: config.width }}>
        <Dialog
          type={type}
          title={title}
          message={message}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          scale={config.scale}
        />
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
interface OverviewProps {
  type: DialogType;
}

const DeviceSizeOverviewStory = ({ type }: OverviewProps) => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {DEVICE_CONFIGS.map(({ width, size, label, scale }) => (
      <View key={width} style={styles.deviceSection}>
        <Text style={styles.sizeLabel}>{size}</Text>
        <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
        <View style={{ width }}>
          <Dialog
            type={type}
            title={type === 'destructive' ? 'Delete Wallet?' : type === 'confirmation' ? 'Confirm Action' : 'Network Info'}
            message={type === 'destructive'
              ? 'This action cannot be undone. Make sure you have backed up your recovery phrase.'
              : type === 'confirmation'
              ? 'Are you sure you want to proceed with this action?'
              : 'Bitcoin network is experiencing high traffic. Transactions may take longer.'}
            primaryLabel={type === 'destructive' ? 'Delete' : type === 'confirmation' ? 'Confirm' : 'Got it'}
            secondaryLabel="Cancel"
            scale={scale}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// ============================================================================
// ALL TYPES STORY
// ============================================================================
const AllTypesStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    <View style={styles.typeSection}>
      <View style={styles.typeHeader}>
        <View style={[styles.typeDot, { backgroundColor: COLORS.DANGER_RED }]} />
        <Text style={styles.typeLabel}>Destructive</Text>
      </View>
      <Dialog
        type="destructive"
        title="Delete Wallet?"
        message="This action cannot be undone. Make sure you have backed up your recovery phrase."
        primaryLabel="Delete"
        secondaryLabel="Cancel"
      />
    </View>
    <View style={styles.typeSection}>
      <View style={styles.typeHeader}>
        <View style={[styles.typeDot, { backgroundColor: COLORS.SUCCESS_GREEN }]} />
        <Text style={styles.typeLabel}>Confirmation</Text>
      </View>
      <Dialog
        type="confirmation"
        title="Backup Complete"
        message="Your recovery phrase has been saved securely. Keep it in a safe place."
        primaryLabel="Done"
      />
    </View>
    <View style={styles.typeSection}>
      <View style={styles.typeHeader}>
        <View style={[styles.typeDot, { backgroundColor: COLORS.PRIMARY_BLUE }]} />
        <Text style={styles.typeLabel}>Informational</Text>
      </View>
      <Dialog
        type="informational"
        title="Update Available"
        message="A new version of Ducat is available with important security improvements."
        primaryLabel="Update Now"
        secondaryLabel="Later"
      />
    </View>
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/Modals',
};

export default meta;
type Story = StoryObj;

export const Modal: Story = {
  render: (args: ConfigurableProps) => <ConfigurableStory {...args} />,
  args: {
    type: 'destructive',
    deviceSize: 'L',
    title: 'Delete Wallet?',
    message: 'This action cannot be undone. Make sure you have backed up your recovery phrase.',
    primaryLabel: 'Delete',
    secondaryLabel: 'Cancel',
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['destructive', 'confirmation', 'informational'],
      description: 'Dialog type',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
    title: { control: 'text' },
    message: { control: 'text' },
    primaryLabel: { control: 'text' },
    secondaryLabel: { control: 'text' },
  },
};

export const AllTypes: Story = {
  render: () => <AllTypesStory />,
};

export const DeviceSizeOverview: Story = {
  render: (args: OverviewProps) => <DeviceSizeOverviewStory {...args} />,
  args: {
    type: 'destructive',
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['destructive', 'confirmation', 'informational'],
      description: 'Dialog type',
    },
  },
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
  typeSection: {
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Dialog
  dialogOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    alignItems: 'center',
  },
  dialogContent: {
    backgroundColor: COLORS.CARD_BG,
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontWeight: '700',
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  dialogMessage: {
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
  dialogButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.BORDER_COLOR,
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
