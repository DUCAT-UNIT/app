/**
 * NavigationIcons - Navigation and core action icons
 * Re-exports from modular icon files
 */

import { NavIcons } from './navigation/NavIcons';
import { ActionIcons } from './navigation/ActionIcons';
import { StatusIcons } from './navigation/StatusIcons';

export const NavigationIcons = {
  ...NavIcons,
  ...ActionIcons,
  ...StatusIcons,
};
