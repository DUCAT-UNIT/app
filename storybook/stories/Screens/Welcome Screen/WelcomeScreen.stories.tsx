/**
 * Welcome Screen Story
 * Matches the actual InitialWelcome component from the app
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  radii,
  phoneFrame,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
}

// =============================================================================
// SCREEN MOCK
// =============================================================================

/**
 * Welcome Screen Mock
 * Exact replica of the actual InitialWelcome component
 * - Centered ducat_logo icon (100px)
 * - Title: "DUCΔT"
 * - Tagline: "A Decentralised Credit Platform"
 * - Two buttons: Create / Restore
 */
const WelcomeScreenMock = () => (
  <View style={styles.screenContainer}>
    {/* Logo Section */}
    <View style={styles.content}>
      <Icon name="ducat_logo" size={100} />
    </View>

    {/* Buttons Section */}
    <View style={styles.buttonsSection}>
      <Text style={styles.title}>DUCΔT</Text>
      <Text style={styles.tagline} numberOfLines={1} adjustsFontSizeToFit>
        A Decentralised Credit Platform
      </Text>

      {/* Primary Button */}
      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.7}>
        <Text style={styles.buttonText}>Create a new wallet</Text>
      </TouchableOpacity>

      {/* Secondary Button */}
      <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
        <Text style={styles.buttonText}>Restore an existing wallet</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// =============================================================================
// STORY WRAPPER
// =============================================================================

const WelcomeStory = ({ screenSize }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <WelcomeScreenMock />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

const WelcomeOverview = () => (
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
          <WelcomeScreenMock />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Welcome Screen',
  parameters: {
    notes: 'Initial welcome screen with create/restore wallet options. First screen users see when no wallet exists.',
  },
};

export default meta;
type Story = StoryObj;

// Interactive story with device size selector
export const Interactive: Story = {
  render: (args: StoryProps) => <WelcomeStory {...args} />,
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

// Overview showing all device sizes
export const Overview: Story = {
  render: () => <WelcomeOverview />,
  parameters: {
    notes: 'Overview of Welcome screen across all device sizes',
  },
};

// =============================================================================
// STYLES (Following Design System)
// =============================================================================

const styles = StyleSheet.create({
  // Story Container
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Screen Container (matches actual welcomeContainer)
  screenContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,              // 20px
    paddingTop: 0,
    paddingBottom: spacing.lg,                  // 20px
    backgroundColor: colors.bg.primary,         // #111015
  },

  // Content (logo area)
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Buttons Section
  buttonsSection: {
    width: '100%',
    paddingBottom: spacing.lg + 20,             // 40px
  },

  // Title
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,                     // 24px
    fontWeight: fontWeights.bold,
    color: colors.text.primary,                 // #DDDDDD
    marginBottom: spacing.sm,                   // 8px
    textAlign: 'center',
    paddingHorizontal: spacing.sm + 4,          // 12px
  },

  // Tagline
  tagline: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,                     // 16px
    fontWeight: fontWeights.regular,
    color: colors.text.primary,                 // #DDDDDD
    marginBottom: spacing.xl,                   // 32px
    textAlign: 'center',
    paddingHorizontal: spacing.sm + 4,          // 12px
  },

  // Primary Button
  primaryButton: {
    backgroundColor: colors.brand.primary,      // #1858E4
    paddingVertical: spacing.md,                // 16px
    paddingHorizontal: spacing.lg,              // 20px
    borderRadius: radii.lg,                     // 12px
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,                      // 8px
    width: '100%',
  },

  // Secondary Button
  secondaryButton: {
    backgroundColor: colors.bg.tertiary,        // #28272C
    paddingVertical: spacing.md,                // 16px
    paddingHorizontal: spacing.lg,              // 20px
    borderRadius: radii.lg,                     // 12px
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,                      // 8px
    width: '100%',
  },

  // Button Text
  buttonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,                     // 16px
    fontWeight: fontWeights.semibold,           // 600
    color: colors.text.primary,                 // #DDDDDD
  },

  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  overviewContent: {
    padding: spacing.lg,
    gap: spacing.xxl,
    alignItems: 'center',
  },

  // Device Row
  deviceRow: {
    alignItems: 'center',
  },

  // Device Label
  deviceLabel: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceSize: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  deviceName: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  deviceWidth: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
