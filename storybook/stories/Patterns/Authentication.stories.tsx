import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS, BORDER_RADIUS } from '../../../theme';
import Icon from '../../../components/icons';
import Snackbar from '../../../components/Snackbar';
import styles from '../../../styles';

// PIN Input Component (renders the PIN UI without MutinynetBanner)
const PinInput = ({
  title,
  subtitle,
  initialPin = '',
}: {
  title: string;
  subtitle: string;
  initialPin?: string;
}) => {
  const [pin, setPin] = useState(initialPin);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) {
        setTimeout(() => setPin(''), 500);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={localStyles.container}>
      <TouchableOpacity style={localStyles.cancelButton}>
        <Text style={localStyles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <View style={localStyles.contentWrapper}>
        <View style={localStyles.pinContainer}>
          <Text style={styles.lockTitle}>{title}</Text>
          <Text style={localStyles.subtitle}>{subtitle}</Text>

          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < pin.length && styles.lockPinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.lockKeypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handleDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handleDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lockKey} onPress={handleDelete}>
                <Icon name="delete" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// PIN Input with Snackbar error overlay
const PinInputWithError = ({
  title,
  subtitle,
  errorMessage,
  initialPin = '',
}: {
  title: string;
  subtitle: string;
  errorMessage: string;
  initialPin?: string;
}) => {
  const [pin, setPin] = useState(initialPin);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={localStyles.container}>
      {/* Snackbar positioned at top like in real app */}
      <View style={localStyles.snackbarContainer}>
        <Snackbar
          params={{
            type: 'error',
            message: errorMessage,
          }}
          onClose={() => {}}
        />
      </View>

      <TouchableOpacity style={localStyles.cancelButton}>
        <Text style={localStyles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <View style={localStyles.contentWrapper}>
        <View style={localStyles.pinContainer}>
          <Text style={styles.lockTitle}>{title}</Text>
          <Text style={localStyles.subtitle}>{subtitle}</Text>

          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < pin.length && styles.lockPinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.lockKeypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handleDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handleDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lockKey} onPress={handleDelete}>
                <Icon name="delete" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// DEFAULT STORY - Basic PIN Input
// ============================================================================
const DefaultStory = () => (
  <PinInput title="Enter PIN" subtitle="Enter your 6-digit PIN" />
);

// ============================================================================
// CREATE PASSKEY STORY
// ============================================================================
const CreatePasskeyStory = () => (
  <PinInput
    title="Create a 6-digit PIN"
    subtitle="This PIN will be used with your passkey to encrypt your wallet"
  />
);

// ============================================================================
// CONFIRM PIN STORY
// ============================================================================
const ConfirmPinStory = () => (
  <PinInput
    title="Confirm your PIN"
    subtitle="Enter your PIN again to confirm"
    initialPin="123"
  />
);

// ============================================================================
// UNLOCK WALLET STORY (Restore with Passkey)
// ============================================================================
const UnlockWalletStory = () => (
  <PinInput
    title="Enter your PIN"
    subtitle="Enter the PIN you created with your passkey wallet"
  />
);

// ============================================================================
// PIN MISMATCH ERROR STORY
// ============================================================================
const PinMismatchStory = () => (
  <PinInputWithError
    title="Confirm your PIN"
    subtitle="Enter your PIN again to confirm"
    errorMessage="PINs do not match. Please try again."
    initialPin="123456"
  />
);

// ============================================================================
// INVALID PIN ERROR STORY
// ============================================================================
const InvalidPinStory = () => (
  <PinInputWithError
    title="Enter your PIN"
    subtitle="Enter the PIN you created with your passkey wallet"
    errorMessage="Please enter a 6-digit PIN"
    initialPin="12345"
  />
);

// ============================================================================
// OVERVIEW STORY
// ============================================================================
const OverviewStory = () => (
  <ScrollView style={localStyles.scrollView} contentContainerStyle={localStyles.overviewContainer}>
    <Text style={localStyles.title}>PIN Authentication</Text>
    <Text style={localStyles.description}>
      PIN input component used for passkey creation, confirmation, and wallet unlock.
      Uses styles from styles/screens.ts (lockTitle, lockPinDots, lockPinDot, lockKeypad, etc).
    </Text>

    <Text style={localStyles.sectionLabel}>USAGE CONTEXTS</Text>
    <View style={localStyles.contextList}>
      <View style={localStyles.contextItem}>
        <View style={[localStyles.contextDot, { backgroundColor: COLORS.PRIMARY_BLUE }]} />
        <View style={localStyles.contextInfo}>
          <Text style={localStyles.contextTitle}>Create Passkey</Text>
          <Text style={localStyles.contextDesc}>Initial PIN setup during onboarding</Text>
        </View>
      </View>
      <View style={localStyles.contextItem}>
        <View style={[localStyles.contextDot, { backgroundColor: COLORS.TEAL }]} />
        <View style={localStyles.contextInfo}>
          <Text style={localStyles.contextTitle}>Confirm PIN</Text>
          <Text style={localStyles.contextDesc}>Re-enter PIN to verify</Text>
        </View>
      </View>
      <View style={localStyles.contextItem}>
        <View style={[localStyles.contextDot, { backgroundColor: COLORS.SUCCESS_GREEN }]} />
        <View style={localStyles.contextInfo}>
          <Text style={localStyles.contextTitle}>Unlock Wallet</Text>
          <Text style={localStyles.contextDesc}>Enter PIN to restore wallet</Text>
        </View>
      </View>
    </View>

    <Text style={localStyles.sectionLabel}>ERROR HANDLING</Text>
    <Text style={localStyles.contextDesc}>
      Errors are displayed via the Snackbar component at the top of the screen.
      The PIN input itself has no error styling - dots are only filled or empty.
    </Text>
    <View style={localStyles.errorList}>
      <View style={localStyles.errorItem}>
        <View style={[localStyles.errorDot, { backgroundColor: COLORS.DANGER_RED }]} />
        <View style={localStyles.errorInfo}>
          <Text style={localStyles.errorType}>PIN Mismatch</Text>
          <Text style={localStyles.errorMsg}>"PINs do not match. Please try again."</Text>
        </View>
      </View>
      <View style={localStyles.errorItem}>
        <View style={[localStyles.errorDot, { backgroundColor: COLORS.DANGER_RED }]} />
        <View style={localStyles.errorInfo}>
          <Text style={localStyles.errorType}>Invalid PIN</Text>
          <Text style={localStyles.errorMsg}>"Please enter a 6-digit PIN"</Text>
        </View>
      </View>
    </View>

    <Text style={localStyles.sectionLabel}>COMPONENT</Text>
    <View style={localStyles.codeBlock}>
      <Text style={localStyles.code}>
{`// PasskeyPinInput from components/PasskeyPinInput.tsx

import PasskeyPinInput from '../components/PasskeyPinInput';

<PasskeyPinInput
  title="Create a 6-digit PIN"
  subtitle="This PIN will be used with your passkey"
  pin={pin}
  setPin={setPin}
  onPinComplete={(pin) => handleSubmit(pin)}
  onCancel={() => navigation.goBack()}
/>`}
      </Text>
    </View>
  </ScrollView>
);

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Patterns/Authentication',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <DefaultStory />,
};

export const CreatePasskey: Story = {
  render: () => <CreatePasskeyStory />,
};

export const ConfirmPin: Story = {
  render: () => <ConfirmPinStory />,
};

export const UnlockWallet: Story = {
  render: () => <UnlockWalletStory />,
};

export const PinMismatchError: Story = {
  render: () => <PinMismatchStory />,
};

export const InvalidPinError: Story = {
  render: () => <InvalidPinStory />,
};

export const Overview: Story = {
  render: () => <OverviewStory />,
};

// ============================================================================
// STYLES
// ============================================================================
const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  snackbarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  cancelButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 12,
    zIndex: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  pinContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.LIGHT_GRAY,
    textAlign: 'center',
    marginBottom: 30,
    marginHorizontal: 20,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  overviewContainer: {
    padding: 24,
    paddingBottom: 48,
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
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },

  // Context list
  contextList: {
    gap: 12,
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  contextDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  contextInfo: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 2,
  },
  contextDesc: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
  },

  // Error list
  errorList: {
    gap: 12,
    marginTop: 12,
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  errorInfo: {
    flex: 1,
  },
  errorType: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  errorMsg: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontStyle: 'italic',
  },

  // Code block
  codeBlock: {
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.LIGHT_GRAY,
  },
});
