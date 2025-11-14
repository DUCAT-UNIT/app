/**
 * useBottomSheetAnimation Hook
 * Manages bottom sheet animation and gesture handling
 */

import { useRef, useEffect } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function useBottomSheetAnimation(isVisible, onClose) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      opacity.setValue(0);
      onClose();
    });
  };

  // Pan responder for swipe down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Manage sheet animation when visibility changes
  useEffect(() => {
    if (isVisible) {
      // Animate in
      opacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [isVisible, opacity, translateY]);

  return {
    opacity,
    translateY,
    panResponder,
    handleDismiss,
  };
}
