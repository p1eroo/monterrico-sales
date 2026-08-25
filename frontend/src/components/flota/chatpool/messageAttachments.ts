import { apiBlob } from '@/lib/api';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

async function readAttachmentResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    let message = 'No se pudo cargar el archivo';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message?.trim()) message = body.message.trim();
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.blob();
}

/** Carga el blob para preview inline (sin forzar descarga). */
export async function fetchAttachmentBlob(params: {
  attachmentId?: string | null;
  fileUrl?: string | null;
}): Promise<Blob> {
  if (params.attachmentId && !params.attachmentId.startsWith('payload:')) {
    return apiBlob(
      `/files/${encodeURIComponent(params.attachmentId)}/content?disposition=inline`,
    );
  }

  if (params.fileUrl) {
    const response = await fetch(params.fileUrl);
    return readAttachmentResponse(response);
  }

  throw new Error('No hay archivo disponible');
}

export async function downloadFile(params: {
  fileName: string;
  attachmentId?: string | null;
  fileUrl?: string | null;
}): Promise<void> {
  const blob = await fetchAttachmentBlob({
    attachmentId: params.attachmentId,
    fileUrl: params.fileUrl,
  });
  triggerBlobDownload(blob, params.fileName);
}
