import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { COLORS } from '../theme';

interface SnackbarProps {
  visible: boolean;
  message: string;
  duration?: number;
}

export default function Snackbar({ visible, message, duration = 3000 }: SnackbarProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (visible) {
      hasAnimated.current = false;
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(translateY, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        hasAnimated.current = true;
      });
    }
  }, [visible, duration, translateY]);

  if (!visible && hasAnimated.current) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={styles.snackbar}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  snackbar: {
    backgroundColor: COLORS.DARK_GRAY,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '500',
  },
});
