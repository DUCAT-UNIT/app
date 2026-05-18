import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

const appNetwork = process.env.EXPO_PUBLIC_APP_NETWORK?.trim();
if (appNetwork && appNetwork !== 'mutinynet') {
  throw new Error(
    'DUCAT mobile is Mutinynet-only. EXPO_PUBLIC_APP_NETWORK must be unset or "mutinynet".'
  );
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appConfig = appJson.expo as ExpoConfig;

  return {
    ...config,
    ...appConfig,
    extra: {
      ...(config.extra ?? {}),
      ...(appConfig.extra ?? {}),
    },
  };
};
