import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

if (process.env.NODE_ENV === 'production' && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true') {
  throw new Error('SECURITY: E2E bypass cannot be enabled in production builds');
}

const appNetwork = process.env.EXPO_PUBLIC_APP_NETWORK?.trim();
if (appNetwork && appNetwork !== 'mutinynet') {
  throw new Error('DUCAT mobile is Mutinynet-only. EXPO_PUBLIC_APP_NETWORK must be unset or "mutinynet".');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appConfig = appJson.expo as ExpoConfig;

  return {
    ...config,
    ...appConfig,
    extra: {
      ...(config.extra ?? {}),
      ...(appConfig.extra ?? {}),
      e2eBypass: process.env.EXPO_PUBLIC_E2E_BYPASS === 'true',
    },
  };
};
