import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import type { SnackbarType } from '../../../types/notification';

// ============================================================================
// SNACKBAR DISPLAY - Static version for Storybook (no absolute positioning)
// Mirrors the actual Snackbar component styling
// ============================================================================
const Icons = {
  Success: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.SUCCESS_GREEN} />
      <Path d="M5.5 9L8 11.5L12.5 6.5" stroke={COLORS.WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  Error: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.DANGER_RED} />
      <Path d="M9 5V10" stroke={COLORS.WHITE} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={13} r={1} fill={COLORS.WHITE} />
    </Svg>
  ),
  Warning: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M9 1L17 16H1L9 1Z" fill={COLORS.YELLOW} />
      <Path d="M9 6V10" stroke={COLORS.TEXT_BLACK} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={9} cy={13} r={1} fill={COLORS.TEXT_BLACK} />
    </Svg>
  ),
  Info: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={9} fill={COLORS.PRIMARY_BLUE} />
      <Circle cx={9} cy={5} r={1} fill={COLORS.WHITE} />
      <Path d="M9 8V13" stroke={COLORS.WHITE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
  Progress: () => (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={7} stroke={COLORS.PRIMARY_BLUE} strokeWidth={2} strokeDasharray="11 33" strokeLinecap="round" />
    </Svg>
  ),
  Close: () => (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M1 1L13 13M13 1L1 13" stroke={COLORS.LIGHT_GRAY} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
};

const TYPE_TO_ICON: Record<SnackbarType, keyof typeof Icons> = {
  success: 'Success',
  submitted: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  progress: 'Progress',
  pending: 'Progress',
};

const SnackbarDisplay = ({ type, title, description }: { type: SnackbarType; title?: string; description?: string }) => {
  const IconComponent = Icons[TYPE_TO_ICON[type]];

  return (
    <View style={styles.snackbar}>
      <View style={styles.snackbarContent}>
        <View style={styles.iconContainer}>
          <IconComponent />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.snackbarTitle} numberOfLines={2}>{title}</Text>
            <TouchableOpacity style={styles.closeButton}>
              <Icons.Close />
            </TouchableOpacity>
          </View>
          {description && <Text style={styles.snackbarDesc} numberOfLines={3}>{description}</Text>}
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// TYPE STORY TEMPLATE
// ============================================================================
interface TypeStoryProps {
  type: SnackbarType;
  title: string;
  description: string;
  useCase: string;
}

const TypeStory = ({ type, title, description, useCase }: TypeStoryProps) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{useCase}</Text>

    <Text style={styles.sectionLabel}>DEFAULT</Text>
    <SnackbarDisplay type={type} title={`${title} notification`} />

    <Text style={styles.sectionLabel}>WITH DESCRIPTION</Text>
    <SnackbarDisplay type={type} title={`${title} notification`} description={description} />
  </View>
);

// ============================================================================
// OVERVIEW
// ============================================================================
const OverviewStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Snackbar Overview</Text>
    <Text style={styles.description}>All snackbar types at a glance. Select a specific type from the sidebar for details.</Text>

    <View style={styles.overviewList}>
      {[
        { type: 'success' as const, label: 'Success', color: COLORS.SUCCESS_GREEN },
        { type: 'error' as const, label: 'Error', color: COLORS.DANGER_RED },
        { type: 'warning' as const, label: 'Warning', color: COLORS.WARNING_ORANGE },
        { type: 'info' as const, label: 'Info', color: COLORS.PRIMARY_BLUE },
        { type: 'progress' as const, label: 'Progress', color: COLORS.PRIMARY_BLUE },
        { type: 'pending' as const, label: 'Pending', color: COLORS.YELLOW },
        { type: 'submitted' as const, label: 'Submitted', color: COLORS.TEAL },
      ].map(({ type, label, color }) => (
        <View key={type} style={styles.overviewItem}>
          <View style={[styles.typeIndicator, { backgroundColor: color }]} />
          <Text style={styles.overviewLabel}>{label}</Text>
          <View style={styles.overviewSnackbar}>
            <SnackbarDisplay type={type} title={`${label} message`} />
          </View>
        </View>
      ))}
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<TypeStoryProps> = {
  title: 'Patterns/Snackbar',
};

export default meta;
type Story = StoryObj<TypeStoryProps>;

export const Overview: Story = {
  render: () => <OverviewStory />,
};

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Success',
    description: 'Your transaction has been confirmed on the blockchain.',
    useCase: 'Use for completed actions like successful transactions, saved settings, or confirmed operations.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Error: Story = {
  args: {
    type: 'error',
    title: 'Error',
    description: 'Insufficient funds to complete this transaction.',
    useCase: 'Use for failed operations, validation errors, or when something goes wrong.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Warning',
    description: 'Network congestion detected. Transactions may be delayed.',
    useCase: 'Use to caution users about potential issues or important information they should be aware of.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Info',
    description: 'New feature available! Check out vault management.',
    useCase: 'Use for general information, tips, or non-critical updates.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Progress: Story = {
  args: {
    type: 'progress',
    title: 'Progress',
    description: 'Broadcasting transaction to the network...',
    useCase: 'Use during ongoing operations like transaction broadcasting or data syncing.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Pending: Story = {
  args: {
    type: 'pending',
    title: 'Pending',
    description: 'Waiting for network confirmation.',
    useCase: 'Use when waiting for external confirmation like blockchain confirmations.',
  },
  render: (args) => <TypeStory {...args} />,
};

export const Submitted: Story = {
  args: {
    type: 'submitted',
    title: 'Submitted',
    description: 'Transaction broadcast to the network.',
    useCase: 'Use when a transaction has been submitted but not yet confirmed.',
  },
  render: (args) => <TypeStory {...args} />,
};

// ============================================================================
// STYLES - Matching actual Snackbar component (without absolute positioning)
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
    marginBottom: 12,
    marginTop: 24,
  },

  // Snackbar display - matches Snackbar.tsx styles
  snackbar: {
    backgroundColor: COLORS.DARK_CARD_BG,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  snackbarContent: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  snackbarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  snackbarDesc: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },

  // Overview
  overviewList: {
    gap: 12,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overviewLabel: {
    width: 80,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  overviewSnackbar: {
    flex: 1,
  },
});
