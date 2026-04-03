import React from 'react';
import { Animated,GestureResponderHandlers,StyleSheet,Text,TextStyle,TouchableOpacity,View,ViewStyle } from 'react-native';
import { COLORS } from '../theme';
import MutinynetBanner from './MutinynetBanner';

interface SeedPhraseOverlayProps {
  visible: boolean;
  seedPhraseWords: string[];
  seedPhraseVisible: boolean;
  seedPhraseTranslateX: Animated.Value;
  seedPhrasePanResponderRef: React.MutableRefObject<{ panHandlers: GestureResponderHandlers } | null>;
  setSeedPhraseVisible: (visible: boolean) => void;
  closeSeedPhrase: () => void;
  styles: {
    container: ViewStyle;
    walletInfo: ViewStyle;
    seedPhraseWarning: TextStyle;
    seedGrid: ViewStyle;
    seedBox: ViewStyle;
    seedNumber: TextStyle;
    seedWord: TextStyle;
    button: ViewStyle;
    buttonText: TextStyle;
    secondaryButton: ViewStyle;
  };
}

export default function SeedPhraseOverlay({
  visible,
  seedPhraseWords,
  seedPhraseVisible,
  seedPhraseTranslateX,
  seedPhrasePanResponderRef,
  setSeedPhraseVisible,
  closeSeedPhrase,
  styles,
}: SeedPhraseOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        localStyles.overlayContainer,
        {
          transform: [{ translateX: seedPhraseTranslateX }],
        },
      ]}
    >
      <MutinynetBanner panHandlers={seedPhrasePanResponderRef.current?.panHandlers} />
      <View style={[styles.container, localStyles.contentContainer]}>
        <View style={styles.walletInfo}>
          <Text style={styles.seedPhraseWarning}>
            ⚠️ Keep these words safe and private! Never share them with anyone.
          </Text>

          <View style={styles.seedGrid}>
            {seedPhraseWords.map((word, index) => (
              <View key={index} style={styles.seedBox}>
                <Text style={styles.seedNumber}>{index + 1}</Text>
                <Text style={styles.seedWord}>{seedPhraseVisible ? word : '••••••'}</Text>
              </View>
            ))}
          </View>

          {!seedPhraseVisible && (
            <TouchableOpacity style={styles.button} onPress={() => setSeedPhraseVisible(true)}>
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

const localStyles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
  contentContainer: {
    paddingTop: 0,
    flex: 1,
  },
});
