const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export type ApiErrorBody = { message?: string | string[]; statusCode?: number };

/**
 * fetch al backend Nest con JSON y Authorization Bearer si hay token.
 * Lanza Error con mensaje legible si !res.ok.
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const err = body as ApiErrorBody;
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : res.statusText || 'Error en la petición';
    const error = new Error(msg);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return body as T;
}

export { API_BASE };
