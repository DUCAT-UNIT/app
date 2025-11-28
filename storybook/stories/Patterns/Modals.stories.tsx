import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, BORDER_RADIUS } from '../../../theme';

// Real components
import ConfirmationModal from '../../../components/ConfirmationModal';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, height: 568, label: 'XS', subtitle: 'iPhone 5' },
  S: { width: 375, height: 667, label: 'S', subtitle: 'iPhone SE/8' },
  M: { width: 390, height: 844, label: 'M', subtitle: 'iPhone 12/13/14' },
  L: { width: 393, height: 852, label: 'L', subtitle: 'iPhone 14 Pro' },
  XL: { width: 430, height: 932, label: 'XL', subtitle: 'iPhone 16 Pro Max' },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// ============================================================================
// SCALED MODAL STYLES - More aggressive scaling for small devices
// ============================================================================
const getScaledModalStyles = (config: DeviceConfig) => {
  const isXS = config.width <= 320;
  const isSmall = config.width < 375;

  return {
    modalOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: isXS ? 12 : isSmall ? 16 : 20,
    },
    confirmationModal: {
      backgroundColor: COLORS.CARD_BG,
      borderRadius: isXS ? BORDER_RADIUS.md : BORDER_RADIUS.lg,
      padding: isXS ? 14 : isSmall ? 18 : 24,
      width: '100%' as const,
      maxWidth: config.width - (isXS ? 24 : isSmall ? 32 : 40),
    },
    confirmationModalIconContainer: {
      alignItems: 'center' as const,
      marginBottom: isXS ? 8 : isSmall ? 10 : 16,
    },
    confirmationModalTitle: {
      fontSize: isXS ? 15 : isSmall ? 17 : 20,
      fontWeight: '700' as const,
      color: COLORS.WHITE,
      textAlign: 'center' as const,
      marginBottom: isXS ? 6 : isSmall ? 8 : 12,
    },
    confirmationModalText: {
      fontSize: isXS ? 11 : isSmall ? 12 : 14,
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center' as const,
      lineHeight: isXS ? 15 : isSmall ? 17 : 20,
      marginBottom: isXS ? 14 : isSmall ? 18 : 24,
    },
    confirmationModalButtons: {
      flexDirection: 'row' as const,
      gap: isXS ? 6 : isSmall ? 8 : 12,
    },
    confirmationModalButton: {
      flex: 1,
      paddingVertical: isXS ? 9 : isSmall ? 11 : 14,
      borderRadius: isXS ? 6 : BORDER_RADIUS.md,
      alignItems: 'center' as const,
    },
    confirmationModalButtonCancel: {
      backgroundColor: COLORS.VERY_DARK_GRAY,
    },
    confirmationModalButtonTextCancel: {
      fontSize: isXS ? 12 : isSmall ? 13 : 15,
      fontWeight: '600' as const,
      color: COLORS.WHITE,
    },
    confirmationModalButtonDestructive: {
      backgroundColor: COLORS.DANGER_RED,
    },
    confirmationModalButtonPrimary: {
      backgroundColor: COLORS.PRIMARY_BLUE,
    },
    confirmationModalButtonText: {
      fontSize: isXS ? 12 : isSmall ? 13 : 15,
      fontWeight: '600' as const,
      color: COLORS.WHITE,
    },
  };
};

// ============================================================================
// STORY PROPS INTERFACE
// ============================================================================
interface ModalStoryProps {
  deviceSize: DeviceSize;
  iconName?: string;
}

// ============================================================================
// DESTRUCTIVE MODAL STORY
// ============================================================================
const DestructiveStory = ({ deviceSize, iconName }: ModalStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const [visible, setVisible] = useState(true);
  const scaledStyles = getScaledModalStyles(config);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.deviceFrame, { width: config.width, height: config.height * 0.5 }]}>
        <View style={localStyles.deviceContent}>
          <TouchableOpacity style={localStyles.triggerButton} onPress={() => setVisible(true)}>
            <Text style={localStyles.triggerButtonText}>Show Modal</Text>
          </TouchableOpacity>
        </View>
        {visible && (
          <ConfirmationModal
            visible={visible}
            title="Delete Wallet"
            message="This action cannot be undone. All data will be permanently deleted. Make sure you have backed up your seed phrase."
            confirmText="Delete"
            cancelText="Cancel"
            confirmStyle="destructive"
            iconName={iconName}
            onConfirm={() => setVisible(false)}
            onCancel={() => setVisible(false)}
            styles={scaledStyles}
          />
        )}
      </View>
    </View>
  );
};

