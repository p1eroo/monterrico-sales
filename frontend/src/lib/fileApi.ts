import type { FileAttachment, FileEntityType } from '@/types';
import { api, API_BASE } from './api';

export type ApiFileRow = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
};

export function mapApiFileRow(row: ApiFileRow): FileAttachment {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    mimeType: row.mimeType,
    uploadedAt: row.uploadedAt,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName,
    entityType: row.entityType as FileEntityType,
    entityId: row.entityId,
    entityName: row.entityName,
    relatedEntityType: row.relatedEntityType as FileEntityType | undefined,
    relatedEntityId: row.relatedEntityId,
    relatedEntityName: row.relatedEntityName,
  };
}

export async function fetchFiles(params?: {
  entityType?: string;
  entityId?: string;
}): Promise<FileAttachment[]> {
  const q = new URLSearchParams();
  if (params?.entityType) q.set('entityType', params.entityType);
  if (params?.entityId) q.set('entityId', params.entityId);
  const qs = q.toString();
  const rows = await api<ApiFileRow[]>(`/files${qs ? `?${qs}` : ''}`);
  return rows.map(mapApiFileRow);
}

export async function getFilePresignedUrl(
  id: string,
  disposition: 'inline' | 'attachment',
): Promise<string> {
  const { url } = await api<{ url: string }>(
    `/files/${encodeURIComponent(id)}/url?disposition=${disposition}`,
  );
  return url;
}

/**
 * Obtiene el archivo vía API (proxy) con el Content-Type guardado en BD.
 * Devuelve un object URL; el llamador debe llamar a URL.revokeObjectURL cuando no se use.
 */
export async function fetchFileContentBlobUrl(
  id: string,
  disposition: 'inline' | 'attachment',
): Promise<string> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(
    `${API_BASE}/files/${encodeURIComponent(id)}/content?disposition=${disposition}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text || res.statusText || 'Error al obtener el archivo';
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(', ');
      else if (typeof j.message === 'string') msg = j.message;
    } catch {
      /* usar text */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function uploadFileToApi(
  file: globalThis.File,
  meta: {
    entityType: FileEntityType;
    entityId: string;
    entityName?: string;
    relatedEntityType?: FileEntityType;
    relatedEntityId?: string;
    relatedEntityName?: string;
  },
): Promise<FileAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('entityType', meta.entityType);
  fd.append('entityId', meta.entityId);
  if (meta.entityName) fd.append('entityName', meta.entityName);
  if (meta.relatedEntityType) fd.append('relatedEntityType', meta.relatedEntityType);
  if (meta.relatedEntityId) fd.append('relatedEntityId', meta.relatedEntityId);
  if (meta.relatedEntityName) fd.append('relatedEntityName', meta.relatedEntityName);

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers,
    body: fd,
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
        : res.statusText || 'Error al subir';
    throw new Error(msg);
  }

  return mapApiFileRow(body as ApiFileRow);
}

export async function deleteFileApi(id: string): Promise<void> {
  await api(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
