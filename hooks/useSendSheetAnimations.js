/**
 * useSendSheetAnimations Hook
 * Manages animations and swipe gestures for all send transaction bottom sheets:
 * - Asset selector
 * - Address input
 * - Amount input
 * - Review
 * - Confirmation
 */

import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

export function useSendSheetAnimations({ onDismiss }) {
  // Animated values for each sheet
  const assetSelectorTranslateY = useRef(new Animated.Value(0)).current;
  const addressInputTranslateY = useRef(new Animated.Value(0)).current;
  const amountInputTranslateY = useRef(new Animated.Value(0)).current;
  const reviewTranslateY = useRef(new Animated.Value(0)).current;
  const confirmedTranslateY = useRef(new Animated.Value(0)).current;

  const assetSelectorOpacity = useRef(new Animated.Value(0)).current;
  const addressInputOpacity = useRef(new Animated.Value(0)).current;
  const amountInputOpacity = useRef(new Animated.Value(0)).current;
  const reviewOpacity = useRef(new Animated.Value(0)).current;
  const confirmedOpacity = useRef(new Animated.Value(0)).current;

  // Pan responder refs
  const assetSelectorPanResponderRef = useRef(null);
  const addressInputPanResponderRef = useRef(null);
  const amountInputPanResponderRef = useRef(null);
  const reviewPanResponderRef = useRef(null);
  const confirmedPanResponderRef = useRef(null);

  // Helper to create pan responder for swipe-to-dismiss
  const createPanResponder = (translateY, onDismissCallback) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe =
          gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onDismissCallback();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    });
  };

  // Create pan responders once
  if (!assetSelectorPanResponderRef.current) {
    assetSelectorPanResponderRef.current = createPanResponder(assetSelectorTranslateY, () =>
      onDismiss('assetSelector')
    );
  }

  if (!addressInputPanResponderRef.current) {
    addressInputPanResponderRef.current = createPanResponder(addressInputTranslateY, () =>
      onDismiss('addressInput')
    );
  }

  if (!amountInputPanResponderRef.current) {
    amountInputPanResponderRef.current = createPanResponder(amountInputTranslateY, () =>
      onDismiss('amountInput')
    );
  }

  if (!reviewPanResponderRef.current) {
    reviewPanResponderRef.current = createPanResponder(reviewTranslateY, () => onDismiss('review'));
  }

  if (!confirmedPanResponderRef.current) {
    confirmedPanResponderRef.current = createPanResponder(confirmedTranslateY, () =>
      onDismiss('confirmed')
    );
  }

  return {
    // Asset selector
    assetSelector: {
      translateY: assetSelectorTranslateY,
      opacity: assetSelectorOpacity,
      panHandlers: assetSelectorPanResponderRef.current?.panHandlers,
    },
    // Address input
    addressInput: {
      translateY: addressInputTranslateY,
      opacity: addressInputOpacity,
      panHandlers: addressInputPanResponderRef.current?.panHandlers,
    },
    // Amount input
    amountInput: {
      translateY: amountInputTranslateY,
      opacity: amountInputOpacity,
      panHandlers: amountInputPanResponderRef.current?.panHandlers,
    },
    // Review
    review: {
      translateY: reviewTranslateY,
      opacity: reviewOpacity,
      panHandlers: reviewPanResponderRef.current?.panHandlers,
    },
    // Confirmed
    confirmed: {
      translateY: confirmedTranslateY,
      opacity: confirmedOpacity,
      panHandlers: confirmedPanResponderRef.current?.panHandlers,
    },
  };
}
