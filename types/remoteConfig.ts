/**
 * Remote Config Types
 * Schema for the server-hosted app configuration JSON.
 */

export type AppNetworkId = 'mutinynet' | 'mainnet';
export type AnnouncementShowMode = 'once' | 'always';

export interface RemoteConfigNetwork {
  id: AppNetworkId;
  endpointOverrides: {
    esploraApiUrl: string | null;
    ordUrl: string | null;
    guardianWs: string | null;
    quoteServer: string | null;
    priceServer: string | null;
    vaultUrl: string | null;
    phoneUrl: string | null;
    feeRecommendationsUrl: string | null;
    faucetUrl: string | null;
  };
}

export interface RemoteConfigBanner {
  visible: boolean;
  text: string;
  textColor: string;
  backgroundColor: string;
}

export interface RemoteConfigAnnouncement {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  showMode: AnnouncementShowMode;
}

export interface RemoteConfig {
  version: string;
  hash: string;
  network: RemoteConfigNetwork;
  banner: RemoteConfigBanner;
  announcement: RemoteConfigAnnouncement;
  features: Record<string, boolean>;
}
