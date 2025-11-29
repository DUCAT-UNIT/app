/**
 * About Screen Story
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
}

interface StoryProps {
  screenSize: ScreenSize;
  version: string;
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

const SettingsOption = ({ iconName, title, onPress }: SettingsOptionProps) => (
  <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.optionLeft}>
      <Icon name={iconName} size={sizes.icon.md} color={colors.text.primary} />
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

const AboutScreenMock = ({ version }: { version: string }) => (
  <View style={styles.screenContainer}>
    <MutinynetBanner />
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
        <Icon name="back" size={sizes.icon.md} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.title}>About</Text>
    </View>
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.section}>
          <SettingsOption iconName="asset" title="Terms of Service" />
          <SettingsOption iconName="asset" title="Privacy Policy" />

          {/* Version Row (non-clickable, shows version text) */}
          <View style={styles.versionOption}>
            <View style={styles.optionLeft}>
              <Icon name="asset" size={sizes.icon.md} color={colors.text.primary} />
              <Text style={styles.optionTitle}>Version</Text>
            </View>
            <Text style={styles.versionText}>{version}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  </View>
);

// =============================================================================
// STORY WRAPPER
// =============================================================================

const AboutStory = ({ screenSize, version }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <AboutScreenMock version={version} />
      </View>
    </View>
  );
};

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings/About',
  parameters: {
    notes: 'About screen with legal links and version info',
  },
};

export default meta;
type Story = StoryObj;

export const Interactive: Story = {
  render: (args: StoryProps) => <AboutStory {...args} />,
  args: {
    screenSize: 'L',
    version: '1.0.0',
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
    },
    version: { control: { type: 'text' } },
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

  // Clickable List Item
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

  // Version Row (non-clickable)
  versionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.listItem.paddingVertical,
    paddingHorizontal: layout.listItem.paddingHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  versionText: {
    fontSize: fontSizes.sm,              // 14px
    fontFamily: fonts.regular,
    color: colors.text.secondary,        // #8E8D90 (NOT #888)
  },
});
