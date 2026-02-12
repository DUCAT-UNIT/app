/**
 * Cashu Settings Screen Story
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
  isDanger?: boolean;
}

interface StoryProps {
  screenSize: ScreenSize;
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

const SettingsOption = ({ iconName, title, onPress, isDanger }: SettingsOptionProps) => (
  <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.optionLeft}>
      <Icon
        name={iconName}
        size={sizes.icon.md}
        color={isDanger ? colors.semantic.error : colors.text.primary}
      />
      <Text style={[styles.optionTitle, isDanger && styles.dangerText]}>{title}</Text>
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

const CashuSettingsScreenMock = () => (
  <View style={styles.screenContainer}>
    <MutinynetBanner />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
        <Icon name="back" size={sizes.icon.md} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.title}>Cashu</Text>
    </View>
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.section}>
          {/* Recovery Options */}
          <SettingsOption iconName="recovery_phrase" title="Recover Locked Change" />
          <SettingsOption iconName="recovery_phrase" title="Recover Failed Mint" />
          <SettingsOption iconName="asset" title="Redeem Cashu Token" />
          <SettingsOption iconName="recovery_phrase" title="Remove Spent Proofs" />

          {/* Danger Zone */}
          <SettingsOption iconName="delete_wallet" title="Clear Locked Tokens History" isDanger />
          <SettingsOption iconName="delete_wallet" title="Clear Cashu Cache" isDanger />
        </View>
      </View>
    </ScrollView>
  </View>
);

// =============================================================================
// STORY WRAPPER
// =============================================================================

const CashuStory = ({ screenSize }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <CashuSettingsScreenMock />
      </View>
    </View>
  );
};

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings/Cashu',
  parameters: {
    notes: 'Cashu-specific settings with recovery and cache options',
  },
};

export default meta;
export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <CashuStory {...args} />,
  args: {
    screenSize: 'L',
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
    },
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
    color: colors.text.tertiary,         // #47464A
    marginLeft: spacing.xs,
  },

  // Danger Text (for destructive actions)
  dangerText: {
    color: colors.semantic.error,        // #D04C68
  },
});
