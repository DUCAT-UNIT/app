/**
 * AdvancedScreen Component
 * Advanced settings and options
 */

import React from 'react';
import { Alert, Modal, Text, TextInput, View, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import ScreenLayout from '../../components/layouts/ScreenLayout';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { analytics } from '../../services/analyticsService';
import { SETTINGS_EVENTS } from '../../constants/analyticsEvents';
import { USDC_FEATURE_UNLOCK_PHRASE } from '../../constants/settings';
import { logger } from '../../utils/logger';
import {
  useOperationJournalStore,
  type OperationJournalEntry,
} from '../../stores/operationJournalStore';
import { styles } from './AdvancedScreen.styles';

const canonicalizeUsdcUnlockPhrase = (phrase: string): string =>
  phrase
    .trim()
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleLowerCase('en-US');

const isUsdcUnlockPhraseMatch = (phrase: string): boolean =>
  canonicalizeUsdcUnlockPhrase(phrase) === canonicalizeUsdcUnlockPhrase(USDC_FEATURE_UNLOCK_PHRASE);

/**
 * Props for the AdvancedScreen component
 */
interface AdvancedScreenProps {
  /** Navigation route object containing params */
  route: {
    /** Route parameters */
    params: {
      /** Callback to close the Advanced screen */
      onClose: () => void;
      /** Callback to switch account */
      onSwitchAccount: () => void;
      /** Callback to toggle advanced/developer mode */
      onAdvancedModeToggle: () => void;
      /** Callback when ecash threshold is pressed */
      onEcashThresholdPress: () => void;
    };
  };
}

/**
 * Props for individual settings option component
 */
interface SettingsOptionProps {
  /** Icon name to display */
  iconName: string;
  /** Title text for the option */
  title: string;
  /** Callback when option is pressed */
  onPress: () => void;
  /** Optional text to display on the right (e.g., ON/OFF) */
  rightText?: string;
  /** Optional test ID for testing */
  testID?: string;
}

const AdvancedScreen = React.memo(function AdvancedScreen({
  route,
}: AdvancedScreenProps): React.ReactElement {
  const { onClose, onSwitchAccount, onAdvancedModeToggle, onEcashThresholdPress } = route.params;

  // Get advancedMode and ecashThreshold directly from context so they update when toggled
  const { settingsHandlers } = useSettingsHandlers();
  const advancedMode = settingsHandlers?.advancedMode || false;
  const ecashThreshold = settingsHandlers?.ecashThreshold || 10000;
  const usdcFeaturesEnabled = settingsHandlers?.usdcFeaturesEnabled || false;
  const operationEntries = useOperationJournalStore((state) => state.entries);
  const clearTerminalOperations = useOperationJournalStore((state) => state.clearTerminalOlderThan);
  const [showUsdcPasswordPrompt, setShowUsdcPasswordPrompt] = React.useState(false);
  const [usdcUnlockPhrase, setUsdcUnlockPhrase] = React.useState('');
  const [usdcUnlockPhraseError, setUsdcUnlockPhraseError] = React.useState<string | null>(null);
  const [usdcUnlockPhraseSubmitting, setUsdcUnlockPhraseSubmitting] = React.useState(false);
  const activeOperationCount = operationEntries.filter(
    (entry) =>
      entry.stage === 'pending' ||
      entry.stage === 'submit' ||
      entry.stage === 'auth' ||
      entry.stage === 'recoverable'
  ).length;

  // Format threshold display value
  const getThresholdDisplay = (): string => {
    if (ecashThreshold === Infinity) return 'All transfers';
    return `${(ecashThreshold / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`;
  };

  const handleAdvancedModeToggle = (): void => {
    onAdvancedModeToggle();
    analytics.track(SETTINGS_EVENTS.PREFERENCE_CHANGED, {
      setting: 'advanced_mode',
      value: !advancedMode,
    });
  };

  const handleEcashThresholdPress = (): void => {
    onEcashThresholdPress();
    analytics.track(SETTINGS_EVENTS.PREFERENCE_CHANGED, {
      setting: 'ecash_threshold',
      value: ecashThreshold,
    });
  };

  const handleUsdcFeaturePress = (): void => {
    if (usdcFeaturesEnabled) {
      Alert.alert(
        'Disable USDC?',
        'This hides USDC cards, vault USDC payout, and UNIT swap entry points.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              void settingsHandlers.handleDisableUsdcFeatures();
            },
          },
        ]
      );
      return;
    }

    setUsdcUnlockPhrase('');
    setUsdcUnlockPhraseError(null);
    setShowUsdcPasswordPrompt(true);
  };

  const handleCancelUsdcPassword = (): void => {
    if (usdcUnlockPhraseSubmitting) return;
    setShowUsdcPasswordPrompt(false);
    setUsdcUnlockPhrase('');
    setUsdcUnlockPhraseError(null);
  };

  const enableUsdcWithPassword = React.useCallback(
    async (
      unlockPhrase: string,
      options: { showError: boolean } = { showError: true }
    ): Promise<void> => {
      if (usdcUnlockPhraseSubmitting) return;

      setUsdcUnlockPhraseError(null);
      setUsdcUnlockPhraseSubmitting(true);
      const enabled = await settingsHandlers.handleEnableUsdcFeatures(
        isUsdcUnlockPhraseMatch(unlockPhrase) ? USDC_FEATURE_UNLOCK_PHRASE : unlockPhrase
      );
      setUsdcUnlockPhraseSubmitting(false);

      if (enabled) {
        setShowUsdcPasswordPrompt(false);
        setUsdcUnlockPhrase('');
        setUsdcUnlockPhraseError(null);
      } else if (options.showError) {
        setUsdcUnlockPhraseError('Incorrect phrase. Enter the developer unlock phrase exactly.');
      }
    },
    [settingsHandlers, usdcUnlockPhraseSubmitting]
  );

  const handleSubmitUsdcPassword = async (): Promise<void> => {
    await enableUsdcWithPassword(usdcUnlockPhrase);
  };

  const handleUsdcPasswordChange = (nextPassword: string): void => {
    setUsdcUnlockPhrase(nextPassword);
    if (isUsdcUnlockPhraseMatch(nextPassword)) {
      void enableUsdcWithPassword(nextPassword, { showError: false });
    }
  };

  React.useEffect(() => {
    if (!usdcFeaturesEnabled || !showUsdcPasswordPrompt) return;
    setShowUsdcPasswordPrompt(false);
    setUsdcUnlockPhrase('');
    setUsdcUnlockPhraseError(null);
  }, [showUsdcPasswordPrompt, usdcFeaturesEnabled]);

  const handleClearCompletedOperations = (): void => {
    Alert.alert(
      'Clear completed operations?',
      'This only removes confirmed or failed journal entries. Pending and recoverable operations stay visible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => clearTerminalOperations(0),
        },
      ]
    );
  };

  logger.debug(
    '[AdvancedScreen] Rendering with advancedMode:',
    advancedMode,
    'ecashThreshold:',
    ecashThreshold
  );

  return (
    <ScreenLayout testID="advanced-screen">
      {/* Header with back button and title on same line */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton} testID="advanced-back-btn">
          <Icon name="back" size={24} color={COLORS.VERY_LIGHT_GRAY} />
        </TouchableOpacity>
        <Text style={styles.title}>Advanced</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <SettingsOption
              iconName="asset"
              title="Developer Mode"
              onPress={handleAdvancedModeToggle}
              rightText={advancedMode ? 'ON' : 'OFF'}
              testID="advanced-dev-mode-btn"
            />
            <SettingsOption
              iconName="unit_logo"
              title="Turbo UNIT Default"
              onPress={handleEcashThresholdPress}
              rightText={getThresholdDisplay()}
              testID="advanced-ecash-threshold-btn"
            />
            {/* Account selection only visible in developer mode */}
            {advancedMode && (
              <>
                <SettingsOption
                  iconName="asset"
                  title="Enable USDC"
                  onPress={handleUsdcFeaturePress}
                  rightText={usdcFeaturesEnabled ? 'ON' : 'OFF'}
                  testID="advanced-enable-usdc-btn"
                />
                <SettingsOption
                  iconName="switch_account"
                  title="Select Account"
                  onPress={onSwitchAccount}
                  testID="advanced-switch-account-btn"
                />
                <OperationJournalPanel
                  entries={operationEntries}
                  activeCount={activeOperationCount}
                  onClearCompleted={handleClearCompletedOperations}
                />
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showUsdcPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={handleCancelUsdcPassword}
      >
        <View style={styles.passwordModalBackdrop} accessible={false}>
          <View style={styles.passwordModalCard} testID="enable-usdc-password-modal">
            <Text style={styles.passwordModalTitle}>Enable USDC</Text>
            <Text style={styles.passwordModalBody}>
              Enter the developer unlock phrase to reveal USDC cards, vault USDC payout, and swap
              entry points.
            </Text>
            <TextInput
              value={usdcUnlockPhrase}
              onChangeText={handleUsdcPasswordChange}
              secureTextEntry
              autoCapitalize="none"
              keyboardType="ascii-capable"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleSubmitUsdcPassword();
              }}
              placeholder="Unlock phrase"
              placeholderTextColor="#777"
              style={styles.passwordInput}
              testID="enable-usdc-password-input"
              accessibilityLabel="Enable USDC unlock phrase"
              editable={!usdcUnlockPhraseSubmitting}
            />
            {usdcUnlockPhraseError ? (
              <Text style={styles.passwordErrorText} testID="enable-usdc-password-error">
                {usdcUnlockPhraseError}
              </Text>
            ) : null}
            <View style={styles.passwordModalActions}>
              <TouchableOpacity
                style={[styles.passwordModalButton, styles.passwordModalSecondaryButton]}
                onPress={handleCancelUsdcPassword}
                disabled={usdcUnlockPhraseSubmitting}
                testID="enable-usdc-cancel-btn"
              >
                <Text style={styles.passwordModalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordModalButton, styles.passwordModalPrimaryButton]}
                onPress={() => {
                  void handleSubmitUsdcPassword();
                }}
                disabled={usdcUnlockPhraseSubmitting}
                testID="enable-usdc-confirm-btn"
              >
                <Text style={styles.passwordModalPrimaryText}>
                  {usdcUnlockPhraseSubmitting ? 'Checking...' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
});

