import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LiveSessionStartRequest = {
  user_id: string;
  dance_type: string;
  content_id: string;
};

type LiveSessionEndRequest = {
  session_id: string;
};

export type LiveSessionStartResponse = {
  session_id: string;
  user_id: string;
  status: string;
  started_at: string;
  ws_url: string;
  dance_type: string;
  content_id: string;
};

export type LiveSessionEndResponse = {
  session_id: string;
  status: string;
  ended_at: string;
  total_frames: number;
  total_calories: number;
  message: string;
};

const SERVER_PORT = '8000';

function getServerHost() {
  const explicitHost = process.env.EXPO_PUBLIC_SERVER_HOST?.trim();
  if (explicitHost) {
    return explicitHost;
  }

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

export function getGeneralServerBaseUrl() {
  return `http://${getServerHost()}:${SERVER_PORT}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getGeneralServerBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getServerHealth() {
  return requestJson<{ name: string; role: string }>('/health', {
    method: 'GET',
  });
}

export async function getAppMetadata() {
  return requestJson<{
    app_name: string;
    tabs: Array<{ key: string; label: string }>;
    endpoints: Record<string, string>;
  }>('/api/app', {
    method: 'GET',
  });
}

export async function startLiveSession(payload: LiveSessionStartRequest) {
  return requestJson<LiveSessionStartResponse>('/api/live/session/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function endLiveSession(payload: LiveSessionEndRequest) {
  return requestJson<LiveSessionEndResponse>('/api/live/session/end', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/*
Example usage:

import { getAppMetadata, getServerHealth, startLiveSession } from '@/services/general-api';

const health = await getServerHealth();
const appInfo = await getAppMetadata();
const session = await startLiveSession({
  user_id: 'user-lee',
  dance_type: 'kpop',
  content_id: 'dance-001',
});
*/
