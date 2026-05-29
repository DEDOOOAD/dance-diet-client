import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SERVER_PORT = '8000';
const LOCAL_SERVER_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function hasUrlScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function addProtocol(value: string, protocol: 'http' | 'https' | 'ws' | 'wss') {
  if (hasUrlScheme(value)) {
    return value;
  }

  return `${protocol}://${value}`;
}

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function withDefaultPort(host: string) {
  if (/:\d+$/.test(host) || /^\[[^\]]+\]:\d+$/.test(host)) {
    return host;
  }

  return `${host}:${SERVER_PORT}`;
}

function getExpoHostFallback() {
  const expoHost =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (expoHost) {
    return expoHost.split(':')[0];
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return '127.0.0.1';
}

function normalizeExplicitBaseUrl(value: string, protocol: 'http' | 'ws') {
  const preferredScheme = protocol === 'http' ? 'https' : 'wss';
  const normalized = addProtocol(value.trim(), preferredScheme);
  const parsed = tryParseUrl(normalized);

  if (!parsed) {
    return trimTrailingSlash(normalized);
  }

  return trimTrailingSlash(parsed.toString());
}

function normalizeLegacyHostUrl(value: string, protocol: 'http' | 'ws') {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (hasUrlScheme(trimmed)) {
    const parsed = tryParseUrl(trimmed);
    if (!parsed) {
      return trimTrailingSlash(trimmed);
    }

    if (protocol === 'http' && parsed.protocol === 'ws:') {
      parsed.protocol = 'http:';
    }

    if (protocol === 'http' && parsed.protocol === 'wss:') {
      parsed.protocol = 'https:';
    }

    if (protocol === 'ws' && parsed.protocol === 'http:') {
      parsed.protocol = 'ws:';
    }

    if (protocol === 'ws' && parsed.protocol === 'https:') {
      parsed.protocol = 'wss:';
    }

    return trimTrailingSlash(parsed.toString());
  }

  return `${protocol}://${withDefaultPort(trimmed)}`;
}

function replaceHttpSchemeWithWs(httpBaseUrl: string) {
  const parsed = tryParseUrl(httpBaseUrl);
  if (!parsed) {
    return httpBaseUrl.replace(/^http/i, 'ws');
  }

  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return trimTrailingSlash(parsed.toString());
}

export function joinUrl(baseUrl: string, path: string) {
  const trimmedBase = trimTrailingSlash(baseUrl);
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

export function getGeneralServerHttpBaseUrl() {
  const explicitApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicitApiBaseUrl) {
    return normalizeExplicitBaseUrl(explicitApiBaseUrl, 'http');
  }

  const legacyHost = process.env.EXPO_PUBLIC_SERVER_HOST?.trim();
  if (legacyHost) {
    return normalizeLegacyHostUrl(legacyHost, 'http') ?? `http://${getExpoHostFallback()}:${SERVER_PORT}`;
  }

  return `http://${getExpoHostFallback()}:${SERVER_PORT}`;
}

export function getGeneralServerWsBaseUrl() {
  const explicitWsBaseUrl = process.env.EXPO_PUBLIC_WS_BASE_URL?.trim();
  if (explicitWsBaseUrl) {
    return normalizeExplicitBaseUrl(explicitWsBaseUrl, 'ws');
  }

  const explicitApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicitApiBaseUrl) {
    return replaceHttpSchemeWithWs(normalizeExplicitBaseUrl(explicitApiBaseUrl, 'http'));
  }

  const legacyHost = process.env.EXPO_PUBLIC_SERVER_HOST?.trim();
  if (legacyHost) {
    return normalizeLegacyHostUrl(legacyHost, 'ws') ?? replaceHttpSchemeWithWs(getGeneralServerHttpBaseUrl());
  }

  return replaceHttpSchemeWithWs(getGeneralServerHttpBaseUrl());
}

export function buildGeneralServerHttpUrl(path: string) {
  return joinUrl(getGeneralServerHttpBaseUrl(), path);
}

export function buildGeneralServerWsUrl(path: string) {
  return joinUrl(getGeneralServerWsBaseUrl(), path);
}

export function resolveGeneralServerLiveSessionWsUrl(wsUrl: string | undefined, sessionId: string) {
  const fallbackWsBaseUrl = getGeneralServerWsBaseUrl();

  if (!wsUrl) {
    return joinUrl(fallbackWsBaseUrl, `ws/live/${sessionId}`);
  }

  try {
    const parsedUrl = new URL(wsUrl);
    if (LOCAL_SERVER_HOSTS.has(parsedUrl.hostname)) {
      return joinUrl(fallbackWsBaseUrl, `ws/live/${sessionId}`);
    }

    return parsedUrl.toString();
  } catch {
    return joinUrl(fallbackWsBaseUrl, `ws/live/${sessionId}`);
  }
}
