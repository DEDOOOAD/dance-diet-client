import { getGeneralServerLoginEndpoint, getGeneralServerSignupEndpoint } from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 8000;

export type GeneralServerSignupInput = {
  name: string;
  email: string;
  password: string;
  age: number;
};

export type GeneralServerSignupResult = {
  userId: string;
};

export type GeneralServerLoginInput = {
  email: string;
  password: string;
};

export type GeneralServerLoginResult = {
  success: boolean;
  userId: string | null;
};

type GeneralServerRpcLikePayload =
  | boolean
  | string
  | null
  | undefined
  | Record<string, unknown>
  | Array<unknown>;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getErrorMessage(defaultMessage: string, detail: string, status: number) {
  return detail || `${defaultMessage} (${status}).`;
}

function getUserIdFromValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidates = ['uuid', 'UUID', 'userId', 'user_id', 'id'] as const;
  for (const key of candidates) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function parseLoginPayload(payload: GeneralServerRpcLikePayload): GeneralServerLoginResult {
  if (payload === false || payload === null || payload === undefined) {
    return { success: false, userId: null };
  }

  if (payload === true) {
    return { success: true, userId: null };
  }

  if (typeof payload === 'string') {
    return { success: payload.trim().length > 0, userId: getUserIdFromValue(payload) };
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return { success: false, userId: null };
    }

    return {
      success: true,
      userId: getUserIdFromValue(payload[0]),
    };
  }

  const explicitSuccess = 'success' in payload ? payload.success : undefined;
  if (typeof explicitSuccess === 'boolean') {
    return {
      success: explicitSuccess,
      userId: getUserIdFromValue(payload),
    };
  }

  const nestedData = 'data' in payload ? (payload.data as unknown) : undefined;
  if (Array.isArray(nestedData)) {
    if (nestedData.length === 0) {
      return { success: false, userId: null };
    }

    return {
      success: true,
      userId: getUserIdFromValue(nestedData[0]),
    };
  }

  if (typeof nestedData === 'boolean') {
    return { success: nestedData, userId: null };
  }

  if (typeof nestedData === 'string') {
    return { success: nestedData.trim().length > 0, userId: getUserIdFromValue(nestedData) };
  }

  return {
    success: true,
    userId: getUserIdFromValue(payload),
  };
}

export async function signUpWithGeneralServer({
  name,
  email,
  password,
  age,
}: GeneralServerSignupInput): Promise<GeneralServerSignupResult> {
  const response = await fetchWithTimeout(getGeneralServerSignupEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      age,
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(getErrorMessage('회원가입 요청에 실패했어요.', detail, response.status));
  }

  const payload = (await response.json()) as boolean | string;
  if (payload === false || typeof payload !== 'string' || !payload.trim()) {
    throw new Error('서버가 회원가입 결과를 올바르게 반환하지 않았어요.');
  }

  return {
    userId: payload.trim(),
  };
}

export async function signInWithGeneralServer({
  email,
  password,
}: GeneralServerLoginInput): Promise<GeneralServerLoginResult> {
  const loginUrl = new URL(getGeneralServerLoginEndpoint());
  loginUrl.searchParams.set('Email', normalizeEmail(email));
  loginUrl.searchParams.set('password', password);

  const response = await fetchWithTimeout(loginUrl.toString(), {
    method: 'POST',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(getErrorMessage('로그인 요청에 실패했어요.', detail, response.status));
  }

  const payload = (await response.json()) as GeneralServerRpcLikePayload;
  console.log('[auth] raw login payload', payload);
  const result = parseLoginPayload(payload);

  if (!result.success) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않아요.');
  }

  return result;
}
