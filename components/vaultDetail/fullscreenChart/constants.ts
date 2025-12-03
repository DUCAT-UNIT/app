/**
 * FullscreenChart Constants
 * Dimensions and configuration for fullscreen vault chart
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Drawer width
export const DRAWER_WIDTH = 280;

// Chart margins
export const LEFT_MARGIN = 50;
export const RIGHT_MARGIN = 0;

// Portrait dimensions (no rotation)
export const PORTRAIT_WIDTH = SCREEN_WIDTH;
export const PORTRAIT_HEIGHT = SCREEN_HEIGHT;

// Chart padding
export const CHART_PADDING = { top: 70, right: 0, bottom: 70, left: 0 };

// Cache settings (reused from vaultChart but local for isolation)
export const CACHE_KEY_PREFIX = 'vault_btc_price_cache_';
export const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