function shortHash(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatOperationKind(kind: string): string {
  return kind
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatUpdatedAt(timestamp: number): string {
  const elapsedMs = Date.now() - timestamp;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'just now';
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function OperationJournalPanel({
  entries,
  activeCount,
  onClearCompleted,
}: {
  entries: OperationJournalEntry[];
  activeCount: number;
  onClearCompleted: () => void;
}): React.ReactElement {
  const recentEntries = entries.slice(0, 5);

  return (
    <View style={styles.journalPanel} testID="advanced-operation-journal-panel">
      <View style={styles.journalHeader}>
        <View>
          <Text style={styles.journalTitle}>Operation Journal</Text>
          <Text style={styles.journalSubtitle}>
            {entries.length} saved · {activeCount} active or recoverable
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClearCompleted}
          style={styles.journalClearButton}
          testID="advanced-operation-journal-clear-completed-btn"
        >
          <Text style={styles.journalClearText}>Clear completed</Text>
        </TouchableOpacity>
      </View>

      {recentEntries.length === 0 ? (
        <Text style={styles.journalEmptyText}>No pending or recent operations.</Text>
      ) : (
        recentEntries.map((entry) => (
          <View
            key={entry.id}
            style={styles.journalEntry}
            testID="advanced-operation-journal-entry"
          >
            <View style={styles.journalEntryTopRow}>
              <Text style={styles.journalEntryTitle}>{formatOperationKind(entry.kind)}</Text>
              <Text style={styles.journalEntryStage}>{entry.stage}</Text>
            </View>
            <Text style={styles.journalEntryLabel}>{entry.label}</Text>
            <Text style={styles.journalEntryMeta}>
              {formatUpdatedAt(entry.updatedAt)} · {entry.retrySafety.replace(/_/g, ' ')}
            </Text>
            {entry.txids[0] ? (
              <Text style={styles.journalEntryMeta}>Tx {shortHash(entry.txids[0])}</Text>
            ) : null}
            {entry.recoveryAction ? (
              <Text style={styles.journalRecoveryText}>{entry.recoveryAction}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

// Individual settings option component
const SettingsOption = React.memo(function SettingsOption({
  iconName,
  title,
  onPress,
  rightText,
  testID,
}: SettingsOptionProps): React.ReactElement {
  const handlePress = (): void => {
    logger.debug(`[AdvancedScreen] SettingsOption pressed: ${title}`);
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.option}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={testID}
    >
      <View style={styles.optionLeft}>
        <Icon name={iconName} size={24} color="#DDDDDD" />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <View style={styles.optionRight}>
        {rightText && <Text style={styles.optionRightText}>{rightText}</Text>}
        <Text style={styles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
});

export default AdvancedScreen;
