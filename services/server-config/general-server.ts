import { buildGeneralServerHttpUrl } from './base';

export type GeneralServerRecordsPeriod = 'weekly' | 'monthly';

export type GeneralServerClassesQuery = {
  genre?: string | null;
  search?: string | null;
};

function withSearchParams(
  url: string,
  params: Record<string, string | number | boolean | null | undefined>
) {
  const nextUrl = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    nextUrl.searchParams.set(key, String(value));
  });

  return nextUrl.toString();
}

export function getGeneralServerAppMetadataEndpoint() {
  return buildGeneralServerHttpUrl('/api/app');
}

export function getGeneralServerSignupEndpoint() {
  return buildGeneralServerHttpUrl('/api/signup');
}

export function getGeneralServerLoginEndpoint() {
  return buildGeneralServerHttpUrl('/api/user/login');
}

export function getGeneralServerDeleteUserEndpoint(userId: string) {
  return buildGeneralServerHttpUrl(`/api/users/${encodeURIComponent(userId)}`);
}

export function getGeneralServerProfileUpdateEndpoint(userId: string) {
  return buildGeneralServerHttpUrl(`/api/Profile/${encodeURIComponent(userId)}`);
}

export function getGeneralServerProfilePrototypeEndpoint(userId: string) {
  return buildGeneralServerHttpUrl(`/api/ProfilePrototype/${encodeURIComponent(userId)}`);
}

export function getGeneralServerLiveSessionStartEndpoint() {
  return buildGeneralServerHttpUrl('/api/live/session/start');
}

export function getGeneralServerLiveSessionEndEndpoint() {
  return buildGeneralServerHttpUrl('/api/live/session/end');
}

export function getGeneralServerFoodIntakeEndpoint() {
  return buildGeneralServerHttpUrl('/api/food/intake');
}

export function getGeneralServerProfileByIdEndpoint(userId: string) {
  return buildGeneralServerHttpUrl(`/api/profile/${encodeURIComponent(userId)}`);
}

export function getGeneralServerHomeEndpoint(userId: string) {
  return buildGeneralServerHttpUrl(`/api/home/${encodeURIComponent(userId)}`);
}

export function getGeneralServerClassesEndpoint(query: GeneralServerClassesQuery = {}) {
  return withSearchParams(buildGeneralServerHttpUrl('/api/classes'), {
    genre: query.genre,
    search: query.search,
  });
}

export function getGeneralServerRecordsEndpoint(period: GeneralServerRecordsPeriod = 'weekly') {
  return withSearchParams(buildGeneralServerHttpUrl('/api/records'), {
    period,
  });
}
