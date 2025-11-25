/**
 * InitialWelcome - First screen users see (create/restore options)
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Icon from '../icons';
import styles from '../../styles';

export default function InitialWelcome({
  onCreateWallet,
  onRestoreWallet,
}) {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <Icon name="ducat_logo" size={100} />
      </View>
      <View style={styles.welcomeButtons}>
        <Text style={styles.welcomeTitle}>DUCΔT</Text>
        <Text style={styles.welcomeTagline} numberOfLines={1} adjustsFontSizeToFit>
          A Decentralised Credit Platform
        </Text>
        {onCreateWallet && (
          <TouchableOpacity style={styles.button} onPress={onCreateWallet}>
            <Text style={styles.buttonText}>Create a new wallet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onRestoreWallet}
        >
          <Text style={styles.buttonText}>Restore an existing wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
