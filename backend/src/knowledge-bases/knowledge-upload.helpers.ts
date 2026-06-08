import pdfParse from 'pdf-parse';

/** Extensiones tratadas como texto cuando el MIME es genérico. */
const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.html',
  '.htm',
]);

const TEXT_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'text/csv',
  'text/tab-separated-values',
]);

const PDF_MIMES = new Set(['application/pdf', 'application/x-pdf']);

function stripHtmlMinimal(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  const i = lower.lastIndexOf('.');
  if (i === -1) return '';
  return lower.slice(i);
}

/**
 * Devuelve texto UTF-8 indexable o null si el tipo no está soportado o no hay texto extraíble (p. ej. PDF escaneado).
 */
export type MulterFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const data = await pdfParse(buffer);
    const text = (data.text ?? '')
      .replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .trim();
    return text.length ? text : null;
  } catch {
    return null;
  }
}

function isPdfLike(mime: string, ext: string): boolean {
  return ext === '.pdf' || PDF_MIMES.has(mime);
}

export async function extractIndexableTextFromUpload(
  file: MulterFileLike,
): Promise<string | null> {
  if (!file.buffer?.length) return null;

  const rawMime = (file.mimetype || '').toLowerCase();
  const mime = rawMime.split(';')[0].trim();
  const name = file.originalname || '';
  const ext = fileExtension(name);

  if (isPdfLike(mime, ext)) {
    return extractPdfText(file.buffer);
  }
  if (TEXT_MIMES.has(mime)) {
    return file.buffer.toString('utf8');
  }
  if (mime === 'text/html') {
    return stripHtmlMinimal(file.buffer.toString('utf8'));
  }
  if (mime === 'application/octet-stream' || !mime) {
    if (!TEXT_EXTENSIONS.has(ext)) return null;
    const raw = file.buffer.toString('utf8');
    if (ext === '.html' || ext === '.htm') return stripHtmlMinimal(raw);
    return raw;
  }
  return null;
}
