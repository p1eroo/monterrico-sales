import { api, API_BASE, apiBlob } from './api';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export type EmailSignatureResponse = {
  html: string | null;
};

const SIGNATURE_IMAGE_PLACEHOLDER = '__CRM_SIGNATURE_IMAGE__';

function extractImageSrcFromHtml(html: string): string | null {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return match?.[1]?.trim() || null;
}

function guessMimeFromSrc(src: string): string {
  const lower = src.toLowerCase();
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  return 'image/gif';
}

async function fetchRemoteImageAsBlob(src: string): Promise<Blob | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) return null;
    const headerType = res.headers.get('content-type')?.split(';')[0]?.trim();
    const mimeType =
      headerType && !headerType.includes('avif')
        ? headerType
        : guessMimeFromSrc(src);
    return new Blob([buffer], { type: mimeType });
  } catch {
    return null;
  }
}

export async function fetchEmailSignature(): Promise<EmailSignatureResponse> {
  return api<EmailSignatureResponse>('/gmail/signature');
}

export async function saveEmailSignature(html: string): Promise<EmailSignatureResponse> {
  return api<EmailSignatureResponse>('/gmail/signature', {
    method: 'PUT',
    body: JSON.stringify({ html }),
  });
}

export async function deleteEmailSignature(): Promise<{ ok: true }> {
  return api<{ ok: true }>('/gmail/signature', { method: 'DELETE' });
}

export async function uploadEmailSignatureImage(
  file: File,
): Promise<{ html: string; imageUrl?: string }> {
  const token = getAccessToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/gmail/signature/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
        : res.statusText || 'Error al subir la imagen de firma';
    throw new Error(msg);
  }
  return body as { html: string; imageUrl?: string };
}

export async function fetchSignatureImageBlob(
  html?: string | null,
): Promise<Blob | null> {
  try {
    return await apiBlob('/gmail/signature/image');
  } catch {
    const src = html ? extractImageSrcFromHtml(html) : null;
    if (!src || src === SIGNATURE_IMAGE_PLACEHOLDER) return null;
    return fetchRemoteImageAsBlob(src);
  }
}

export async function createSignaturePreviewImageUrl(
  html: string,
): Promise<string | null> {
  const blob = await fetchSignatureImageBlob(html);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** Reemplaza src de imágenes de firma por una blob URL local (vista previa en el editor). */
export async function resolveSignatureHtmlForEditor(html: string): Promise<string> {
  if (!/<img\b/i.test(html)) return html;
  const blob = await fetchSignatureImageBlob(html);
  if (!blob) return html;
  const blobUrl = URL.createObjectURL(blob);
  return html.replace(
    /<img([^>]*?)src=["'][^"']*["']([^>]*)>/gi,
    `<img$1src="${blobUrl}"$2>`,
  );
}

/** Sustituye imágenes blob del editor por la firma original para el envío vía API. */
export function prepareBodyHtmlForSend(
  bodyHtml: string,
  signatureHtml: string | null,
): string {
  if (!bodyHtml.includes('blob:') || !signatureHtml?.includes('<img')) {
    return bodyHtml;
  }
  const originalImg = signatureHtml.match(/<img\b[^>]*>/i)?.[0];
  if (!originalImg) return bodyHtml;
  return bodyHtml.replace(
    /<img\b[^>]*\bsrc=["']blob:[^"']*["'][^>]*>/gi,
    originalImg,
  );
}

export function signatureHtmlWithoutImage(html: string): string {
  return html
    .replace(/<br\s*\/?>\s*<img\b[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .trim();
}
