import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme';
import Icon from './icons';

import type { ToastType } from '../contexts/NotificationContext';

interface TransactionToastProps {
  message: string;
  type: ToastType;
}

export default function TransactionToast({ message, type }: TransactionToastProps) {
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return COLORS.SUCCESS_GREEN;
      case 'error':
        return COLORS.DANGER_RED;
      case 'warning':
        return COLORS.WARNING_ORANGE || '#FFA500';
      default:
        return COLORS.PRIMARY_BLUE;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: getBackgroundColor() }]}>
      <Icon name={getIcon()} size={20} color={COLORS.WHITE} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 10,
  },
  toastText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
