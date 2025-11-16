/**
 * Passkey Test Screen
 * Simple UI for testing passkey functionality during development
 *
 * NOTE: This is a TEMPORARY test screen for development only
 * Remove before production or move to settings for debugging
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as PasskeyService from '../../services/passkeyService';
import { COLORS } from '../../theme';

export default function PasskeyTestScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [passkeySupported, setPasskeySupported] = useState(null);
  const [passkeyEnabled, setPasskeyEnabled] = useState(null);

  // Check passkey support
  const checkSupport = async () => {
    setLoading(true);
    try {
      const supported = await PasskeyService.isPasskeySupported();
      setPasskeySupported(supported);
      Alert.alert(
        'Passkey Support',
        supported ? '✅ Passkeys are supported!' : '❌ Passkeys not supported on this device'
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if passkey is enabled
  const checkEnabled = async () => {
    setLoading(true);
    try {
      const enabled = await PasskeyService.isPasskeyEnabled();
      setPasskeyEnabled(enabled);
      Alert.alert(
        'Passkey Status',
        enabled ? '✅ Passkey is enabled' : 'ℹ️ Passkey not enabled'
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Test: Create wallet with passkey
  const testCreateWallet = async () => {
    // Prompt for PIN
    Alert.prompt(
      'Enter PIN',
      'Enter a 6-digit PIN to encrypt the wallet',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Create',
          onPress: async (pin) => {
            if (!pin || pin.length !== 6) {
              Alert.alert('Error', 'Please enter a 6-digit PIN');
              return;
            }

            setLoading(true);
            setResult(null);
            try {
              const data = await PasskeyService.createWalletWithPasskey({
                userName: 'test@ducat.app',
                userDisplayName: 'Test User',
                pin: pin,
              });

              setResult(data);

              // Show iCloud save status if available
              let successMsg = `Wallet created!\n\nMnemonic: ${data.mnemonic.substring(0, 20)}...\n\nSegWit: ${data.addresses.segwitAddress.slice(0, 20)}...`;
              if (data._iCloudDebug) {
                successMsg += `\n\n--- iCloud Save Status ---\n${data._iCloudDebug}`;
              }

              Alert.alert('✅ Success!', successMsg);
            } catch (error) {
              // Show full error details for debugging in TestFlight
              const errorDetails = `${error.message}\n\nStack: ${error.stack || 'N/A'}`;
              Alert.alert('❌ Create Error', errorDetails);
              console.error('Create wallet error:', error);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'number-pad'
    );
  };

  // Test: Unlock with passkey
  const testUnlock = async () => {
    // Prompt for PIN
    Alert.prompt(
      'Enter PIN',
      'Enter your 6-digit PIN to decrypt the wallet',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unlock',
          onPress: async (pin) => {
            if (!pin || pin.length !== 6) {
              Alert.alert('Error', 'Please enter a 6-digit PIN');
              return;
            }

            setLoading(true);
            setResult(null);
            try {
              const data = await PasskeyService.unlockWithPasskey(pin);

              setResult(data);
              Alert.alert(
                '✅ Success!',
                `Wallet unlocked!\n\nMnemonic: ${data.mnemonic.substring(0, 20)}...\n\nSegWit: ${data.addresses.segwitAddress.slice(0, 20)}...`
              );
            } catch (error) {
              // Show full error details for debugging in TestFlight
              const errorDetails = `${error.message}\n\nStack: ${error.stack || 'N/A'}`;
              Alert.alert('❌ Unlock Error', errorDetails);
              console.error('Unlock error:', error);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'number-pad'
    );
  };

  // Test: Recover with passkey
  const testRecover = async () => {
    // Prompt for PIN
    Alert.prompt(
      'Enter PIN',
      'Enter your 6-digit PIN to decrypt the wallet',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Recover',
          onPress: async (pin) => {
            if (!pin || pin.length !== 6) {
              Alert.alert('Error', 'Please enter a 6-digit PIN');
              return;
            }

            setLoading(true);
            setResult(null);
            try {
              const data = await PasskeyService.recoverWithPasskey(pin);

              setResult(data);
              Alert.alert(
                '✅ Success!',
                `Wallet recovered!\n\nMnemonic: ${data.mnemonic.substring(0, 20)}...\n\nSegWit: ${data.addresses.segwitAddress.slice(0, 20)}...`
              );
            } catch (error) {
              // Show full error details for debugging in TestFlight
              const errorDetails = `${error.message}\n\nStack: ${error.stack || 'N/A'}`;
              Alert.alert('❌ Recovery Error', errorDetails);
              console.error('Recover error:', error);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'number-pad'
    );
  };

  // Test: Check iCloud backup
  const testCheckICloudBackup = async () => {
    setLoading(true);
    try {
      const ICloudStorage = await import('../../services/icloudStorage');

      // Try to load - this will show detailed debug info
      try {
        const backup = await ICloudStorage.loadFromICloud();
        // Show debug info from load
        const debugInfo = backup._debugInfo || 'No debug info';
        Alert.alert(
          '✅ iCloud Backup Found',
          debugInfo + `\n\nKeys loaded: ${Object.keys(backup).filter(k => k !== '_debugInfo').join(', ')}`
        );
      } catch (loadError) {
        // Show the detailed error which includes step-by-step load debug
        Alert.alert('❌ iCloud Load Failed', loadError.message);
      }
    } catch (error) {
      const errorDetails = `${error.message}\n\nCode: ${error.code || 'N/A'}`;
      Alert.alert('❌ iCloud Check Error', errorDetails);
    } finally {
      setLoading(false);
    }
  };

  // Test: Remove passkey
  const testRemove = async () => {
    Alert.alert(
      'Remove Passkey?',
      'This will remove the passkey but keep the wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await PasskeyService.removePasskey();
              setPasskeyEnabled(false);
              Alert.alert('✅ Success', 'Passkey removed');
            } catch (error) {
              Alert.alert('❌ Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Passkey Test Screen</Text>
        <Text style={styles.subtitle}>Development Testing Only</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>

          <TouchableOpacity style={styles.testButton} onPress={checkSupport}>
            <Text style={styles.testButtonText}>Check Passkey Support</Text>
          </TouchableOpacity>

          {passkeySupported !== null && (
            <Text style={styles.statusText}>
              Support: {passkeySupported ? '✅ Yes' : '❌ No'}
            </Text>
          )}

          <TouchableOpacity style={styles.testButton} onPress={checkEnabled}>
            <Text style={styles.testButtonText}>Check if Enabled</Text>
          </TouchableOpacity>

          {passkeyEnabled !== null && (
            <Text style={styles.statusText}>
              Enabled: {passkeyEnabled ? '✅ Yes' : 'ℹ️ No'}
            </Text>
          )}
        </View>

        {/* Create Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create</Text>
          <Text style={styles.sectionDescription}>
            Creates a new wallet using passkey. Will prompt for Face ID/Touch ID.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.createButton]}
            onPress={testCreateWallet}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              🔐 Create Wallet with Passkey
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unlock Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unlock</Text>
          <Text style={styles.sectionDescription}>
            Unlocks an existing wallet on this device. Requires passkey to be created first.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.unlockButton]}
            onPress={testUnlock}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              🔓 Unlock with Passkey
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recover Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recover</Text>
          <Text style={styles.sectionDescription}>
            Recovers wallet on a new device. Uses passkey synced via iCloud/Google.
          </Text>

          <TouchableOpacity
            style={[styles.testButton]}
            onPress={testCheckICloudBackup}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>
              Check iCloud Backup
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.recoverButton]}
            onPress={testRecover}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              ♻️ Recover with Passkey
            </Text>
          </TouchableOpacity>
        </View>

        {/* Remove Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remove</Text>
          <Text style={styles.sectionDescription}>
            Removes passkey but keeps wallet data.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={testRemove}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              🗑️ Remove Passkey
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        {/* Result Display */}
        {result && !loading && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>✅ Last Result:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.resultText}>
                {JSON.stringify(result, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ⚠️ This is a test screen for development only.{'\n'}
            Remove before production release.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: COLORS.PRIMARY_BLUE,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 15,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  testButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    textAlign: 'center',
  },
  statusText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  createButton: {
    backgroundColor: COLORS.SUCCESS_GREEN,
  },
  unlockButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
  },
  recoverButton: {
    backgroundColor: COLORS.PURPLE,
  },
  removeButton: {
    backgroundColor: COLORS.RED,
  },
  actionButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: COLORS.SECONDARY_TEXT,
    marginTop: 10,
    fontSize: 14,
  },
  resultContainer: {
    backgroundColor: COLORS.CARD_BG,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS_GREEN,
    marginBottom: 20,
  },
  resultTitle: {
    color: COLORS.SUCCESS_GREEN,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  resultText: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontFamily: 'Courier',
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.ORANGE,
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    color: COLORS.ORANGE,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
