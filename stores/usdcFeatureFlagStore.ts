import { create } from 'zustand';

interface UsdcFeatureFlagState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useUsdcFeatureFlagStore = create<UsdcFeatureFlagState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));

export function resetUsdcFeatureFlagStore(): void {
  useUsdcFeatureFlagStore.setState({ enabled: false });
}
