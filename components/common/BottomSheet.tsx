/**
 * BottomSheet Component
 * Reusable bottom sheet with overlay, slide-up animation, and swipe-to-dismiss
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  PanResponder,
  Animated,
  AppState,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { isE2E } from '../../utils/e2e';
import { logger } from '../../utils/logger';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
}: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  // Interpolate opacity from translateY
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 500],
    outputRange: [0.7, 0],
    extrapolate: 'clamp',
  });

  // Animate sheet opening/closing
  useEffect(() => {
    if (visible) {
      // Start off-screen and animate in
      translateY.setValue(500);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  }, [visible, translateY]);

  // Auto-dismiss when app goes to background
  useEffect(() => {
    if (!visible) return;

    let appState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
        logger.debug('BottomSheet', 'App backgrounding - dismissing', {});
        onClose();
      }
      appState = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [visible, onClose]);

  // Create pan responder for swipe gestures
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
        // Dismiss if dragged far enough or with velocity
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // Spring back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // E2E bypass: render as View overlay instead of Modal so elements are
  // accessible to Maestro (React Native Modal creates a separate UIWindow
  // on iOS that Maestro's XCUITest queries cannot reach)
  if (isE2E()) {
    if (!visible) return null;
    return (
      <View style={styles.e2eOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.backdrop, { opacity: 0.7 }]} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {children}
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop - tapping closes */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              }
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet with gesture handling */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Swipe Handle */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  e2eOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
});
