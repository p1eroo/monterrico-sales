import { useAppStore } from '@/store';

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export type ApiErrorBody = { message?: string | string[]; statusCode?: number };

/** Si la API devuelve un solo ítem o un array, devuelve siempre un array. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * fetch al backend Nest con JSON y Authorization Bearer si hay token.
 * Lanza Error con mensaje legible si !res.ok.
 */
export type AuthMeResponse = {
  id: string;
  username: string;
  name: string;
  phone: string;
  avatar: string;
  role: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  joinedAt: string;
  lastActivity: string | null;
};

/** Perfil y permisos reales (tabla Authority). Requiere Bearer. */
export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return api<AuthMeResponse>('/auth/me');
}

export async function patchAuthProfile(body: {
  name?: string;
  phone?: string;
}): Promise<AuthMeResponse> {
  return api<AuthMeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function uploadAuthAvatar(file: File): Promise<AuthMeResponse> {
  const token = getAccessToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `${API_BASE}/auth/me/avatar`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    },
  );
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
        : res.statusText || 'Error al subir avatar';
    const error = new Error(msg);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return body as AuthMeResponse;
}

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
    if (res.status === 401 && typeof window !== 'undefined') {
      useAppStore.getState().logout();
    }
    const error = new Error(msg);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return body as T;
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
): Promise<Blob> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText || 'Error en la descarga';
    if (text) {
      try {
        const body = JSON.parse(text) as ApiErrorBody;
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : typeof body.message === 'string'
            ? body.message
            : message;
      } catch {
        message = text;
      }
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      useAppStore.getState().logout();
    }
    const error = new Error(message);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return res.blob();
}

export { API_BASE };
