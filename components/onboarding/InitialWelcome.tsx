/**
 * InitialWelcome - First screen users see (create/restore options)
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import styles from '../../styles';

interface InitialWelcomeProps {
  onCreateWallet?: () => void;
  onRestoreWallet: () => void;
}

export default function InitialWelcome({
  onCreateWallet,
  onRestoreWallet,
}: InitialWelcomeProps) {
  return (
    <View style={styles.welcomeContainer} testID="welcome-screen">
      <View style={styles.welcomeContent}>
        <Icon name="ducat_logo" size={100} testID="welcome-logo" />
      </View>
      <View style={styles.welcomeButtons}>
        <Text style={styles.welcomeTitle} testID="welcome-title">DUCΔT</Text>
        <Text style={styles.welcomeTagline} numberOfLines={1} adjustsFontSizeToFit>
          A Decentralised Credit Platform
        </Text>
        {onCreateWallet && (
          <TouchableOpacity
            style={styles.button}
            onPress={onCreateWallet}
            testID="welcome-create-wallet-btn"
          >
            <Text style={styles.buttonText}>Create a new wallet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onRestoreWallet}
          testID="welcome-restore-wallet-btn"
        >
          <Text style={styles.buttonText}>Restore an existing wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
