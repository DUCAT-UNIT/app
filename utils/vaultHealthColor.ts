/**
 * Shared vault health color utility
 * Maps health factor percentage to semantic colors
 */

import { colors } from '../styles/theme';

/**
 * Get color for a vault health factor value
 * @param health - Health factor percentage (e.g. 160, 200, 250)
 * @returns Hex color string
 */
export function getHealthColor(health: number): string {
  if (health >= 200) return colors.semantic.success;
  if (health >= 161) return '#fde37b';
  return colors.semantic.error;
}
