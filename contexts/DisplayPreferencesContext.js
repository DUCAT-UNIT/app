/**
 * DisplayPreferencesContext - DEPRECATED
 * This context has been merged into UIContext
 * This file provides backwards compatibility by re-exporting from UIContext
 *
 * @deprecated Use UIContext instead
 */

import { UIProvider, useDisplayPreferences } from './UIContext';

// Re-export for backwards compatibility
export { useDisplayPreferences };
export const DisplayPreferencesProvider = UIProvider;
