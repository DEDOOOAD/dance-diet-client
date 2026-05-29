import {
  getGeneralServerHalfWeightRecordsEndpoint,
  getGeneralServerProfileByIdEndpoint,
  getGeneralServerRecordsEndpoint,
} from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 12000;

export type RecordMonthSummary = {
  totalKcal: number;
  totalMinutes: number;
  activeDays: number;
  sessionCount: number;
  avgKcalPerSession: number;
  peakWeekLabel: string;
  peakWeekKcal: number;
};

export type RecordMonthCalendarItem = {
  dateKey: string;
  day: number;
  kcal: number;
  minutes: number;
  count: number;
};

export type RecordMonthSession = {
  id: string;
  dateKey: string;
  performedAt: string | null;
  danceName: string;
  danceType: string | null;
  kcal: number;
  durationMinutes: number;
  movementScore: number | null;
};

export type RecordMonthResponse = {
  summary: RecordMonthSummary;
  calendar: RecordMonthCalendarItem[];
  sessions: RecordMonthSession[];
};

export type WeightHistoryPoint = {
  key: string;
  dateKey: string;
  label: string;
  shortLabel: string;
  weightKg: number;
  note: string;
};

export type RecordWeightResponse = {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  history: WeightHistoryPoint[];
  source: 'weight-history' | 'profile-fallback' | 'empty';
};

type JsonRecord = Record<string, unknown>;

type MonthlyDayRecord = {
  dateKey: string;
  day: number;
  kcal: number;
  minutes: number;
  count: number;
  weightKg: number | null;
  movementScore: number | null;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function shortMonthLabel(month: number) {
  return `${month}월`;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
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

function parseDateParts(value: string) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) {
    return null;
  }

  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
}

function normalizeDateKey(value: unknown) {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const normalizedRaw = raw.slice(0, 10);
  const directParts = parseDateParts(normalizedRaw);
  if (directParts) {
    return dateKeyFromParts(directParts.year, directParts.month, directParts.day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return dateKeyFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function toDurationMinutes(record: JsonRecord) {
  const durationMinutes = asNumber(
    record.durationMinutes,
    record.duration_minutes,
    record.duration,
    record.minutes,
    record.totalMinutes,
    record.total_minutes
  );

  if (durationMinutes !== null) {
    return Math.max(0, Math.round(durationMinutes));
  }

  const elapsedSeconds = asNumber(
    record.elapsedSeconds,
    record.elapsed_seconds,
    record.durationSeconds,
    record.duration_seconds,
    record.total_duration_seconds
  );

  if (elapsedSeconds !== null) {
    return Math.max(0, Math.round(elapsedSeconds / 60));
  }

  return 0;
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

function getMonthlyDayRecords(payload: unknown, year: number, month: number): MonthlyDayRecord[] {
  const payloadRecord = asRecord(payload);
  const source = asArray(payloadRecord?.days);

  return source
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => item !== null)
    .map((record) => {
      const dateKey =
        normalizeDateKey(record.summary_date) ??
        normalizeDateKey(record.dateKey) ??
        normalizeDateKey(record.date_key) ??
        normalizeDateKey(record.day);

      if (!dateKey) {
        return null;
      }

      const parts = parseDateParts(dateKey);
      if (!parts || parts.year !== year || parts.month !== month) {
        return null;
      }

      return {
        dateKey,
        day: parts.day,
        kcal: Math.max(0, Math.round(asNumber(record.total_burned_kcal, record.kcal, record.total_kcal) ?? 0)),
        minutes: toDurationMinutes(record),
        count: Math.max(0, Math.round(asNumber(record.session_count, record.count, record.sessionCount) ?? 0)),
        weightKg: asNumber(record.weight, record.weightKg, record.weight_kg, record.kg),
        movementScore: asNumber(record.movementScore, record.movement_score, record.achievement_rate),
      } satisfies MonthlyDayRecord;
    })
    .filter((item): item is MonthlyDayRecord => item !== null)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
}

function toMonthlySessions(days: MonthlyDayRecord[]): RecordMonthSession[] {
  return days
    .filter((item) => item.count > 0 || item.kcal > 0 || item.minutes > 0)
    .map((item, index) => ({
      id: `${item.dateKey}-${index}`,
      dateKey: item.dateKey,
      performedAt: item.dateKey,
      danceName: item.count > 0 ? `운동 기록 ${item.count}회` : '운동 기록',
      danceType: null,
      kcal: item.kcal,
      durationMinutes: item.minutes,
      movementScore: item.movementScore,
    }))
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}

function toMonthlyCalendar(days: MonthlyDayRecord[]): RecordMonthCalendarItem[] {
  return days.map((item) => ({
    dateKey: item.dateKey,
    day: item.day,
    kcal: item.kcal,
    minutes: item.minutes,
    count: item.count,
  }));
}

function computePeakWeek(calendar: RecordMonthCalendarItem[]) {
  const buckets = [0, 0, 0, 0, 0];

  calendar.forEach((item) => {
    const bucketIndex = Math.min(4, Math.floor((Math.max(item.day, 1) - 1) / 7));
    buckets[bucketIndex] += item.kcal;
  });

  let bestIndex = 0;
  let bestValue = 0;
  buckets.forEach((value, index) => {
    if (value > bestValue) {
      bestIndex = index;
      bestValue = value;
    }
  });

  return {
    label: `${bestIndex + 1}주차`,
    kcal: bestValue,
  };
}

function toMonthlySummary(calendar: RecordMonthCalendarItem[]): RecordMonthSummary {
  const totalKcal = calendar.reduce((sum, item) => sum + item.kcal, 0);
  const totalMinutes = calendar.reduce((sum, item) => sum + item.minutes, 0);
  const activeDays = calendar.filter((item) => item.count > 0 || item.kcal > 0 || item.minutes > 0).length;
  const sessionCount = calendar.reduce((sum, item) => sum + item.count, 0);
  const peakWeek = computePeakWeek(calendar);

  return {
    totalKcal,
    totalMinutes,
    activeDays,
    sessionCount,
    avgKcalPerSession: sessionCount > 0 ? Math.round(totalKcal / sessionCount) : 0,
    peakWeekLabel: peakWeek.label,
    peakWeekKcal: peakWeek.kcal,
  };
}

function normalizeProfileWeights(payload: unknown) {
  const record = asRecord(payload);
  return {
    currentWeightKg: asNumber(record?.weight, record?.Weight, record?.weightKg, record?.weight_kg),
    targetWeightKg: asNumber(
      record?.target_weight,
      record?.Target_weight,
      record?.targetWeight,
      record?.targetWeightKg,
      record?.target_weight_kg
    ),
  };
}

function toWeightHistoryPoints(payload: unknown, selectedMonth: Date) {
  const payloadRecord = asRecord(payload);
  const source = asArray(payloadRecord?.weights);
  const firstMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 5, 1);
  const lastMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

  return source
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => item !== null)
    .map((record) => {
      const year = asNumber(record.year);
      const month = asNumber(record.month);
      const avgWeight = asNumber(record.avg_weight, record.avgWeight, record.weight, record.weightKg);

      if (year === null || month === null || avgWeight === null) {
        return null;
      }

      const date = new Date(year, month - 1, 1);
      if (Number.isNaN(date.getTime()) || date < firstMonth || date > lastMonth) {
        return null;
      }

      return {
        key: asString(record.date_key, record.dateKey) ?? `${year}-${pad(month)}`,
        dateKey: dateKeyFromParts(year, month, 1),
        label: monthLabel(year, month),
        shortLabel: shortMonthLabel(month),
        weightKg: Number(avgWeight.toFixed(1)),
        note: '월평균 체중',
      } satisfies WeightHistoryPoint;
    })
    .filter((item): item is WeightHistoryPoint => item !== null)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
}

export async function fetchMonthlyRecords(userId: string, selectedMonth: Date): Promise<RecordMonthResponse> {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth() + 1;
  const response = await fetchWithTimeout(
    getGeneralServerRecordsEndpoint({
      period: 'monthly',
      userId,
      year,
      month,
    })
  );
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorDetail(payload, '기록 데이터를 불러오지 못했어요.', response.status));
  }

  const days = getMonthlyDayRecords(payload, year, month);
  const calendar = toMonthlyCalendar(days);
  const sessions = toMonthlySessions(days);
  const summary = toMonthlySummary(calendar);

  return {
    summary,
    calendar,
    sessions,
  };
}

