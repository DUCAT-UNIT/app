import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// SPLASH SCREEN COMPONENT
// ============================================================================
const SplashScreenDemo = () => (
  <View style={styles.splashContainer}>
    <Icon name="ducat_logo" size={100} />
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const ScreensStory = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Screens</Text>
    <Text style={styles.description}>
      Full-screen components used for app states like loading and transitions.
    </Text>

    <Text style={styles.sectionLabel}>SPLASH SCREEN</Text>
    <Text style={styles.sectionDesc}>
      Displayed on app launch and when returning from background. Shows the Ducat logo centered on a dark background.
    </Text>

    <View style={styles.screenFrame}>
      <SplashScreenDemo />
    </View>

    <Text style={styles.sectionLabel}>BEHAVIOR</Text>
    <View style={styles.behaviorList}>
      <View style={styles.behaviorItem}>
        <View style={styles.behaviorDot} />
        <Text style={styles.behaviorText}>Shows immediately on cold start</Text>
      </View>
      <View style={styles.behaviorItem}>
        <View style={styles.behaviorDot} />
        <Text style={styles.behaviorText}>Auto-hides after 2 seconds or when app is ready</Text>
      </View>
      <View style={styles.behaviorItem}>
        <View style={styles.behaviorDot} />
        <Text style={styles.behaviorText}>Reappears when app goes to background</Text>
      </View>
      <View style={styles.behaviorItem}>
        <View style={styles.behaviorDot} />
        <Text style={styles.behaviorText}>Protects sensitive information from app switcher</Text>
      </View>
    </View>

    <Text style={styles.sectionLabel}>SIZING</Text>
    <View style={styles.sizingDemo}>
      <View style={styles.sizeItem}>
        <View style={[styles.sizeFrame, { width: 60, height: 130 }]}>
          <Icon name="ducat_logo" size={30} />
        </View>
        <Text style={styles.sizeLabel}>iPhone SE</Text>
      </View>
      <View style={styles.sizeItem}>
        <View style={[styles.sizeFrame, { width: 70, height: 150 }]}>
          <Icon name="ducat_logo" size={40} />
        </View>
        <Text style={styles.sizeLabel}>iPhone 15</Text>
      </View>
      <View style={styles.sizeItem}>
        <View style={[styles.sizeFrame, { width: 80, height: 170 }]}>
          <Icon name="ducat_logo" size={50} />
        </View>
        <Text style={styles.sizeLabel}>iPhone 16 Pro Max</Text>
      </View>
    </View>
  </View>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta<typeof ScreensStory> = {
  title: 'Primitives/Screens',
  component: ScreensStory,
};

export default meta;
type Story = StoryObj<typeof ScreensStory>;

export const SplashScreen: Story = {};

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
    marginBottom: 8,
    marginTop: 24,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
    lineHeight: 20,
  },

  // Splash screen
  screenFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.BORDER_COLOR,
    height: 300,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Behavior list
  behaviorList: {
    gap: 12,
  },
  behaviorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  behaviorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  behaviorText: {
    fontSize: 14,
    color: COLORS.LIGHT_GRAY,
  },

  // Sizing demo
  sizingDemo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingVertical: 24,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
  },
  sizeItem: {
    alignItems: 'center',
  },
  sizeFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.BORDER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeLabel: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 8,
  },
});
