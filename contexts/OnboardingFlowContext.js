/**
 * OnboardingFlowContext - DEPRECATED
 * This context has been merged into AuthContext
 * This file provides backwards compatibility by re-exporting from AuthContext
 *
 * @deprecated Use AuthContext instead
 */

import { AuthProvider, useOnboardingFlow } from './AuthContext';

// Re-export for backwards compatibility
export { useOnboardingFlow };
export const OnboardingFlowProvider = AuthProvider;
