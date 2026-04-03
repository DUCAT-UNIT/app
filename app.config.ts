if (process.env.NODE_ENV === 'production' && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true') {
  throw new Error('SECURITY: E2E bypass cannot be enabled in production builds');
}

const appNetwork = process.env.EXPO_PUBLIC_APP_NETWORK?.trim() || 'mutinynet';
if (!['mutinynet', 'mainnet'].includes(appNetwork)) {
  throw new Error('EXPO_PUBLIC_APP_NETWORK must be "mutinynet" or "mainnet"');
}

if (appNetwork === 'mainnet') {
  const requiredMainnetVars = [
    'EXPO_PUBLIC_ORD_API_URL',
    'EXPO_PUBLIC_GUARDIAN_WS_URL',
    'EXPO_PUBLIC_MASTER_CONTRACT_ID',
    'EXPO_PUBLIC_UNIT_RUNE_BLOCK',
    'EXPO_PUBLIC_UNIT_RUNE_TX',
  ];

  const missing = requiredMainnetVars.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Mainnet build is missing required environment variables: ${missing.join(', ')}`
    );
  }
}

import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

const config: ExpoConfig = appJson.expo as ExpoConfig;

export default config;
