import { getGeneralServerSignupEndpoint } from '@/services/server-config/general-server';

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
    throw new Error(detail || `회원가입 요청이 실패했어요 (${response.status}).`);
  }

  const payload = (await response.json()) as boolean | string;
  if (payload === false || typeof payload !== 'string' || !payload.trim()) {
    throw new Error('서버가 회원가입 결과를 올바르게 돌려주지 않았어요.');
  }

  return {
    userId: payload.trim(),
  };
}
