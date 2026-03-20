import type { EmailThread, EmailFolder } from '@/types';
import { emailThreads } from '@/data/emailMock';

// Base URL cuando conectes el backend: const API_BASE = '/api/emails';

/**
 * Servicio de email para el módulo de correo.
 * Actualmente usa mock data. Cuando conectes la API:
 * - Reemplaza las implementaciones con fetch() a tu backend
 * - El backend usará Gmail API con los tokens OAuth del usuario
 */

export interface GetThreadsParams {
  folder?: EmailFolder;
  search?: string;
  pageToken?: string;
}

export interface GetThreadsResponse {
  threads: EmailThread[];
  nextPageToken?: string;
}

/** Obtiene los hilos de correo. Por ahora retorna mock. */
export async function getThreads(params: GetThreadsParams = {}): Promise<GetThreadsResponse> {
  // TODO: Conectar con API
  // const qs = new URLSearchParams(params as Record<string, string>).toString();
  // const res = await fetch(`${API_BASE}/threads?${qs}`);
  // if (!res.ok) throw new Error('Error al obtener correos');
  // return res.json();

  await new Promise((r) => setTimeout(r, 300)); // Simula latencia

  let threads = [...emailThreads];
  if (params.folder) {
    threads = threads.filter((t) => t.messages[0]?.folder === params.folder);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    threads = threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.messages[0]?.fromName.toLowerCase().includes(q) ||
        (t.relatedEntityName ?? '').toLowerCase().includes(q)
    );
  }
  return { threads, nextPageToken: undefined };
}

/** Obtiene un hilo por ID. Por ahora retorna mock. */
export async function getThreadById(threadId: string): Promise<EmailThread | null> {
  // TODO: Conectar con API
  // const res = await fetch(`${API_BASE}/threads/${threadId}`);
  // if (!res.ok) return null;
  // return res.json();

  await new Promise((r) => setTimeout(r, 150));
  return emailThreads.find((t) => t.id === threadId) ?? null;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  threadId?: string; // Para reply
}

/** Envía un correo. Por ahora simula envío. */
export async function sendEmail(_params: SendEmailParams): Promise<{ success: boolean }> {
  // TODO: Conectar con API - usa _params (to, cc, bcc, subject, body, threadId)
  // if (!res.ok) throw new Error('Error al enviar');
  // return res.json();

  await new Promise((r) => setTimeout(r, 800));
  return { success: true };
}

/** Marca un hilo como leído. Por ahora no-op. */
export async function markThreadRead(_threadId: string): Promise<void> {
  // TODO: Conectar con API
  // await fetch(`${API_BASE}/threads/${threadId}/read`, { method: 'POST' });
  await new Promise((r) => setTimeout(r, 100));
}

/** Marca/desmarca hilo como destacado. Por ahora no-op. */
export async function toggleStar(_threadId: string, _starred: boolean): Promise<void> {
  // TODO: Conectar con API
  // await fetch(`${API_BASE}/threads/${threadId}/star`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ starred }),
  // });
  await new Promise((r) => setTimeout(r, 100));
}
