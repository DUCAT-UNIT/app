/**
 * Preferences Screen Story
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
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface SettingsOptionProps {
  iconName: string;
  title: string;
  onPress?: () => void;
  rightText?: string;
}

interface StoryProps {
  screenSize: ScreenSize;
  showZeroAssets: boolean;
  notificationsEnabled: boolean;
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

const SettingsOption = ({ iconName, title, onPress, rightText }: SettingsOptionProps) => (
  <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.optionLeft}>
      <Icon name={iconName} size={sizes.icon.md} color={colors.text.primary} />
      <Text style={styles.optionTitle}>{title}</Text>
    </View>
    <View style={styles.optionRight}>
      {rightText && <Text style={styles.optionRightText}>{rightText}</Text>}
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

const PreferencesScreenMock = ({ showZeroAssets, notificationsEnabled }: { showZeroAssets: boolean; notificationsEnabled: boolean }) => (
  <View style={styles.screenContainer}>
    <MutinynetBanner />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
        <Icon name="back" size={sizes.icon.md} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.title}>Preferences</Text>
    </View>
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.section}>
          <SettingsOption
            iconName="asset"
            title="Show Zero Value Assets"
            rightText={showZeroAssets ? 'ON' : 'OFF'}
          />
          <SettingsOption
            iconName="notification"
            title="Notifications"
            rightText={notificationsEnabled ? 'ON' : 'OFF'}
          />
        </View>
      </View>
    </ScrollView>
  </View>
);

// =============================================================================
// STORY WRAPPER
// =============================================================================

const PreferencesStory = ({ screenSize, showZeroAssets, notificationsEnabled }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <PreferencesScreenMock showZeroAssets={showZeroAssets} notificationsEnabled={notificationsEnabled} />
      </View>
    </View>
  );
};

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings/Preferences',
  parameters: {
    notes: 'User preferences settings screen',
  },
};

export default meta;
export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <PreferencesStory {...args} />,
  args: {
    screenSize: 'L',
    showZeroAssets: true,
    notificationsEnabled: true,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
    },
    showZeroAssets: { control: { type: 'boolean' } },
    notificationsEnabled: { control: { type: 'boolean' } },
  },
};

// =============================================================================
// STYLES (Following Design System)
// =============================================================================

const styles = StyleSheet.create({
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    backgroundColor: colors.bg.primary,
    borderRadius: phoneFrame.borderRadius,
    borderWidth: phoneFrame.borderWidth,
    borderColor: phoneFrame.borderColor,
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screen.paddingHorizontal,
    paddingBottom: layout.screen.paddingBottom,
  },
  section: {
    marginBottom: layout.section.marginBottom,
  },
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
  optionRightText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,        // #8E8D90
  },
  optionArrow: {
    fontSize: fontSizes.xl,
    color: colors.text.tertiary,         // #47464A
    marginLeft: spacing.xs,
  },
});
