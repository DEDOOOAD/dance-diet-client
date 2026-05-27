import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_USER_UUID = 'user-lee';
const CURRENT_USER_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}current-user.json`
  : null;

let cachedCurrentUserUuid: string | null = process.env.EXPO_PUBLIC_USER_UUID?.trim() ?? null;

function getFallbackUserUuid() {
  return process.env.EXPO_PUBLIC_USER_UUID?.trim() || DEFAULT_USER_UUID;
}

function normalizeUserUuid(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getCurrentUserUuid() {
  const resolvedUserUuid = cachedCurrentUserUuid ?? getFallbackUserUuid();
  console.log('[current-user] getCurrentUserUuid', {
    cachedCurrentUserUuid,
    fallbackUserUuid: getFallbackUserUuid(),
    resolvedUserUuid,
  });
  return resolvedUserUuid;
}

export async function loadCurrentUserUuid() {
  if (!CURRENT_USER_FILE_URI) {
    console.log('[current-user] no file uri available, using current user uuid');
    return getCurrentUserUuid();
  }

  try {
    const raw = await FileSystem.readAsStringAsync(CURRENT_USER_FILE_URI);
    const parsed = JSON.parse(raw) as { userUuid?: unknown } | null;
    const storedUserUuid = normalizeUserUuid(parsed?.userUuid);

    if (storedUserUuid) {
      cachedCurrentUserUuid = storedUserUuid;
      console.log('[current-user] loaded stored user uuid', storedUserUuid);
      return storedUserUuid;
    }
    console.warn('[current-user] current-user.json did not contain a valid uuid');
  } catch (error) {
    console.warn('[current-user] failed to load stored user uuid', error);
    // Fall back to the configured default when no saved session exists.
  }

  console.log('[current-user] falling back to configured user uuid');
  return getCurrentUserUuid();
}

export async function setCurrentUserUuid(userUuid: string) {
  const normalizedUserUuid = normalizeUserUuid(userUuid);
  if (!normalizedUserUuid) {
    throw new Error('유효한 사용자 UUID가 필요해요.');
  }

  cachedCurrentUserUuid = normalizedUserUuid;
  console.log('[current-user] setCurrentUserUuid', {
    normalizedUserUuid,
    fileUri: CURRENT_USER_FILE_URI,
  });

  if (!CURRENT_USER_FILE_URI) {
    return;
  }

  await FileSystem.writeAsStringAsync(
    CURRENT_USER_FILE_URI,
    JSON.stringify({ userUuid: normalizedUserUuid })
  );
}

export async function clearCurrentUserUuid() {
  cachedCurrentUserUuid = null;
  console.log('[current-user] clearCurrentUserUuid', {
    fileUri: CURRENT_USER_FILE_URI,
  });

  if (!CURRENT_USER_FILE_URI) {
    return;
  }

  try {
    await FileSystem.deleteAsync(CURRENT_USER_FILE_URI, { idempotent: true });
  } catch (error) {
    console.warn('[current-user] failed to clear stored user uuid', error);
    // Ignore cleanup errors during logout.
  }
}
