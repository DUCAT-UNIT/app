import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';

// ============================================================================
// DEVICE SIZE CONFIG
// ============================================================================
const DEVICE_CONFIGS = [
  { width: 320, height: 568, size: 'XS', label: 'iPhone 5', scale: 0.75 },
  { width: 375, height: 667, size: 'S', label: 'iPhone SE/8', scale: 0.85 },
  { width: 390, height: 844, size: 'M', label: 'iPhone 12/13/14', scale: 0.95 },
  { width: 393, height: 852, size: 'L', label: 'iPhone 14 Pro', scale: 1.0 },
  { width: 430, height: 932, size: 'XL', label: 'iPhone 16 Pro Max', scale: 1.05 },
];

type DeviceSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
type AuthContext = 'create' | 'confirm' | 'unlock';
type ErrorState = 'none' | 'wrong_pin' | 'mismatch' | 'locked';

const CONTEXT_CONFIG = {
  create: {
    title: 'Create a 6-digit PIN',
    subtitle: 'This PIN will be used with your passkey to encrypt your wallet',
  },
  confirm: {
    title: 'Confirm your PIN',
    subtitle: 'Enter your PIN again to confirm',
  },
  unlock: {
    title: 'Enter your PIN',
    subtitle: 'Enter the PIN you created with your passkey wallet',
  },
};

const ERROR_CONFIG = {
  none: { message: '', color: COLORS.WHITE },
  wrong_pin: { message: 'Wrong PIN. Try again.', color: COLORS.DANGER_RED },
  mismatch: { message: 'PINs don\'t match. Try again.', color: COLORS.DANGER_RED },
  locked: { message: 'Too many attempts. Try again in 5:00', color: COLORS.DANGER_RED },
};

// ============================================================================
// SCALED PIN INPUT COMPONENT
// ============================================================================
interface ScaledPinInputProps {
  title: string;
  subtitle: string;
  filledDots: number;
  scale: number;
  hasError?: boolean;
  isLocked?: boolean;
}

const ScaledPinInput = ({ title, subtitle, filledDots, scale, hasError = false, isLocked = false }: ScaledPinInputProps) => {
  const titleSize = 24 * scale;
  const subtitleSize = 14 * scale;
  const keySize = 32 * scale;
  const dotSize = 14 * scale;
  const keyPadding = 20 * scale;
  const keyGap = 28 * scale;
  const dotGap = 10 * scale;

  const dotColor = hasError ? COLORS.DANGER_RED : COLORS.WHITE;
  const emptyDotColor = COLORS.VERY_DARK_GRAY;

  return (
    <View style={scaledStyles.container}>
      {/* Cancel */}
      <Text style={[scaledStyles.cancelText, { fontSize: 16 * scale }]}>Cancel</Text>

      {/* Title */}
      <Text style={[scaledStyles.title, { fontSize: titleSize, marginBottom: 8 * scale }]}>{title}</Text>
      <Text style={[scaledStyles.subtitle, { fontSize: subtitleSize, marginBottom: 24 * scale, color: hasError ? COLORS.DANGER_RED : COLORS.LIGHT_GRAY }]}>{subtitle}</Text>

      {/* Dots */}
      <View style={[scaledStyles.dotsRow, { gap: dotGap, marginBottom: 32 * scale }]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              scaledStyles.dot,
              { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
              i < (isLocked ? 0 : filledDots)
                ? { backgroundColor: dotColor }
                : { backgroundColor: emptyDotColor },
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={[scaledStyles.keypad, { gap: 16 * scale }]}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ['', 0, 'del']].map((row, rowIndex) => (
          <View key={rowIndex} style={[scaledStyles.keypadRow, { gap: keyGap }]}>
            {row.map((key, keyIndex) => (
              <View
                key={keyIndex}
                style={[
                  scaledStyles.key,
                  { width: keyPadding * 3, height: keyPadding * 3 },
                ]}
              >
                {key === 'del' ? (
                  <Icon name="delete" size={24 * scale} color={COLORS.WHITE} />
                ) : key !== '' ? (
                  <Text style={[scaledStyles.keyText, { fontSize: keySize }]}>{key}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const scaledStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cancelText: {
    position: 'absolute',
    top: 60,
    left: 20,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  title: {
    color: COLORS.WHITE,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    backgroundColor: COLORS.WHITE,
  },
  keypad: {
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: COLORS.WHITE,
    fontWeight: '400',
  },
});

// ============================================================================
// CONFIGURABLE STORY
// ============================================================================
interface ConfigurableProps {
  context: AuthContext;
  deviceSize: DeviceSize;
  filledDots: number;
  errorState: ErrorState;
}

const ConfigurableStory = ({ context, deviceSize, filledDots, errorState }: ConfigurableProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === deviceSize) || DEVICE_CONFIGS[3];
  const contextConfig = CONTEXT_CONFIG[context];
  const errorConfig = ERROR_CONFIG[errorState];
  const hasError = errorState !== 'none';
  const isLocked = errorState === 'locked';

  return (
    <View style={styles.container}>
      <View style={[styles.deviceFrame, { width: config.width, height: config.height * 0.85 }]}>
        <ScaledPinInput
          title={contextConfig.title}
          subtitle={hasError ? errorConfig.message : contextConfig.subtitle}
          filledDots={filledDots}
          scale={config.scale}
          hasError={hasError}
          isLocked={isLocked}
        />
      </View>
    </View>
  );
};

// ============================================================================
// ERROR STATES STORY
// ============================================================================
const ErrorStatesStory = () => (
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {/* Wrong PIN */}
    <View style={styles.errorSection}>
      <View style={styles.errorHeader}>
        <View style={[styles.errorIndicator, { backgroundColor: COLORS.DANGER_RED }]} />
        <Text style={styles.errorLabel}>Wrong PIN</Text>
      </View>
      <View style={[styles.errorCard, { width: 320 }]}>
        <Text style={styles.errorTitle}>Enter your PIN</Text>
        <Text style={styles.errorMessage}>Wrong PIN. Try again.</Text>
        <View style={styles.errorDotsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.errorDot, styles.errorDotFilled]} />
          ))}
        </View>
        <Text style={styles.attemptsText}>2 attempts remaining</Text>
      </View>
    </View>

    {/* PIN Mismatch */}
    <View style={styles.errorSection}>
      <View style={styles.errorHeader}>
        <View style={[styles.errorIndicator, { backgroundColor: COLORS.WARNING_YELLOW }]} />
        <Text style={styles.errorLabel}>PIN Mismatch</Text>
      </View>
      <View style={[styles.errorCard, { width: 320 }]}>
        <Text style={styles.errorTitle}>Confirm your PIN</Text>
        <Text style={styles.errorMessage}>PINs don't match. Try again.</Text>
        <View style={styles.errorDotsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.errorDot, styles.errorDotFilled]} />
          ))}
        </View>
      </View>
    </View>

    {/* Locked Out */}
    <View style={styles.errorSection}>
      <View style={styles.errorHeader}>
        <View style={[styles.errorIndicator, { backgroundColor: COLORS.DANGER_RED }]} />
        <Text style={styles.errorLabel}>Locked Out</Text>
      </View>
      <View style={[styles.errorCard, { width: 320 }]}>
        <Icon name="lock" size={48} color={COLORS.DANGER_RED} style={styles.lockIcon} />
        <Text style={styles.errorTitle}>Too many attempts</Text>
        <Text style={styles.lockedMessage}>Try again in 5:00</Text>
        <View style={styles.errorDotsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.errorDot} />
          ))}
        </View>
      </View>
    </View>
  </ScrollView>
);

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
interface OverviewProps {
  context: AuthContext;
}

