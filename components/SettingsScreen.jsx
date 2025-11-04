/**
 * SettingsScreen Component
 * Displays wallet settings and configuration options
 * Rendered as a modal overlay with various settings options
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../styles';

export default function SettingsScreen({
  // Callbacks
  onClose,
  onViewSeedPhrase,
  onChangePin,
  onLockWallet,
  onDeleteWallet,
  onPrivacyModeToggle,

  // State
  privacyMode,
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.settingsModal}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.settingsOption}
          onPress={onViewSeedPhrase}
        >
          <Text style={styles.settingsOptionIcon}>🔑</Text>
          <Text style={styles.settingsOptionText}>View Recovery Phrase</Text>
          <Text style={styles.settingsOptionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsOption}
          onPress={onChangePin}
        >
          <Text style={styles.settingsOptionIcon}>🔢</Text>
          <Text style={styles.settingsOptionText}>Change PIN</Text>
          <Text style={styles.settingsOptionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsOption}
          onPress={onLockWallet}
        >
          <Text style={styles.settingsOptionText}>Lock Wallet</Text>
          <Text style={styles.settingsOptionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsOption}
          onPress={onPrivacyModeToggle}
        >
          <Text style={styles.settingsOptionIcon}>👁️</Text>
          <Text style={styles.settingsOptionText}>Privacy Mode</Text>
          <Text style={[styles.settingsToggle, privacyMode && styles.settingsToggleOn]}>
            {privacyMode ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        <View style={styles.settingsDivider} />

        <TouchableOpacity
          style={[styles.settingsOption, styles.dangerOption]}
          onPress={onDeleteWallet}
        >
          <Text style={styles.settingsOptionIcon}>⚠️</Text>
          <Text style={[styles.settingsOptionText, styles.dangerText]}>Delete Wallet</Text>
          <Text style={styles.settingsOptionArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
