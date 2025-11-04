/**
 * SettingsScreen Component
 * Full-screen settings view with modern dark aesthetic
 */

import React from 'react';
import { Text, View, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';

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
    <View style={localStyles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onClose} style={localStyles.backButton}>
          <Text style={localStyles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={localStyles.content} showsVerticalScrollIndicator={false}>
        <Text style={localStyles.title}>Settings</Text>

        {/* Security Section */}
        <View style={localStyles.section}>
          <SettingsOption
            icon="🔑"
            title="View Recovery Phrase"
            onPress={onViewSeedPhrase}
          />
          <SettingsOption
            icon="🔢"
            title="Change PIN"
            onPress={onChangePin}
          />
          <SettingsOption
            icon="🔒"
            title="Lock Wallet"
            onPress={onLockWallet}
          />
          <SettingsOption
            icon="👁️"
            title="Privacy Mode"
            onPress={onPrivacyModeToggle}
            rightText={privacyMode ? 'ON' : 'OFF'}
          />
        </View>

        {/* Danger Zone */}
        <View style={localStyles.section}>
          <SettingsOption
            icon="⚠️"
            title="Delete Wallet"
            onPress={onDeleteWallet}
            isDanger
          />
        </View>
      </ScrollView>
    </View>
  );
}

// Individual settings option component
function SettingsOption({ icon, title, onPress, rightText, isDanger }) {
  return (
    <TouchableOpacity style={localStyles.option} onPress={onPress}>
      <View style={localStyles.optionLeft}>
        <Text style={localStyles.optionIcon}>{icon}</Text>
        <Text style={[localStyles.optionTitle, isDanger && localStyles.dangerText]}>
          {title}
        </Text>
      </View>
      <View style={localStyles.optionRight}>
        {rightText && <Text style={localStyles.optionRightText}>{rightText}</Text>}
        <Text style={localStyles.optionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
    marginTop: 10,
  },
  section: {
    marginBottom: 30,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 22,
    marginRight: 16,
    width: 28,
  },
  optionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionRightText: {
    fontSize: 14,
    color: '#888',
  },
  optionArrow: {
    fontSize: 24,
    color: '#666',
    marginLeft: 4,
  },
  dangerText: {
    color: '#ff4444',
  },
});
