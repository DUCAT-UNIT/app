/**
 * Splash Screen Story
 * Matches the actual SplashScreen component from the app
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
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
 * Splash Screen Mock
 * Exact replica of the actual SplashScreen component
 * - Centered ducat_logo icon (100px)
 * - Dark background (bg.primary)
 */
const SplashScreenMock = () => (
  <View style={styles.screenContainer}>
    <Icon name="ducat_logo" size={100} />
  </View>
);

// =============================================================================
// STORY WRAPPER
// =============================================================================

const SplashStory = ({ screenSize }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <SplashScreenMock />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

const SplashOverview = () => (
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
          <SplashScreenMock />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Splash Screen',
  parameters: {
    notes: 'Splash screen displayed on app launch and when backgrounded. Shows centered Ducat logo.',
  },
};

export default meta;
// Interactive story with device size selector
export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <SplashStory {...args} />,
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
export const Overview: StoryObj = {
  render: () => <SplashOverview />,
  parameters: {
    notes: 'Overview of Splash screen across all device sizes',
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

  // Screen Container (matches actual SplashScreen)
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,    // #111015
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',            // Slightly darker for contrast
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
