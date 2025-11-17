// Import all feature-based style modules
import { commonStyles } from './common';
import { splashStyles } from './splash';
import { authStyles } from './auth';
import { walletStyles } from './wallet';
import { sendStyles } from './send';
import { receiveStyles } from './receive';
import { vaultStyles } from './vault';
import { settingsStyles } from './settings';
import { historyStyles } from './history';

// Export individual style modules for new code
export { commonStyles } from './common';
export { splashStyles } from './splash';
export { authStyles } from './auth';
export { walletStyles } from './wallet';
export { sendStyles } from './send';
export { receiveStyles } from './receive';
export { vaultStyles } from './vault';
export { settingsStyles } from './settings';
export { historyStyles } from './history';

// Export combined styles object for backwards compatibility
// This allows existing code to continue using: import styles from './styles'
const styles = {
  ...commonStyles,
  ...splashStyles,
  ...authStyles,
  ...walletStyles,
  ...sendStyles,
  ...receiveStyles,
  ...vaultStyles,
  ...settingsStyles,
  ...historyStyles,
};

export default styles;
