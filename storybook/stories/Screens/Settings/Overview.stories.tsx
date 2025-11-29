/**
 * Settings Overview Story
 * Shows all device sizes in a vertical layout
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  sizes,
  layout,
  phoneFrame,
  mutinynetBanner,
  DEVICE_CONFIGS,
} from '../../design-tokens';

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface SettingsOptionProps {
  iconName: string;
  title: string;
}

const SettingsOption = ({ iconName, title }: SettingsOptionProps) => (
  <TouchableOpacity style={styles.option} activeOpacity={0.7}>
    <View style={styles.optionLeft}>
      <Icon
        name={iconName}
        size={sizes.icon.md}
        color={colors.text.primary}
      />
      <Text style={styles.optionTitle}>{title}</Text>
    </View>
    <View style={styles.optionRight}>
      <Text style={styles.optionArrow}>&rsaquo;</Text>
    </View>
  </TouchableOpacity>
);

const MutinynetBanner = () => (
  <View style={styles.mutinynetBanner}>
    <Text style={styles.mutinynetBannerText}>Mutinynet Edition</Text>
  </View>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

const SettingsScreenMock = () => (
  <View style={styles.screenContainer}>
    <MutinynetBanner />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
        <Icon name="back" size={sizes.icon.md} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.title}>Settings</Text>
    </View>
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.section}>
          <SettingsOption iconName="asset" title="Preferences" />
          <SettingsOption iconName="face_id" title="Security" />
          <SettingsOption iconName="switch_account" title="Advanced" />
          <SettingsOption iconName="asset" title="Cashu" />
          <SettingsOption iconName="logout" title="Lock Wallet" />
          <SettingsOption iconName="asset" title="About" />
        </View>
      </View>
    </ScrollView>
  </View>
);

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

const SettingsOverview = () => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        {/* Device Label */}
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>

        {/* Phone Frame */}
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <SettingsScreenMock />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings/Overview',
  parameters: {
    notes: 'Overview of Settings screen across all device sizes',
  },
};

export default meta;
type Story = StoryObj;

export const AllSizes: Story = {
  render: () => <SettingsOverview />,
};

// =============================================================================
// STYLES (Following Design System)
// =============================================================================

const styles = StyleSheet.create({
  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Slightly darker for contrast
  },
  overviewContent: {
    padding: spacing.lg,                   // 20px
    gap: spacing.xxl - 8,                  // 40px
    alignItems: 'center',
  },

  // Device Row
  deviceRow: {
    alignItems: 'center',
  },

  // Device Label
  deviceLabel: {
    alignItems: 'center',
    marginBottom: spacing.lg - 12,         // 12px
  },
  deviceSize: {
    fontSize: fontSizes.xl,                // 24px
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,            // #DDDDDD
  },
  deviceName: {
    fontSize: fontSizes.xs,                // 12px
    fontFamily: fonts.regular,
    color: colors.text.secondary,          // #8E8D90
    marginTop: spacing.xs,                 // 4px
  },
  deviceWidth: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,           // #47464A
    marginTop: 2,
  },

  // Phone Frame
  phoneFrame: {
    backgroundColor: colors.bg.primary,
    borderRadius: phoneFrame.borderRadius,
    borderWidth: phoneFrame.borderWidth,
    borderColor: phoneFrame.borderColor,
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Mutinynet Banner
  mutinynetBanner: {
    backgroundColor: mutinynetBanner.backgroundColor,
    paddingVertical: mutinynetBanner.paddingVertical,
    alignItems: 'center',
  },
  mutinynetBannerText: {
    color: mutinynetBanner.text.color,
    fontWeight: mutinynetBanner.text.fontWeight,
    fontSize: mutinynetBanner.text.fontSize,
    fontFamily: fonts.medium,
  },

  // Navigation Header
  header: {
    paddingHorizontal: layout.header.paddingHorizontal,
    paddingBottom: layout.header.paddingBottom,
  },
  backButton: {
    width: sizes.backButton.width,
    height: sizes.backButton.height,
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screen.paddingHorizontal,
    paddingBottom: layout.screen.paddingBottom,
  },
  section: {
    marginBottom: spacing.lg,
  },

  // List Item
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.listItem.paddingVertical,
    paddingHorizontal: layout.listItem.paddingHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: layout.listItem.gap,
  },
  optionTitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionArrow: {
    fontSize: fontSizes.xl,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
});
