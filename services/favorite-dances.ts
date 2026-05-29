import * as FileSystem from 'expo-file-system/legacy';

const FAVORITE_DANCES_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}favorite-dances.json`
  : null;

const listeners = new Set<(favoriteIds: string[]) => void>();

let cachedFavoriteDanceIds: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

function normalizeFavoriteDanceIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

async function persistFavoriteDanceIds(favoriteIds: string[]) {
  if (!FAVORITE_DANCES_FILE_URI) {
    return;
  }

  await FileSystem.writeAsStringAsync(
    FAVORITE_DANCES_FILE_URI,
    JSON.stringify({ favoriteDanceIds: favoriteIds })
  );
}

function notifyListeners() {
  const favoriteIds = cachedFavoriteDanceIds ?? [];
  listeners.forEach((listener) => {
    listener(favoriteIds);
  });
}

export async function loadFavoriteDanceIds() {
  if (cachedFavoriteDanceIds) {
    return cachedFavoriteDanceIds;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    if (!FAVORITE_DANCES_FILE_URI) {
      cachedFavoriteDanceIds = [];
      return cachedFavoriteDanceIds;
    }

    try {
      const raw = await FileSystem.readAsStringAsync(FAVORITE_DANCES_FILE_URI);
      const parsed = JSON.parse(raw) as { favoriteDanceIds?: unknown } | null;
      cachedFavoriteDanceIds = normalizeFavoriteDanceIds(parsed?.favoriteDanceIds);
      return cachedFavoriteDanceIds;
    } catch {
      cachedFavoriteDanceIds = [];
      return cachedFavoriteDanceIds;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function isFavoriteDance(danceId: string) {
  const favoriteIds = await loadFavoriteDanceIds();
  return favoriteIds.includes(danceId);
}

export async function toggleFavoriteDance(danceId: string) {
  const normalizedDanceId = danceId.trim();
  const favoriteIds = [...(await loadFavoriteDanceIds())];
  const existingIndex = favoriteIds.indexOf(normalizedDanceId);

  if (existingIndex >= 0) {
    favoriteIds.splice(existingIndex, 1);
  } else {
    favoriteIds.unshift(normalizedDanceId);
  }

  cachedFavoriteDanceIds = favoriteIds;
  await persistFavoriteDanceIds(favoriteIds);
  notifyListeners();

  return favoriteIds.includes(normalizedDanceId);
}

export function subscribeFavoriteDanceIds(listener: (favoriteIds: string[]) => void) {
  listeners.add(listener);

  void loadFavoriteDanceIds().then((favoriteIds) => {
    listener(favoriteIds);
  });

  return () => {
    listeners.delete(listener);
  };
}
