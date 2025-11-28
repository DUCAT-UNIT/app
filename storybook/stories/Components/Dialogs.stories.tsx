import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// DIALOG COMPONENT
// ============================================================================
const Dialog = ({
  type,
  title,
  message,
  primaryLabel,
  secondaryLabel,
}: {
  type: 'destructive' | 'confirmation' | 'informational';
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
}) => {
  const iconMap = {
    destructive: 'warning',
    confirmation: 'done',
    informational: 'notification',
  };

  const colorMap = {
    destructive: COLORS.DANGER_RED,
    confirmation: COLORS.SUCCESS_GREEN,
    informational: COLORS.PRIMARY_BLUE,
  };

  const buttonColorMap = {
    destructive: COLORS.DANGER_RED,
    confirmation: COLORS.PRIMARY_BLUE,
    informational: COLORS.PRIMARY_BLUE,
  };

  return (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialogContent}>
        <View style={[styles.iconCircle, { backgroundColor: colorMap[type] + '20' }]}>
          <Icon name={iconMap[type]} size={32} color={colorMap[type]} />
        </View>
        <Text style={styles.dialogTitle}>{title}</Text>
        <Text style={styles.dialogMessage}>{message}</Text>
        <View style={styles.dialogButtons}>
          {secondaryLabel && (
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: buttonColorMap[type] }]}>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// OVERVIEW STORY
// ============================================================================
const OverviewStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Dialogs</Text>
    <Text style={styles.description}>
      Modal dialogs for important user decisions. Select a type from the sidebar.
    </Text>

    <View style={styles.overviewGrid}>
      {[
        { type: 'destructive' as const, label: 'Destructive', color: COLORS.DANGER_RED },
        { type: 'confirmation' as const, label: 'Confirmation', color: COLORS.SUCCESS_GREEN },
        { type: 'informational' as const, label: 'Informational', color: COLORS.PRIMARY_BLUE },
      ].map(({ type, label, color }) => (
        <View key={type} style={styles.overviewItem}>
          <View style={[styles.overviewDot, { backgroundColor: color }]} />
          <Text style={styles.overviewLabel}>{label}</Text>
          <Text style={styles.overviewDesc}>
            {type === 'destructive' && 'Irreversible actions'}
            {type === 'confirmation' && 'User acknowledgment'}
            {type === 'informational' && 'Important info'}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// DESTRUCTIVE DIALOG
// ============================================================================
const DestructiveStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Destructive</Text>
    <Text style={styles.description}>
      Used for irreversible actions like deleting wallet or logging out.
    </Text>

    <Text style={styles.sectionLabel}>DELETE WALLET</Text>
    <Dialog
      type="destructive"
      title="Delete Wallet?"
      message="This action cannot be undone. Make sure you have backed up your recovery phrase."
      primaryLabel="Delete"
      secondaryLabel="Cancel"
    />

    <Text style={styles.sectionLabel}>LOGOUT</Text>
    <Dialog
      type="destructive"
      title="Log Out?"
      message="You will need your PIN or recovery phrase to access this wallet again."
      primaryLabel="Log Out"
      secondaryLabel="Cancel"
    />
  </View>
);

// ============================================================================
// CONFIRMATION DIALOG
// ============================================================================
const ConfirmationStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Confirmation</Text>
    <Text style={styles.description}>
      Used when user needs to acknowledge important information or confirm an action.
    </Text>

    <Text style={styles.sectionLabel}>BACKUP REMINDER</Text>
    <Dialog
      type="confirmation"
      title="Backup Complete"
      message="Your recovery phrase has been saved securely. Keep it in a safe place."
      primaryLabel="Done"
    />

    <Text style={styles.sectionLabel}>TRANSACTION CONFIRM</Text>
    <Dialog
      type="confirmation"
      title="Confirm Transaction"
      message="You are about to send 0.05 BTC to bc1q...xyz. This action cannot be reversed."
      primaryLabel="Confirm"
      secondaryLabel="Cancel"
    />
  </View>
);

// ============================================================================
// INFORMATIONAL DIALOG
// ============================================================================
const InformationalStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Informational</Text>
    <Text style={styles.description}>
      Used to provide important information that requires user attention.
    </Text>

    <Text style={styles.sectionLabel}>NETWORK INFO</Text>
    <Dialog
      type="informational"
      title="Network Congested"
      message="Bitcoin network is experiencing high traffic. Transactions may take longer than usual."
      primaryLabel="Got it"
    />

    <Text style={styles.sectionLabel}>UPDATE AVAILABLE</Text>
    <Dialog
      type="informational"
      title="Update Available"
      message="A new version of Ducat is available with important security improvements."
      primaryLabel="Update Now"
      secondaryLabel="Later"
    />
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/Dialogs',
};

export default meta;
type Story = StoryObj;

export const Overview: Story = { render: () => <OverviewStory /> };
export const Destructive: Story = { render: () => <DestructiveStory /> };
export const Confirmation: Story = { render: () => <ConfirmationStory /> };
export const Informational: Story = { render: () => <InformationalStory /> };

// ============================================================================
// STYLES
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
    marginBottom: 16,
    marginTop: 32,
  },

  // Overview
  overviewGrid: {
    gap: 12,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  overviewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  overviewLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
    width: 100,
  },
  overviewDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    flex: 1,
  },

  // Dialog
  dialogOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  dialogContent: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.BORDER_COLOR,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
