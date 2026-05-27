import { fetchMonthlyRecords } from '@/services/record-tab';
import {
  getGeneralServerDailyFoodIntakeEndpoint,
  getGeneralServerHomeEndpoint,
  getGeneralServerProfileByIdEndpoint,
} from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 12000;

export type HomeSummary = {
  userName: string;
  currentStreak: number;
  targetKcal: number;
  todayIntakeKcal: number;
};

export type HomeWeekActivity = {
  dateKey: string;
  kcal: number;
  minutes: number;
  count: number;
};

type JsonRecord = Record<string, unknown>;

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

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function fetchHomeSummary(userId: string): Promise<HomeSummary> {
  const [profileResponse, homeResponse] = await Promise.all([
    fetchWithTimeout(getGeneralServerProfileByIdEndpoint(userId)),
    fetchWithTimeout(getGeneralServerHomeEndpoint(userId)),
  ]);

  const [profilePayload, homePayload] = await Promise.all([
    parseJsonResponse(profileResponse),
    parseJsonResponse(homeResponse),
  ]);

  if (!profileResponse.ok) {
    throw new Error(getErrorDetail(profilePayload, 'Failed to load profile', profileResponse.status));
  }

  if (!homeResponse.ok) {
    throw new Error(getErrorDetail(homePayload, 'Failed to load home summary', homeResponse.status));
  }

  const profile = asRecord(profilePayload);
  const home = asRecord(homePayload);

  return {
    userName: asString(profile?.name, profile?.Name) ?? 'USER',
    currentStreak: Math.max(0, Math.round(asNumber(home?.current_streak, profile?.current_streak, profile?.Current_streak) ?? 0)),
    targetKcal: Math.max(0, Math.round(asNumber(home?.today_target_kcal, home?.target_kcal, profile?.today_target_kcal, profile?.target_kcal) ?? 0)),
    todayIntakeKcal: Math.max(0, Math.round(asNumber(home?.today_intake_kcal, home?.daily_intake_kcal, home?.intake_kcal) ?? 0)),
  };
}

export async function fetchWeekActivity(userId: string, dates: Date[]): Promise<Record<string, HomeWeekActivity>> {
  const uniqueMonths = Array.from(
    new Set(
      dates.map((date) => monthKeyFromDate(date))
    )
  );

  const responses = await Promise.all(
    uniqueMonths.map(async (monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      return fetchMonthlyRecords(userId, new Date(year, month - 1, 1));
    })
  );

  const mergedCalendar = responses.flatMap((response) => response.calendar);
  const calendarByDateKey = new Map(mergedCalendar.map((item) => [item.dateKey, item]));

  return dates.reduce<Record<string, HomeWeekActivity>>((result, date) => {
    const dateKey = dateKeyFromDate(date);
    const calendarItem = calendarByDateKey.get(dateKey);

    result[dateKey] = {
      dateKey,
      kcal: calendarItem?.kcal ?? 0,
      minutes: calendarItem?.minutes ?? 0,
      count: calendarItem?.count ?? 0,
    };

    return result;
  }, {});
}

export async function fetchDailyIntakeKcal(userId: string, date: Date): Promise<number> {
  const response = await fetchWithTimeout(
    getGeneralServerDailyFoodIntakeEndpoint(userId, date.getFullYear(), date.getMonth() + 1, date.getDate())
  );
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorDetail(payload, 'Failed to load daily food intake', response.status));
  }

  const record = asRecord(payload);
  return Math.max(0, Math.round(asNumber(record?.TotalCalories, record?.totalCalories, record?.total_calories) ?? 0));
}
