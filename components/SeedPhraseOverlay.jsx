import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import MutinynetBanner from './MutinynetBanner';
import { COLORS } from '../utils/colors';

export default function SeedPhraseOverlay({
  visible,
  seedPhraseWords,
  seedPhraseVisible,
  seedPhraseTranslateX,
  seedPhrasePanResponderRef,
  setSeedPhraseVisible,
  closeSeedPhrase,
  styles,
}) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.DARK_BG,
        zIndex: 1000,
        transform: [{ translateX: seedPhraseTranslateX }]
      }}
    >
      <MutinynetBanner panHandlers={seedPhrasePanResponderRef.current.panHandlers} />
      <View style={[styles.container, { paddingTop: 0, flex: 1 }]}>
        <View style={styles.walletInfo}>
          <Text style={styles.seedPhraseWarning}>
            ⚠️ Keep these words safe and private! Never share them with anyone.
          </Text>

          <View style={styles.seedGrid}>
            {seedPhraseWords.map((word, index) => (
              <View key={index} style={styles.seedBox}>
                <Text style={styles.seedNumber}>{index + 1}</Text>
                <Text style={styles.seedWord}>
                  {seedPhraseVisible ? word : '••••••'}
                </Text>
              </View>
            ))}
          </View>

          {!seedPhraseVisible && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => setSeedPhraseVisible(true)}
            >
              <Text style={styles.buttonText}>Show Recovery Phrase</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, seedPhraseVisible && styles.secondaryButton]}
            onPress={closeSeedPhrase}
          >
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
