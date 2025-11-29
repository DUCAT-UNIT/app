/**
 * Settings Screen Story
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
  radii,
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
}

interface StoryProps {
  screenSize: ScreenSize;
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

/**
 * Settings List Option
 * Follows List Item (Settings Style) spec from design system
 */
const SettingsOption = ({ iconName, title, onPress }: SettingsOptionProps) => (
  <TouchableOpacity
    style={styles.option}
    onPress={onPress}
    activeOpacity={0.7} // Design system: touch feedback
  >
    <View style={styles.optionLeft}>
      <Icon
        name={iconName}
        size={sizes.icon.md}           // 24px - design system icon.md
        color={colors.text.primary}    // #DDDDDD
      />
      <Text style={styles.optionTitle}>{title}</Text>
    </View>
    <View style={styles.optionRight}>
      <Text style={styles.optionArrow}>&rsaquo;</Text>
    </View>
  </TouchableOpacity>
);

/**
 * Mutinynet Banner
 * Uses mutinynet.purple (#8B5CF6) - ONLY place this color should appear
 */
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

    {/* Navigation Header - per design system Navigation Bar spec */}
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
        <Icon
          name="back"
          size={sizes.icon.md}           // 24px
          color={colors.text.primary}    // #DDDDDD
        />
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
// STORY WRAPPER
// =============================================================================

const SettingsStory = ({ screenSize }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <SettingsScreenMock />
      </View>
    </View>
  );
};

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings',
  parameters: {
    notes: 'Main Settings screen following design system specifications',
  },
};

export default meta;
type Story = StoryObj;

export const Interactive: Story = {
  render: (args: StoryProps) => <SettingsStory {...args} />,
  args: {
    screenSize: 'L',
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
  },
};

// =============================================================================
// STYLES (Following Design System)
// =============================================================================

const styles = StyleSheet.create({
  // Story Container
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,    // #111015
    padding: spacing.lg,                   // 20px
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phone Frame (Storybook)
  phoneFrame: {
    backgroundColor: colors.bg.primary,    // #111015
    borderRadius: phoneFrame.borderRadius, // 24px
    borderWidth: phoneFrame.borderWidth,   // 3px
    borderColor: phoneFrame.borderColor,   // #28272C
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,             // 700px
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,    // #111015
  },

  // Mutinynet Banner
  mutinynetBanner: {
    backgroundColor: mutinynetBanner.backgroundColor, // #1D1C21
    paddingVertical: mutinynetBanner.paddingVertical, // 8px
    alignItems: 'center',
  },
  mutinynetBannerText: {
    color: mutinynetBanner.text.color,       // #8B5CF6 - ONLY here
    fontWeight: mutinynetBanner.text.fontWeight,
    fontSize: mutinynetBanner.text.fontSize, // 14px
    fontFamily: fonts.medium,
  },

  // Navigation Header
  header: {
    paddingHorizontal: layout.header.paddingHorizontal, // 20px
    paddingBottom: layout.header.paddingBottom,         // 20px
  },

  // Back Button (40x40 touch target)
  backButton: {
    width: sizes.backButton.width,   // 40px
    height: sizes.backButton.height, // 40px
    justifyContent: 'center',
  },

  // Screen Title (h1 - 32px Bold)
  title: {
    fontSize: fontSizes.xxxl,        // 32px
    fontWeight: fontWeights.bold,    // 700
    fontFamily: fonts.bold,
    color: colors.text.primary,      // #DDDDDD
    marginTop: spacing.xs,           // 4px spacing below back button
  },

  // Content Area
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screen.paddingHorizontal, // 20px
    paddingBottom: layout.screen.paddingBottom,         // 40px
  },

  // Section
  section: {
    marginBottom: spacing.lg,        // 20px
  },

  // List Item (Settings Style)
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.listItem.paddingVertical,     // 20px
    paddingHorizontal: layout.listItem.paddingHorizontal, // 4px
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,             // #28272C
  },

  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: layout.listItem.gap,        // 16px
  },

  // Option Title (body - 16px Regular)
  optionTitle: {
    fontSize: fontSizes.md,          // 16px
    fontFamily: fonts.regular,
    fontWeight: fontWeights.regular, // 400
    color: colors.text.primary,      // #DDDDDD
  },

  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,                 // 8px
  },

  // Chevron Arrow
  optionArrow: {
    fontSize: fontSizes.xl,          // 24px
    color: colors.text.tertiary,     // #47464A (NOT #666)
    marginLeft: spacing.xs,          // 4px
  },
});
