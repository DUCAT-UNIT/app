/**
 * Authentication / PIN Screen Stories
 * Matches the actual LockScreen component from the app
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
  phoneFrame,
  mutinynetBanner,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// SCALED MUTINYNET BANNER
// =============================================================================

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
// KEYPAD COMPONENT
// =============================================================================

interface KeypadProps {
  showFaceID?: boolean;
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['face_id', '0', 'delete'],
];

const Keypad = ({ showFaceID = true }: KeypadProps) => (
  <View style={styles.keypad}>
    {KEYPAD_ROWS.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keypadRow}>
        {row.map((key) => {
          if (key === 'face_id') {
            return showFaceID ? (
              <TouchableOpacity key={key} style={styles.key} activeOpacity={0.7}>
                <Icon name="face_id" size={28} color={colors.brand.primary} />
              </TouchableOpacity>
            ) : (
              <View key={key} style={styles.key} />
            );
          }
          if (key === 'delete') {
            return (
              <TouchableOpacity key={key} style={styles.key} activeOpacity={0.7}>
                <Icon name="delete" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity key={key} style={styles.key} activeOpacity={0.7}>
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ))}
  </View>
);

// =============================================================================
// PIN DOTS COMPONENT
// =============================================================================

interface PinDotsProps {
  filledCount: number;
  total?: number;
  hasError?: boolean;
}

const PinDots = ({ filledCount, total = 6, hasError = false }: PinDotsProps) => (
  <View style={styles.pinDots}>
    {Array(total).fill(0).map((_, index) => (
      <View
        key={index}
        style={[
          styles.pinDot,
          index < filledCount && styles.pinDotFilled,
          hasError && index < filledCount && styles.pinDotError,
        ]}
      />
    ))}
  </View>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

type AuthState = 'enterPin' | 'confirmPin' | 'wrongPin' | 'pinsDontMatch';

interface PinScreenMockProps {
  size?: ScreenSize;
  filledDots?: number;
  authState?: AuthState;
  showFaceID?: boolean;
}

const getTitle = (authState: AuthState) => {
  switch (authState) {
    case 'enterPin': return 'Enter your PIN';
    case 'confirmPin': return 'Confirm PIN';
    case 'wrongPin': return 'Enter your PIN';
    case 'pinsDontMatch': return 'Confirm PIN';
  }
};

const getSubtitle = (authState: AuthState) => {
  switch (authState) {
    case 'enterPin': return '';
    case 'confirmPin': return 'Re-enter your PIN to confirm';
    case 'wrongPin': return '';
    case 'pinsDontMatch': return 'Re-enter your PIN to confirm';
  }
};

const getErrorMessage = (authState: AuthState) => {
  switch (authState) {
    case 'wrongPin': return 'Wrong PIN. Try again.';
    case 'pinsDontMatch': return "PINs don't match. Try again.";
    default: return '';
  }
};

const PinScreenMock = ({
  size = 'L',
  filledDots = 0,
  authState = 'enterPin',
  showFaceID = true,
}: PinScreenMockProps) => {
  const hasError = authState === 'wrongPin' || authState === 'pinsDontMatch';
  const errorMessage = getErrorMessage(authState);
  const subtitle = getSubtitle(authState);

  return (
    <View style={styles.screenContainer}>
      <ScaledMutinynetBanner size={size} />
      <View style={styles.contentContainer}>
        <View style={styles.topSection}>
          <Text style={styles.title}>{getTitle(authState)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <PinDots filledCount={filledDots} hasError={hasError} />
          {hasError && (
            <View style={styles.errorContainer}>
              <Icon name="warning" size={16} color={colors.semantic.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </View>
        <Keypad showFaceID={showFaceID} />
      </View>
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
  filledDots: number;
  authState: AuthState;
  showFaceID: boolean;
}

const PinStory = ({ screenSize, filledDots, authState, showFaceID }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      <View style={[styles.phoneFrame, { width: config.width }]}>
        <PinScreenMock
          size={config.size}
          filledDots={filledDots}
          authState={authState}
          showFaceID={showFaceID}
        />
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

interface OverviewProps {
  filledDots: number;
  authState: AuthState;
  showFaceID: boolean;
}

const PinOverview = ({ filledDots, authState, showFaceID }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <PinScreenMock
            size={config.size}
            filledDots={filledDots}
            authState={authState}
            showFaceID={showFaceID}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/Authentication',
  parameters: {
    notes: 'PIN authentication screen with keypad and biometric option.',
  },
};

export default meta;
// =============================================================================
// STORIES
// =============================================================================

export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <PinStory {...args} />,
  args: {
    screenSize: 'L',
    filledDots: 3,
    authState: 'enterPin',
    showFaceID: true,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    filledDots: {
      control: { type: 'range', min: 0, max: 6, step: 1 },
      description: 'Number of PIN digits entered',
    },
    authState: {
      control: { type: 'select' },
      options: ['enterPin', 'confirmPin', 'wrongPin', 'pinsDontMatch'],
      description: 'Authentication state',
    },
    showFaceID: {
      control: { type: 'boolean' },
      description: 'Show Face ID button',
    },
  },
};

export const Overview: StoryObj<OverviewProps> = {
  render: (args) => <PinOverview {...args} />,
  args: {
    filledDots: 3,
    authState: 'enterPin',
    showFaceID: true,
  },
  argTypes: {
    filledDots: {
      control: { type: 'range', min: 0, max: 6, step: 1 },
      description: 'Number of PIN digits entered',
    },
    authState: {
      control: { type: 'select' },
      options: ['enterPin', 'confirmPin', 'wrongPin', 'pinsDontMatch'],
      description: 'Authentication state',
    },
    showFaceID: {
      control: { type: 'boolean' },
      description: 'Show Face ID button',
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

  // Content Container
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Top Section (title + dots + error)
  topSection: {
    alignItems: 'center',
  },

  // Title
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.text.primary,
    marginBottom: 8,
  },

  // Subtitle
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: 24,
  },

  // PIN Dots
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: spacing.md,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
  },
  pinDotFilled: {
    backgroundColor: colors.text.primary,
  },
  pinDotError: {
    backgroundColor: colors.semantic.error,
  },

  // Error Container
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  // Error Text
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.semantic.error,
  },

  // Keypad
  keypad: {
    width: '100%',
    maxWidth: 352,
    paddingHorizontal: spacing.lg,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: 32,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  keyText: {
    fontFamily: fonts.regular,
    fontSize: 32,
    color: colors.text.primary,
    fontWeight: fontWeights.regular,
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
