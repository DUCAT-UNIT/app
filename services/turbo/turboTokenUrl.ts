import { fetchWithTimeout } from '../../utils/api';
import { logger } from '../../utils/logger';

const DIRECT_TOKEN_HOST = 'ducatprotocol.com';
const DIRECT_TOKEN_PATH = '/unit';
const SHORTENER_HOSTS = new Set(['short.ducatprotocol.com', 'go.ducatprotocol.com']);
const REDEEM_HOST = 'redeem.ducatprotocol.com';
const TOKEN_QUERY_PARAMS = ['token', 'cashuToken', 'cashu_token', 't'];

export const isSupportedCashuToken = (token: string): boolean => /^cashuB/i.test(token.trim());

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const decodeBase64Url = (value: string): string | null => {
  try {
    let base64Token = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64Token.length % 4) {
      base64Token += '=';
    }
    return atob(base64Token);
  } catch (error: unknown) {
    logger.debug('[TURBO] Failed to decode base64 token parameter', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const normalizeTokenCandidate = (candidate: string | null | undefined): string | null => {
  if (!candidate) return null;

  const trimmed = candidate.trim();
  if (!trimmed) return null;

  const decoded = safeDecodeURIComponent(trimmed).trim();
  if (isSupportedCashuToken(decoded)) {
    return decoded;
  }

  const base64Decoded = decodeBase64Url(decoded)?.trim();
  if (base64Decoded && isSupportedCashuToken(base64Decoded)) {
    return base64Decoded;
  }

  return null;
};

const getUrl = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    try {
      return new URL(url, `https://${DIRECT_TOKEN_HOST}`);
    } catch {
      return null;
    }
  }
};

const getTokenFromQuery = (url: string): string | null => {
  const parsed = getUrl(url);

  if (parsed) {
    for (const param of TOKEN_QUERY_PARAMS) {
      const token = normalizeTokenCandidate(parsed.searchParams.get(param));
      if (token) return token;
    }
  }

  for (const param of TOKEN_QUERY_PARAMS) {
    const match = url.match(new RegExp(`[?&]${param}=([^&#]+)`, 'i'));
    const token = normalizeTokenCandidate(match?.[1]);
    if (token) return token;
  }

  return null;
};

const getTokenFromHash = (url: string): string | null => {
  const parsed = getUrl(url);
  const rawHash = parsed?.hash ? parsed.hash.slice(1) : url.split('#')[1];
  if (!rawHash) return null;

  const token = normalizeTokenCandidate(rawHash);
  if (token) return token;

  const hashQuery = rawHash.includes('?') ? rawHash.slice(rawHash.indexOf('?') + 1) : rawHash;
  const params = new URLSearchParams(hashQuery.replace(/^\?/, ''));

  for (const param of TOKEN_QUERY_PARAMS) {
    const paramToken = normalizeTokenCandidate(params.get(param));
    if (paramToken) return paramToken;
  }

  return null;
};

const getTokenFromPath = (url: string): string | null => {
  const turboMatch = url.match(/(?:^|:\/\/|\/)turbo\/([^/?#]+)/i);
  const turboToken = normalizeTokenCandidate(turboMatch?.[1]);
  if (turboToken) return turboToken;

  const parsed = getUrl(url);
  if (!parsed) return null;

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  for (const segment of pathSegments) {
    const token = normalizeTokenCandidate(segment);
    if (token) return token;
  }

  return null;
};

export const extractCashuTokenFromUrl = (url: string): string | null => {
  if (!url) return null;

  const trimmed = url.trim();
  if (isSupportedCashuToken(trimmed)) {
    return trimmed;
  }

  return getTokenFromQuery(trimmed) ?? getTokenFromHash(trimmed) ?? getTokenFromPath(trimmed);
};

const getHostname = (url: string): string | null => {
  return getUrl(url)?.hostname.toLowerCase() ?? null;
};

export const isShortCashuTokenUrl = (url: string): boolean => {
  const parsed = getUrl(url);
  return !!parsed && SHORTENER_HOSTS.has(parsed.hostname.toLowerCase()) && parsed.pathname.length > 1;
};

export const isTurboTokenUrl = (url: string): boolean => {
  if (!url) return false;
  if (extractCashuTokenFromUrl(url)) return true;
  if (isShortCashuTokenUrl(url)) return true;

  const hostname = getHostname(url);
  const lower = url.toLowerCase();
  return (
    lower.includes('ducat://turbo/') ||
    lower.startsWith('turbo/') ||
    lower.includes('unit?') ||
    lower.includes('unit#') ||
    hostname === REDEEM_HOST
  );
};

const resolveRelativeLocation = (location: string, baseUrl: string): string => {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
};

interface ShortenerInfoResponse {
  success?: boolean;
  data?: {
    cashuToken?: string;
    redirectUrl?: string;
  };
}

const getShortenerInfoUrl = (url: string): string | null => {
  const parsed = getUrl(url);
  if (!parsed || !SHORTENER_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const code = parsed.pathname.split('/').filter(Boolean)[0];
  if (!code) return null;

  return `${parsed.origin}/api/info/${encodeURIComponent(code)}`;
};

const resolveShortCashuTokenViaInfoApi = async (url: string): Promise<string | null> => {
  const infoUrl = getShortenerInfoUrl(url);
  if (!infoUrl) return null;

  try {
    const response = await fetchWithTimeout(infoUrl, { method: 'GET' }, 5000);
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null) as ShortenerInfoResponse | null;
    const token = normalizeTokenCandidate(payload?.data?.cashuToken);
    if (token) return token;

    return extractCashuTokenFromUrl(payload?.data?.redirectUrl ?? '');
  } catch (error: unknown) {
    logger.debug('[TURBO] Failed to resolve short token URL via info API', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const resolveShortCashuTokenUrl = async (url: string): Promise<string | null> => {
  const apiToken = await resolveShortCashuTokenViaInfoApi(url);
  if (apiToken) return apiToken;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        redirect: 'manual',
      } as RequestInit,
      5000,
    );

    const location = response.headers?.get?.('location') ?? response.headers?.get?.('Location');
    if (location) {
      return extractCashuTokenFromUrl(resolveRelativeLocation(location, url));
    }

    if (response.url && response.url !== url) {
      const redirectedToken = extractCashuTokenFromUrl(response.url);
      if (redirectedToken) return redirectedToken;
    }

    const body = await response.text().catch(() => '');
    return extractCashuTokenFromUrl(body);
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to resolve short token URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const resolveCashuTokenFromUrl = async (url: string): Promise<string | null> => {
  const directToken = extractCashuTokenFromUrl(url);
  if (directToken) return directToken;

  if (isShortCashuTokenUrl(url)) {
    return resolveShortCashuTokenUrl(url);
  }

  return null;
};
