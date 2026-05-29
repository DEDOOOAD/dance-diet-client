import {
  getGeneralServerProfileByIdEndpoint,
  getGeneralServerProfilePrototypeEndpoint,
} from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 12000;

type JsonRecord = Record<string, unknown>;

export type UserBodyProfile = {
  userName: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  targetDurationWeeks: string;
  currentStreak: number;
};

export type UpdateBodyProfileInput = {
  userId: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  targetDurationWeeks: string;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function asNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getErrorDetail(payload: unknown, fallbackMessage: string, status: number) {
  const record = asRecord(payload);
  const detail = asString(record?.detail, record?.message, record?.error);
  return detail ?? `${fallbackMessage} (${status})`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function formatNumberString(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function calculateTargetDurationWeeks(targetDayValue: unknown) {
  const targetDayString = asString(targetDayValue);
  if (!targetDayString) {
    return '';
  }

  const targetDay = new Date(targetDayString);
  if (Number.isNaN(targetDay.getTime())) {
    return '';
  }

  const diffMs = targetDay.getTime() - Date.now();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const diffWeeks = Math.ceil(diffDays / 7);
  return diffWeeks > 0 ? String(diffWeeks) : '';
}

export async function fetchUserBodyProfile(userId: string): Promise<UserBodyProfile> {
  const response = await fetchWithTimeout(getGeneralServerProfileByIdEndpoint(userId));
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorDetail(payload, 'Failed to load profile', response.status));
  }

  const record = asRecord(payload);

  return {
    userName: asString(record?.name, record?.Name) ?? 'USER',
    heightCm: formatNumberString(asNumber(record?.height, record?.Height)),
    weightKg: formatNumberString(asNumber(record?.weight, record?.Weight)),
    targetWeightKg: formatNumberString(asNumber(record?.target_weight, record?.Target_weight)),
    targetDurationWeeks: calculateTargetDurationWeeks(record?.target_day ?? record?.Target_day),
    currentStreak: Math.max(0, Math.round(asNumber(record?.current_streak, record?.Current_streak) ?? 0)),
  };
}

export async function updateUserBodyProfile({
  userId,
  heightCm,
  weightKg,
  targetWeightKg,
  targetDurationWeeks,
}: UpdateBodyProfileInput) {
  const formData = new FormData();
  const normalizedHeight = heightCm.trim();
  const normalizedWeight = weightKg.trim();
  const normalizedTargetWeight = targetWeightKg.trim();
  const normalizedTargetDurationWeeks = targetDurationWeeks.trim();

  if (normalizedHeight) {
    formData.append('height', normalizedHeight);
  }
  if (normalizedWeight) {
    formData.append('weight', normalizedWeight);
  }
  if (normalizedTargetWeight) {
    formData.append('target_weight', normalizedTargetWeight);
  }
  if (normalizedTargetDurationWeeks) {
    const weeks = Number(normalizedTargetDurationWeeks);
    if (Number.isFinite(weeks) && weeks > 0) {
      const targetDay = new Date();
      targetDay.setDate(targetDay.getDate() + Math.round(weeks * 7));
      formData.append('target_day', targetDay.toISOString());
    }
  }

  const response = await fetchWithTimeout(getGeneralServerProfilePrototypeEndpoint(userId), {
    method: 'PUT',
    body: formData,
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorDetail(payload, 'Failed to update profile', response.status));
  }

  return payload;
}
