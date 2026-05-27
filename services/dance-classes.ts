import { colors } from '@/constants/theme';
import { danceClasses as fallbackDanceClasses, type DanceClass } from '@/data/dances';
import {
  getGeneralServerClassesEndpoint,
  getGeneralServerClassesSearchEndpoint,
} from '@/services/server-config/general-server';

const REQUEST_TIMEOUT_MS = 10000;
const LEVEL_INTERMEDIATE = fallbackDanceClasses[0]?.level;
const LEVEL_BEGINNER = fallbackDanceClasses[1]?.level ?? LEVEL_INTERMEDIATE;
const LEVEL_ENTRY = fallbackDanceClasses[2]?.level ?? LEVEL_BEGINNER;
const LEVEL_ADVANCED = fallbackDanceClasses[4]?.level ?? LEVEL_INTERMEDIATE;
type JsonRecord = Record<string, unknown>;

type DanceClassCatalogResult = {
  classes: DanceClass[];
  isFallback: boolean;
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

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[#,|/]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
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

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildSubtitle(description: string | null, title: string) {
  const base = compactWhitespace(description ?? '');
  if (!base) {
    return `${title} reference class from YouTube`;
  }

  return base.length > 90 ? `${base.slice(0, 90).trim()}...` : base;
}

function buildDescription(description: string | null, title: string, genre: string) {
  if (description && description.trim()) {
    return compactWhitespace(description);
  }

  return `${title} class collected from the general server YouTube catalog for ${genre} practice.`;
}

function formatDurationLabel(totalSeconds: number) {
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${totalMinutes}분`;
}

function inferLevel(durationSeconds: number): DanceClass['level'] {
  if (durationSeconds >= 2400) {
    return LEVEL_ADVANCED;
  }

  if (durationSeconds >= 1800) {
    return LEVEL_INTERMEDIATE;
  }

  if (durationSeconds >= 900) {
    return LEVEL_BEGINNER;
  }

  return LEVEL_ENTRY;
}

function inferGenre(title: string, description: string, tags: string[]) {
  const haystack = `${title} ${description} ${tags.join(' ')}`.toUpperCase();

  if (haystack.includes('K-POP') || haystack.includes('KPOP') || haystack.includes('아이돌')) {
    return 'K-POP';
  }

  if (haystack.includes('HIPHOP') || haystack.includes('HIP-HOP')) {
    return 'HIP-HOP';
  }

  if (haystack.includes('LATIN') || haystack.includes('SALSA') || haystack.includes('BACHATA')) {
    return 'LATIN';
  }

  if (haystack.includes('JAZZ')) {
    return 'JAZZ';
  }

  if (haystack.includes('HOUSE')) {
    return 'HOUSE';
  }

  return 'K-POP';
}

function inferIcon(genre: string) {
  switch (genre) {
    case 'HIP-HOP':
      return 'flash';
    case 'LATIN':
      return 'sunny';
    case 'JAZZ':
      return 'star';
    case 'HOUSE':
      return 'planet';
    case 'K-POP':
    default:
      return 'sparkles';
  }
}

function inferColor(genre: string) {
  switch (genre) {
    case 'HIP-HOP':
      return colors.purple;
    case 'LATIN':
      return colors.teal;
    case 'JAZZ':
      return '#F59E0B';
    case 'HOUSE':
      return '#06B6D4';
    case 'K-POP':
    default:
      return colors.accent;
  }
}

function inferKcal(durationSeconds: number, genre: string) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const burnPerMinute =
    genre === 'HOUSE' ? 8.2 : genre === 'HIP-HOP' ? 7.4 : genre === 'LATIN' ? 6.5 : genre === 'JAZZ' ? 5.9 : 7.0;
  return Math.round(minutes * burnPerMinute);
}

function buildGoals(title: string, genre: string, tags: string[]) {
  const normalizedTags = tags.slice(0, 3);
  const goals = normalizedTags.map((tag) => `${tag} 포인트를 ${title} 안무에서 익히기`);

  if (goals.length >= 3) {
    return goals;
  }

  return [
    ...goals,
    `${genre} 리듬에 맞춰 동작 연결하기`,
    `영상 기준 포인트 안무 흐름 익히기`,
    `라이브 세션에서 움직임 정확도 올리기`,
  ].slice(0, 3);
}

function buildSteps(title: string, description: string | null, tags: string[]) {
  const descriptionText = compactWhitespace(description ?? '');
  const parts = descriptionText
    .split(/[.!?]\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 10)
    .slice(0, 3);

  if (parts.length >= 2) {
    return parts;
  }

  return [
    `${title} 영상을 보면서 핵심 포인트 동작을 먼저 확인해요.`,
    `${tags[0] ?? '리듬'} 중심으로 짧은 구간을 반복하면서 연결해요.`,
    `라이브 세션에서 전체 흐름을 따라가며 완성도를 체크해요.`,
  ];
}

function getThumbnailUrl(videoId: string | null, explicitThumbnailUrl: string | null) {
  if (explicitThumbnailUrl) {
    return explicitThumbnailUrl;
  }

  if (!videoId) {
    return null;
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function buildYoutubeUrl(videoId: string | null, explicitUrl: string | null) {
  if (explicitUrl) {
    return explicitUrl;
  }

  if (!videoId) {
    return null;
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

function normalizeClassRecord(record: JsonRecord, index: number): DanceClass | null {
  const videoId = asString(record.video_id, record.videoId, record.VideoID, record.id);
  const title = asString(record.title, record.Title);

  if (!title) {
    return null;
  }

  const description = asString(record.description, record.Description, record.subtitle, record.Subtitle);
  const tags = toStringArray(record.tags ?? record.tag ?? record.Tags ?? record.Tag);
  const durationSeconds = Math.max(
    120,
    Math.round(asNumber(record.duration_seconds, record.duration, record.Duration, record.total_seconds) ?? 900)
  );
  const genre = asString(record.genre, record.Genre) ?? inferGenre(title, description ?? '', tags);
  const youtubeUrl = buildYoutubeUrl(videoId, asString(record.youtube_url, record.youtubeUrl, record.url));
  const thumbnailUrl = getThumbnailUrl(
    videoId,
    asString(record.thumbnail_url, record.thumbnailUrl, record.thumbnail, record.image_url)
  );

  return {
    id: videoId ?? `general-server-class-${index}`,
    genre,
    title,
    subtitle: buildSubtitle(description, title),
    description: buildDescription(description, title, genre),
    instructor: asString(record.channel_title, record.channelTitle, record.instructor, record.Instructor) ?? 'YouTube',
    level: (asString(record.level, record.Level) as DanceClass['level'] | null) ?? inferLevel(durationSeconds),
    duration: asString(record.duration_label, record.durationLabel) ?? formatDurationLabel(durationSeconds),
    kcal: Math.max(80, Math.round(asNumber(record.kcal, record.estimated_kcal) ?? inferKcal(durationSeconds, genre))),
    students: Math.max(0, Math.round(asNumber(record.students, record.views, record.view_count) ?? 0)),
    icon: asString(record.icon) ?? inferIcon(genre),
    color: asString(record.color) ?? inferColor(genre),
    rating: asString(record.rating) ?? '4.8',
    tags: tags.length > 0 ? tags : [genre, 'YouTube', 'Dance'],
    goals: buildGoals(title, genre, tags),
    steps: buildSteps(title, description, tags),
    thumbnailUrl,
    youtubeUrl,
    videoId,
    source: 'general-server',
  };
}

function getResultItems(payload: unknown) {
  const payloadRecord = asRecord(payload);
  return asArray(payloadRecord?.classes ?? payloadRecord?.videos);
}

function normalizeSearchKeyword(search?: string | null) {
  return typeof search === 'string' ? search.trim() : '';
}

export async function fetchGeneralServerDanceClasses(query: { search?: string | null } = {}): Promise<DanceClassCatalogResult> {
  const searchKeyword = normalizeSearchKeyword(query.search);
  const endpoint = searchKeyword
    ? getGeneralServerClassesSearchEndpoint({ search: searchKeyword })
    : getGeneralServerClassesEndpoint();

  try {
    const response = await fetchWithTimeout(endpoint);
    if (!response.ok) {
      throw new Error(`general_server_classes_${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const items = getResultItems(payload);
    const classes = items
      .map((item, index) => normalizeClassRecord(asRecord(item) ?? {}, index))
      .filter((item): item is DanceClass => item !== null);

    if (classes.length === 0) {
      return { classes: fallbackDanceClasses, isFallback: true };
    }

    return { classes, isFallback: false };
  } catch {
    return { classes: fallbackDanceClasses, isFallback: true };
  }
}