// ============================================================================
// PRIMARY MODAL STORY
// ============================================================================
const PrimaryStory = ({ deviceSize, iconName }: ModalStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const [visible, setVisible] = useState(true);
  const scaledStyles = getScaledModalStyles(config);

  return (
    <View style={localStyles.centeredContainer}>
      <Text style={localStyles.sizeIndicator}>{config.label} {config.width}px</Text>
      <View style={[localStyles.deviceFrame, { width: config.width, height: config.height * 0.5 }]}>
        <View style={localStyles.deviceContent}>
          <TouchableOpacity style={localStyles.triggerButton} onPress={() => setVisible(true)}>
            <Text style={localStyles.triggerButtonText}>Show Modal</Text>
          </TouchableOpacity>
        </View>
        {visible && (
          <ConfirmationModal
            visible={visible}
            title="Confirm Action"
            message="Are you sure you want to proceed with this action?"
            confirmText="Confirm"
            cancelText="Cancel"
            confirmStyle="primary"
            iconName={iconName}
            onConfirm={() => setVisible(false)}
            onCancel={() => setVisible(false)}
            styles={scaledStyles}
          />
        )}
      </View>
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
interface OverviewStoryProps {
  modalType: 'primary' | 'destructive';
  iconName?: string;
}

const DeviceSizeOverviewStory = ({ modalType, iconName }: OverviewStoryProps) => {
  const isPrimary = modalType === 'primary';
  const title = isPrimary ? 'Confirm Action' : 'Delete Wallet';
  const message = isPrimary
    ? 'Are you sure you want to proceed with this action?'
    : 'This action cannot be undone. All data will be permanently deleted. Make sure you have backed up your seed phrase.';
  const confirmText = isPrimary ? 'Confirm' : 'Delete';

  return (
    <ScrollView contentContainerStyle={localStyles.overviewContainer}>
      {Object.entries(DEVICE_SIZES).map(([key, config]) => {
        const scaledStyles = getScaledModalStyles(config);
        return (
          <View key={key} style={localStyles.deviceSection}>
            <View style={localStyles.deviceHeader}>
              <Text style={localStyles.deviceLabel}>{config.label}</Text>
              <Text style={localStyles.deviceSubtitle}>{config.subtitle} ({config.width}px)</Text>
            </View>
            <View style={[localStyles.deviceFrame, { width: config.width, height: config.height * 0.45 }]}>
              <ConfirmationModal
                visible={true}
                title={title}
                message={message}
                confirmText={confirmText}
                cancelText="Cancel"
                confirmStyle={modalType}
                iconName={iconName}
                onConfirm={() => {}}
                onCancel={() => {}}
                styles={scaledStyles}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/Modals',
};

export default meta;
type Story = StoryObj;

const sharedArgTypes = {
  deviceSize: {
    control: { type: 'select' },
    options: ['XS', 'S', 'M', 'L', 'XL'],
    description: 'Device size preset',
  },
  iconName: {
    control: { type: 'select' },
    options: [undefined, 'warning', 'delete', 'info', 'checkmark', 'lock'],
    description: 'Optional icon to display',
  },
};

export const Destructive: Story = {
  render: (args: ModalStoryProps) => <DestructiveStory {...args} />,
  args: {
    deviceSize: 'M',
    iconName: undefined,
  },
  argTypes: sharedArgTypes,
};

export const Primary: Story = {
  render: (args: ModalStoryProps) => <PrimaryStory {...args} />,
  args: {
    deviceSize: 'M',
    iconName: undefined,
  },
  argTypes: sharedArgTypes,
};

export const DeviceSizeOverview: Story = {
  render: (args: OverviewStoryProps) => <DeviceSizeOverviewStory {...args} />,
  args: {
    modalType: 'primary',
    iconName: undefined,
  },
  argTypes: {
    modalType: {
      control: { type: 'select' },
      options: ['primary', 'destructive'],
      description: 'Modal style type',
    },
    iconName: {
      control: { type: 'select' },
      options: [undefined, 'warning', 'delete', 'info', 'checkmark', 'lock'],
      description: 'Optional icon to display',
    },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const localStyles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
    zIndex: 10,
  },
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.VERY_DARK_GRAY,
    overflow: 'hidden',
    position: 'relative',
  },
  deviceContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  triggerButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  // Device Size Overview styles
  overviewContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    gap: 32,
  },
  deviceSection: {
    alignItems: 'center',
    gap: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceSubtitle: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
});
