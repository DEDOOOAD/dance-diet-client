import { getGeneralServerFoodIntakeEndpoint } from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 30000;

type JsonRecord = Record<string, unknown>;

export type FoodAnalysisItem = {
  label: string;
  calories: number;
  confidence: number;
};

export type FoodIntakeAnalysisResult = {
  foods: FoodAnalysisItem[];
  totalCalories: number;
  imageFilename: string | null;
  source: string;
  analyzedAt: string;
  note: string | null;
};

export type UploadFoodIntakeInput = {
  userId: string;
  day?: Date | null;
  imageUri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

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

function getErrorDetail(payload: unknown, fallbackMessage: string, status: number) {
  const record = asRecord(payload);
  const detail = asString(record?.detail, record?.message, record?.error, record?.note);
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

function inferMimeType(fileName: string | null | undefined, imageUri: string) {
  const lower = `${fileName ?? imageUri}`.toLowerCase();

  if (lower.endsWith('.png')) {
    return 'image/png';
  }

  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }

  if (lower.endsWith('.heic')) {
    return 'image/heic';
  }

  return 'image/jpeg';
}

function inferFileName(fileName: string | null | undefined, imageUri: string) {
  if (fileName && fileName.trim()) {
    return fileName.trim();
  }

  const lastSegment = imageUri.split('/').pop();
  if (lastSegment && lastSegment.includes('.')) {
    return lastSegment;
  }

  return 'food-photo.jpg';
}

function normalizeFoodAnalysisResult(payload: unknown): FoodIntakeAnalysisResult {
  const record = asRecord(payload);
  const foods = asArray(record?.foods).map((item) => {
    const food = asRecord(item);
    return {
      label: asString(food?.label, food?.name) ?? '음식',
      calories: Math.max(0, Math.round(asNumber(food?.calories) ?? 0)),
      confidence: Math.max(0, Math.min(1, asNumber(food?.confidence) ?? 0)),
    };
  });

  return {
    foods,
    totalCalories: Math.max(0, Math.round(asNumber(record?.total_calories, record?.totalCalories) ?? 0)),
    imageFilename: asString(record?.image_filename, record?.imageFilename),
    source: asString(record?.source) ?? 'general-server',
    analyzedAt: asString(record?.analyzed_at, record?.analyzedAt) ?? new Date().toISOString(),
    note: asString(record?.note),
  };
}

export async function uploadFoodIntake({
  userId,
  day,
  imageUri,
  fileName,
  mimeType,
}: UploadFoodIntakeInput): Promise<FoodIntakeAnalysisResult> {
  const resolvedFileName = inferFileName(fileName, imageUri);
  const resolvedMimeType = mimeType ?? inferMimeType(resolvedFileName, imageUri);
  const formData = new FormData();

  formData.append('uuid', userId);
  if (day) {
    formData.append('day', day.toISOString());
  }
  formData.append('image', {
    uri: imageUri,
    name: resolvedFileName,
    type: resolvedMimeType,
  } as any);

  const response = await fetchWithTimeout(getGeneralServerFoodIntakeEndpoint(), {
    method: 'POST',
    body: formData,
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorDetail(payload, 'Failed to upload food intake image', response.status));
  }

  return normalizeFoodAnalysisResult(payload);
}
