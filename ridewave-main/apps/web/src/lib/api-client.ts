const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

function csrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|; )ridewave\.csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string; details?: unknown }; data?: T };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  const method = (init.method ?? 'GET').toUpperCase();
  const csrf = method === 'GET' ? undefined : csrfToken();
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the RideWave API. Is it running on port 4000?');
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!body) throw new ApiError(res.status, 'BAD_RESPONSE', 'The server returned an unreadable response.');
  if (!res.ok || body.success === false) {
    const err = 'error' in body ? body.error : { code: 'ERROR', message: 'Request failed.' };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return body.data;
}
