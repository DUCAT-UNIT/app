/**
 * Advanced Screen Story
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
  rightText?: string;
}

interface StoryProps {
  screenSize: ScreenSize;
  advancedMode: boolean;
  ecashThreshold: number;
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

const AdvancedScreenMock = ({ advancedMode, ecashThreshold }: { advancedMode: boolean; ecashThreshold: number }) => {
  const getThresholdDisplay = () => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${ecashThreshold} UNIT`;
  };

  return (
    <View style={styles.screenContainer}>
      <MutinynetBanner />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
          <Icon name="back" size={sizes.icon.md} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Advanced</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Options Section */}
          <View style={styles.section}>
            <SettingsOption
              iconName="asset"
              title="Developer Mode"
              rightText={advancedMode ? 'ON' : 'OFF'}
            />
            <SettingsOption
              iconName="unit_logo"
              title="Ecash Default"
              rightText={getThresholdDisplay()}
            />
            <SettingsOption iconName="switch_account" title="Select Account" />
          </View>

          {/* Troubleshooting Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Troubleshooting</Text>
            <TouchableOpacity style={styles.clearCacheButton} activeOpacity={0.7}>
              <View style={styles.clearCacheContent}>
                <Icon
                  name="delete"
                  size={sizes.icon.md}
                  color={colors.semantic.error}  // #D04C68 (NOT #FF6B6B)
                />
                <View style={styles.clearCacheTextContainer}>
                  <Text style={styles.clearCacheTitle}>Clear App Cache</Text>
                  <Text style={styles.clearCacheSubtitle}>
                    Fixes issues with P2PK tokens and other problems
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

const AdvancedStory = ({ screenSize, advancedMode, ecashThreshold }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <AdvancedScreenMock advancedMode={advancedMode} ecashThreshold={ecashThreshold} />
      </View>
    </View>
  );
};

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Settings/Advanced',
  parameters: {
    notes: 'Advanced settings screen with developer options and troubleshooting',
  },
};

export default meta;
export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <AdvancedStory {...args} />,
  args: {
    screenSize: 'L',
    advancedMode: false,
    ecashThreshold: 100,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
    },
    advancedMode: { control: { type: 'boolean' } },
    ecashThreshold: { control: { type: 'number' } },
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

  // Section Title (uppercase label)
  sectionTitle: {
    fontSize: fontSizes.sm,              // 14px
    fontWeight: fontWeights.semibold,    // 600
    fontFamily: fonts.medium,
    color: colors.text.secondary,        // #8E8D90
    marginBottom: spacing.md,            // 16px
    textTransform: 'uppercase',
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

  // Clear Cache Button (Card-style danger button)
  clearCacheButton: {
    backgroundColor: colors.bg.secondary,           // #1D1C21
    borderRadius: radii.lg,                         // 12px
    padding: spacing.md,                            // 16px
    borderWidth: 1,
    borderColor: `${colors.semantic.error}30`,      // #D04C68 with 30% opacity
  },
  clearCacheContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,                                // 16px
  },
  clearCacheTextContainer: {
    flex: 1,
  },
  clearCacheTitle: {
    fontSize: fontSizes.md,                         // 16px
    fontWeight: fontWeights.semibold,               // 600
    fontFamily: fonts.medium,
    color: colors.semantic.error,                   // #D04C68
  },
  clearCacheSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.text.secondary,                   // #8E8D90
    marginTop: spacing.xs,                          // 4px
  },
});
