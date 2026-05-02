/**
 * Ducat Design System
 * Industry-standard style architecture
 *
 * USAGE:
 *
 * 1. Default import (backwards compatible):
 *    import styles from '../styles';
 *    <View style={styles.lockScreen} />
 *
 * 2. Feature-specific named exports:
 *    import { commonStyles, authStyles, walletStyles } from '../styles';
 */

// =============================================================================
// BACKWARDS COMPATIBLE DEFAULT EXPORT
// =============================================================================

import {
  common,
  auth,
  wallet,
  send,
  receive,
  vault,
  settings,
  history,
  splash,
} from './screens';

// Combine all styles into a single object for backwards compatibility
// This allows: import styles from '../styles'; style={styles.button}
const styles = {
  ...common,
  ...auth,
  ...wallet,
  ...send,
  ...receive,
  ...vault,
  ...settings,
  ...history,
  ...splash,
};

export default styles;