export async function fetchWeightRecords(userId: string, selectedMonth: Date): Promise<RecordWeightResponse> {
  const profileResponse = await fetchWithTimeout(getGeneralServerProfileByIdEndpoint(userId));
  const profilePayload = await parseJsonResponse(profileResponse);

  if (!profileResponse.ok) {
    throw new Error(getErrorDetail(profilePayload, '프로필 데이터를 불러오지 못했어요.', profileResponse.status));
  }

  const { currentWeightKg, targetWeightKg } = normalizeProfileWeights(profilePayload);

  try {
    const weightResponse = await fetchWithTimeout(
      getGeneralServerHalfWeightRecordsEndpoint({
        userId,
        year: selectedMonth.getFullYear(),
        month: selectedMonth.getMonth() + 1,
      })
    );
    const weightPayload = await parseJsonResponse(weightResponse);

    if (weightResponse.ok) {
      const history = toWeightHistoryPoints(weightPayload, selectedMonth);
      if (history.length > 0) {
        return {
          currentWeightKg: currentWeightKg ?? history[history.length - 1]?.weightKg ?? null,
          targetWeightKg,
          history,
          source: 'weight-history',
        };
      }
    }
  } catch {
    // Fall back to the profile values when the aggregated weight records are unavailable.
  }

  if (currentWeightKg !== null) {
    const fallbackYear = selectedMonth.getFullYear();
    const fallbackMonth = selectedMonth.getMonth() + 1;
    return {
      currentWeightKg,
      targetWeightKg,
      history: [
        {
          key: `${fallbackYear}-${pad(fallbackMonth)}-profile`,
          dateKey: dateKeyFromParts(fallbackYear, fallbackMonth, 1),
          label: monthLabel(fallbackYear, fallbackMonth),
          shortLabel: shortMonthLabel(fallbackMonth),
          weightKg: Number(currentWeightKg.toFixed(1)),
          note: '프로필에 저장된 현재 체중',
        },
      ],
      source: 'profile-fallback',
    };
  }

  return {
    currentWeightKg: null,
    targetWeightKg,
    history: [],
    source: 'empty',
  };
}
