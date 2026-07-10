export const COMPOSE_MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
export const COMPOSE_MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isComposeImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

/** Inserta una imagen inline en un contentEditable (comportamiento tipo Gmail). */
export function insertInlineImageInBody(bodyEl: HTMLElement, src: string): void {
  bodyEl.focus();
  const img = document.createElement('img');
  img.src = src;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.display = 'block';

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && bodyEl.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);
    const br = document.createElement('br');
    range.setStartAfter(img);
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    bodyEl.appendChild(img);
    bodyEl.appendChild(document.createElement('br'));
  }
}

export type ComposeFilesIngestResult = {
  attachments: File[];
  inlineImages: number;
  errors: string[];
};

/**
 * Procesa archivos soltados o pegados en el compose:
 * imágenes → inline en el cuerpo; el resto → adjuntos.
 * Imágenes muy grandes se tratan como adjunto.
 */
export async function ingestComposeFiles(
  files: File[],
  bodyEl: HTMLElement | null,
): Promise<ComposeFilesIngestResult> {
  const attachments: File[] = [];
  let inlineImages = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (!file.size) continue;

    if (isComposeImageFile(file)) {
      if (file.size > COMPOSE_MAX_INLINE_IMAGE_BYTES) {
        if (file.size <= COMPOSE_MAX_ATTACHMENT_BYTES) {
          attachments.push(file);
        } else {
          errors.push(`${file.name} supera el máximo de ${formatBytes(COMPOSE_MAX_ATTACHMENT_BYTES)}`);
        }
        continue;
      }
      if (!bodyEl) {
        attachments.push(file);
        continue;
      }
      try {
        const src = await readAsDataUrl(file);
        insertInlineImageInBody(bodyEl, src);
        inlineImages++;
      } catch {
        errors.push(`No se pudo leer ${file.name}`);
      }
    } else if (file.size > COMPOSE_MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name} supera el máximo de ${formatBytes(COMPOSE_MAX_ATTACHMENT_BYTES)}`);
    } else {
      attachments.push(file);
    }
  }

  return { attachments, inlineImages, errors };
}

export function filterValidAttachmentFiles(files: File[]): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!file.size) continue;
    if (file.size > COMPOSE_MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name} supera el máximo de ${formatBytes(COMPOSE_MAX_ATTACHMENT_BYTES)}`);
    } else {
      valid.push(file);
    }
  }
  return { valid, errors };
}
