/**
 * Seed Phrase Screen Stories
 * Matches the actual SeedPhraseDisplay and SeedPhraseVerify components
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  radii,
  phoneFrame,
  mutinynetBanner,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// SCALED MUTINYNET BANNER
// =============================================================================

// Device-specific banner sizing
const BANNER_SIZES = {
  XS: { fontSize: 12, paddingV: 6 },
  S: { fontSize: 13, paddingV: 7 },
  M: { fontSize: 14, paddingV: 8 },
  L: { fontSize: 14, paddingV: 8 },
  XL: { fontSize: 15, paddingV: 10 },
};

const ScaledMutinynetBanner = ({ size = 'L' }: { size?: ScreenSize }) => {
  const config = BANNER_SIZES[size];
  return (
    <View style={[styles.mutinynetBanner, { paddingVertical: config.paddingV }]}>
      <Text style={[styles.mutinynetBannerText, { fontSize: config.fontSize }]}>
        Mutinynet Edition
      </Text>
    </View>
  );
};

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_SEED_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent',
  'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
];

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
}

// =============================================================================
// SEED PHRASE DISPLAY MOCK
// =============================================================================

/**
 * Seed Phrase Display Mock
 * Step 2: Shows the 12 seed words to the user
 */
const SeedPhraseDisplayMock = ({ size = 'L', showWords = true }: { size?: ScreenSize; showWords?: boolean }) => (
  <View style={styles.screenContainer}>
    <ScaledMutinynetBanner size={size} />
    <View style={styles.contentContainer}>
      <Text style={styles.stepIndicator}>Step 2 of 4</Text>

      <Text style={styles.label}>Write down these 12 words:</Text>

      <View style={styles.seedGrid}>
        {MOCK_SEED_WORDS.map((word, index) => (
          <View key={index} style={styles.seedBox}>
            <Text style={styles.seedNumber}>{index + 1}</Text>
            <Text style={styles.seedWord}>{showWords ? word : '••••••'}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.warning}>Write them down and keep them safe!</Text>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.7}>
        <Text style={styles.buttonText}>I've Written Them Down</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// =============================================================================
// IMPORT WALLET MOCK (Enter Seed Phrase)
// =============================================================================

/**
 * Import Wallet Mock
 * Enter 12-word seed phrase to restore wallet
 * Dynamically scales based on device width
 */
const ImportWalletMock = ({ scale = 1, width = 393, size = 'L' }: { scale?: number; width?: number; size?: ScreenSize }) => {
  const isSmall = scale <= 0.85; // XS and S
  const inputWidth = isSmall ? Math.floor(width * 2 / 7) : Math.floor(width / 3); // 2/7 on small, 1/3 on larger

  const dynamicStyles = {
    seedInputContainer: {
      marginBottom: 6,
      width: '47%',
    },
    seedInputNumber: {
      fontSize: 11,
      width: 18,
      marginRight: 6,
    },
    seedInput: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 12,
      borderRadius: 6,
      width: inputWidth,
    },
  };

  return (
    <View style={styles.screenContainer}>
      <ScaledMutinynetBanner size={size} />
      <View style={styles.contentContainer}>
        <Text style={styles.stepIndicator}>Import Wallet</Text>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Enter your 12-word seed phrase:</Text>
          <TouchableOpacity style={styles.ghostButton} activeOpacity={0.7}>
            <Text style={styles.ghostButtonText}>Paste</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.seedInputGrid}>
          {Array(12).fill('').map((_, index) => (
            <View key={index} style={[styles.seedInputContainer, dynamicStyles.seedInputContainer]}>
              <Text style={[styles.seedInputNumber, dynamicStyles.seedInputNumber]}>{index + 1}</Text>
              <TextInput
                style={[styles.seedInput, dynamicStyles.seedInput]}
                placeholder={`Word ${index + 1}`}
                placeholderTextColor="#666666"
                editable={false}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.7}>
          <Text style={styles.buttonText}>Import Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

type ViewType = 'Display' | 'Import';

interface OverviewProps {
  view: ViewType;
  showWords: boolean;
}

const SeedPhraseOverview = ({ view, showWords }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          {view === 'Display' ? (
            <SeedPhraseDisplayMock size={config.size} showWords={showWords} />
          ) : (
            <ImportWalletMock scale={config.scale} width={config.width} size={config.size} />
          )}
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Seed Phrase',
  parameters: {
    notes: 'Seed phrase display and verification screens during wallet creation flow.',
  },
};

export default meta;
type Story = StoryObj;

// =============================================================================
// STORIES
// =============================================================================

interface InteractiveProps extends StoryProps {
  view: ViewType;
  showWords: boolean;
}

const InteractiveStory = ({ screenSize, view, showWords }: InteractiveProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        {view === 'Display' ? (
          <SeedPhraseDisplayMock size={config.size} showWords={showWords} />
        ) : (
          <ImportWalletMock scale={config.scale} width={config.width} size={config.size} />
        )}
      </View>
    </View>
  );
};

export const Interactive: Story = {
  render: (args: InteractiveProps) => <InteractiveStory {...args} />,
  args: {
    screenSize: 'L',
    view: 'Display',
    showWords: true,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    view: {
      control: { type: 'select' },
      options: ['Display', 'Import'],
      description: 'Screen view',
    },
    showWords: {
      control: { type: 'boolean' },
      description: 'Show/Hide seed words (Display only)',
      if: { arg: 'view', eq: 'Display' },
    },
  },
};

export const Overview: Story = {
  render: (args: OverviewProps) => <SeedPhraseOverview {...args} />,
  args: {
    view: 'Display',
    showWords: true,
  },
  argTypes: {
    view: {
      control: { type: 'select' },
      options: ['Display', 'Import'],
      description: 'Screen view',
    },
    showWords: {
      control: { type: 'boolean' },
      description: 'Show/Hide seed words (Display only)',
      if: { arg: 'view', eq: 'Display' },
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

  // Mutinynet Banner
  mutinynetBanner: {
    backgroundColor: mutinynetBanner.backgroundColor,
    alignItems: 'center',
    width: '100%',
  },
  mutinynetBannerText: {
    color: mutinynetBanner.text.color,
    fontWeight: mutinynetBanner.text.fontWeight,
    fontFamily: fonts.medium,
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bg.primary,
  },

  // Content Container (has padding)
  contentContainer: {
    flex: 1,
    padding: spacing.lg,
  },

  // Step Indicator
  stepIndicator: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    marginBottom: 12,
    textAlign: 'center',
  },

  // Label Row
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  // Label
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.text.secondary,
  },

  // Ghost Button
  ghostButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.brand.primary,
  },

  // Warning
  warning: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.semantic.error,
    marginTop: 16,
    textAlign: 'center',
  },

  // Seed Grid
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // Seed Box
  seedBox: {
    width: '48%',
    backgroundColor: colors.bg.secondary,
    padding: 16,
    borderRadius: radii.md,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Seed Number
  seedNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
    marginRight: 8,
    minWidth: 20,
  },

  // Seed Word
  seedWord: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },

  // Seed Input Grid (Import Wallet) - exact match to app seedWordsGrid
  seedInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginBottom: 24,
    width: '100%',
  },
  seedInputContainer: {
    width: '47%',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedInputNumber: {
    color: colors.text.primary,
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    width: 20,
    textAlign: 'right',
    marginRight: 8,
  },
  seedInput: {
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    fontFamily: fonts.regular,
  },

  // Primary Button
  primaryButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    width: '100%',
  },

  // Secondary Button
  secondaryButton: {
    backgroundColor: colors.bg.tertiary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },

  // Button Text
  buttonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
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