const DeviceSizeOverviewStory = ({ context }: OverviewProps) => {
  const contextConfig = CONTEXT_CONFIG[context];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {DEVICE_CONFIGS.map(({ width, height, size, label, scale }) => (
        <View key={width} style={styles.deviceSection}>
          <Text style={styles.sizeLabel}>{size}</Text>
          <Text style={styles.deviceLabel}>{label} ({width}px)</Text>
          <View style={[styles.deviceFrame, { width, height: height * 0.75 }]}>
            <ScaledPinInput
              title={contextConfig.title}
              subtitle={contextConfig.subtitle}
              filledDots={3}
              scale={scale}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/Authentication',
};

export default meta;
type Story = StoryObj;

export const PinInput: Story = {
  render: (args: ConfigurableProps) => <ConfigurableStory {...args} />,
  args: {
    context: 'unlock',
    deviceSize: 'L',
    filledDots: 0,
    errorState: 'none',
  },
  argTypes: {
    context: {
      control: { type: 'select' },
      options: ['create', 'confirm', 'unlock'],
      description: 'Authentication context',
    },
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size',
    },
    filledDots: {
      control: { type: 'range', min: 0, max: 6, step: 1 },
      description: 'Number of filled PIN dots',
    },
    errorState: {
      control: { type: 'select' },
      options: ['none', 'wrong_pin', 'mismatch', 'locked'],
      description: 'Error state',
    },
  },
};

export const ErrorStates: Story = {
  render: () => <ErrorStatesStory />,
};

export const DeviceSizeOverview: Story = {
  render: (args: OverviewProps) => <DeviceSizeOverviewStory {...args} />,
  args: {
    context: 'create',
  },
  argTypes: {
    context: {
      control: { type: 'select' },
      options: ['create', 'confirm', 'unlock'],
      description: 'Authentication context',
    },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    gap: 32,
    alignItems: 'center',
  },
  deviceSection: {
    gap: 8,
    alignItems: 'center',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.VERY_DARK_GRAY,
    overflow: 'hidden',
  },
  // Error states
  errorOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  errorSection: {
    gap: 12,
    alignItems: 'center',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  errorCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.DANGER_RED,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorDotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  errorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  errorDotFilled: {
    backgroundColor: COLORS.DANGER_RED,
  },
  attemptsText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  lockIcon: {
    marginBottom: 16,
  },
  lockedMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.DANGER_RED,
    marginBottom: 24,
  },
});
