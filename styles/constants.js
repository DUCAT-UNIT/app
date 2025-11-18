/**
 * Shared style constants used across all style files
 * Consolidates responsive layout calculations to avoid duplication
 */

import { Platform, StatusBar, Dimensions } from 'react-native';

// Get device dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get safe area top inset - accounts for notch/status bar on different devices
export const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

// Responsive horizontal padding based on screen width
// Small devices (< 375): 16px
// Medium devices (375-414): 20px
// Large devices (> 414): 24px
export const HORIZONTAL_PADDING = SCREEN_WIDTH < 375 ? 16 : SCREEN_WIDTH > 414 ? 24 : 20;

// Export screen width for use in other calculations
export { SCREEN_WIDTH };
