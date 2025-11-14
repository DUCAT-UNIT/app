/**
 * useReceiveScreenAnimations Hook
 * Manages all animations and pan gestures for the Receive screen
 */

import { useRef, useEffect } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function useReceiveScreenAnimations(showReceiveSheet, showQrModal, onClose) {
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const receiveSheetOpacity = useRef(new Animated.Value(0)).current;
  const receiveOpacity = useRef(new Animated.Value(1)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;
  const receiveTranslateY = useRef(new Animated.Value(0)).current;

  // Pan responder refs
  const panResponderRef = useRef(null);
  const qrModalPanResponderRef = useRef(null);

  const handleDismiss = () => {
    Animated.timing(receiveTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      receiveSheetOpacity.setValue(0);
      onClose();
    });
  };

  const handleQrBack = () => {
    return Animated.parallel([
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(qrOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(receiveOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);
  };

  // Create pan responders once
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (showQrModal) return false;
        const isDownwardSwipe =
          gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (showQrModal) return;
        if (gestureState.dy > 0) {
          receiveTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (showQrModal) return;

        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(receiveTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  }

  if (!qrModalPanResponderRef.current) {
    qrModalPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipeRight =
          gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
          const progress = Math.min(gestureState.dx / 100, 1);
          receiveOpacity.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          handleQrBack().start();
        } else {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }),
            Animated.timing(receiveOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    });
  }

  // Reset position when opening/closing
  const prevShowReceiveSheet = useRef(showReceiveSheet);
  useEffect(() => {
    if (showReceiveSheet && !prevShowReceiveSheet.current) {
      receiveTranslateY.setValue(0);
      receiveSheetOpacity.setValue(1);
    } else if (!showReceiveSheet && prevShowReceiveSheet.current) {
      receiveSheetOpacity.setValue(0);
    }
    prevShowReceiveSheet.current = showReceiveSheet;
  }, [showReceiveSheet, receiveTranslateY, receiveSheetOpacity]);

  const prepareQrAnimation = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    receiveOpacity.setValue(0);
    qrOpacity.setValue(1);
  };

  return {
    // Animation values
    translateX,
    translateY,
    receiveSheetOpacity,
    receiveOpacity,
    qrOpacity,
    receiveTranslateY,
    // Pan responders
    panResponder: panResponderRef.current,
    qrModalPanResponder: qrModalPanResponderRef.current,
    // Handlers
    handleDismiss,
    handleQrBack,
    prepareQrAnimation,
  };
}
