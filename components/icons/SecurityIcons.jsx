/**
 * SecurityIcons - Security and authentication icons
 * Re-exports from modular icon files
 */

import { AuthenticationIcons } from './security/AuthenticationIcons';
import { AccountIcons } from './security/AccountIcons';
import { PrivacyIcons } from './security/PrivacyIcons';
import { RecoveryIcons } from './security/RecoveryIcons';

export const SecurityIcons = {
  ...AuthenticationIcons,
  ...AccountIcons,
  ...PrivacyIcons,
  ...RecoveryIcons,
};
