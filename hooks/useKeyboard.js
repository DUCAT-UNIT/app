/**
 * useKeyboard - Hook to track keyboard visibility and height
 * Handles both iOS and Android keyboard events
 */

import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

export const useKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardWillShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const keyboardWillHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible,
  };
};
