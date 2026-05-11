import { api, API_BASE } from '@/lib/api';
import type { KnowledgeType, MockKnowledge } from './mockData';

export type KnowledgeBaseApiRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  chunks: number;
  agentName: string;
  updatedAt: string;
  status: string;
};

export type CreateKnowledgeBaseBody = {
  title: string;
  type?: string;
  sourceMode: string;
  description: string;
  chunkSize?: number;
  overlap?: number;
  linkedAgentId?: string | null;
  linkedAgentName?: string | null;
  source?: Record<string, unknown>;
};

export async function fetchKnowledgeBases(): Promise<KnowledgeBaseApiRow[]> {
  return api<KnowledgeBaseApiRow[]>('/api/ai/knowledge-bases');
}

export async function createKnowledgeBase(
  body: CreateKnowledgeBaseBody,
): Promise<KnowledgeBaseApiRow> {
  return api<KnowledgeBaseApiRow>('/api/ai/knowledge-bases', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** multipart/form-data; no fijar Content-Type (el navegador añade el boundary). */
export async function uploadKnowledgeBaseFiles(
  formData: FormData,
): Promise<KnowledgeBaseApiRow> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(`${API_BASE}/api/ai/knowledge-bases/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
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
    const err = body as { message?: string | string[] };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : res.statusText || 'Error al subir archivos';
    const error = new Error(msg);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return body as KnowledgeBaseApiRow;
}

const KNOWLEDGE_TYPES: KnowledgeType[] = ['documentos', 'web', 'faq', 'tabular'];

export function apiRowToMockKnowledge(row: KnowledgeBaseApiRow): MockKnowledge {
  const t = KNOWLEDGE_TYPES.includes(row.type as KnowledgeType)
    ? (row.type as KnowledgeType)
    : 'documentos';
  const st = ['indexado', 'sync', 'error', 'pendiente'].includes(row.status)
    ? (row.status as MockKnowledge['status'])
    : 'pendiente';
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: t,
    chunks: row.chunks,
    agentName: row.agentName,
    updatedAt: row.updatedAt,
    status: st,
  };
}
