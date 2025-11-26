/**
 * useReceiveScreenAnimations Hook
 * Manages all animations and pan gestures for the Receive screen
 */

import { useRef, useEffect } from 'react';
import { Animated, Dimensions, PanResponder, PanResponderInstance, GestureResponderEvent, PanResponderGestureState } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface UseReceiveScreenAnimationsReturn {
  translateX: Animated.Value;
  translateY: Animated.Value;
  receiveSheetOpacity: Animated.Value;
  receiveOpacity: Animated.Value;
  qrOpacity: Animated.Value;
  receiveTranslateY: Animated.Value;
  panResponder: PanResponderInstance;
  qrModalPanResponder: PanResponderInstance;
  handleDismiss: () => void;
  handleQrBack: () => Animated.CompositeAnimation;
  prepareQrAnimation: () => void;
  resetAfterQr: () => void;
  setOnQrSwipeDismiss: (callback: (() => void) | null) => void;
}

export function useReceiveScreenAnimations(
  showReceiveSheet: boolean,
  showQrModal: boolean,
  onClose: () => void
): UseReceiveScreenAnimationsReturn {
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const receiveSheetOpacity = useRef(new Animated.Value(0)).current;
  const receiveOpacity = useRef(new Animated.Value(1)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;
  const receiveTranslateY = useRef(new Animated.Value(0)).current;

  // Pan responder refs
  const panResponderRef = useRef<PanResponderInstance | null>(null);
  const qrModalPanResponderRef = useRef<PanResponderInstance | null>(null);

  const handleDismiss = (): void => {
    Animated.timing(receiveTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      receiveSheetOpacity.setValue(0);
      onClose();
    });
  };

  const handleQrBack = (): Animated.CompositeAnimation => {
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
    ]);
  };

  // Store showQrModal in a ref to access current value in pan responder
  const showQrModalRef = useRef(showQrModal);
  useEffect(() => {
    showQrModalRef.current = showQrModal;
  }, [showQrModal]);

  // Create pan responder once with ref access to showQrModal
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Don't respond if QR modal is showing
        if (showQrModalRef.current) return false;
        // Only capture downward swipes
        const isDownwardSwipe = gestureState.dy > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        // Reset to 0 position when starting drag
        receiveTranslateY.setValue(0);
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Follow finger movement
        if (gestureState.dy > 0) {
          receiveTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Dismiss if dragged far enough or with velocity
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          // Spring back to original position
          Animated.spring(receiveTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start();
        }
      },
    });
  }

  // Store onQrSwipeDismiss callback
  const onQrSwipeDismissRef = useRef<(() => void) | null>(null);
  const setOnQrSwipeDismiss = (callback: (() => void) | null): void => {
    onQrSwipeDismissRef.current = callback;
  };

  if (!qrModalPanResponderRef.current) {
    qrModalPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const isSwipeRight =
          gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          // Swipe to dismiss - just return the animation, let the caller handle the callback
          if (onQrSwipeDismissRef.current) {
            onQrSwipeDismissRef.current();
          }
        } else {
          // Spring back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
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

  const prepareQrAnimation = (): void => {
    translateX.setValue(0);
    translateY.setValue(0);
    qrOpacity.setValue(1);
  };

  const resetAfterQr = (): void => {
    // Reset all animation values after QR modal is dismissed
    translateX.setValue(0);
    translateY.setValue(0);
    qrOpacity.setValue(0);
    // Ensure receive sheet is in correct position
    receiveTranslateY.setValue(0);
    receiveSheetOpacity.setValue(1);
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
    resetAfterQr,
    setOnQrSwipeDismiss,
  };
}
