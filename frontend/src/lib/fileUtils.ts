import type { FileAttachment } from '@/types';

export const FILE_ENTITY_TYPE_LABELS: Record<FileAttachment['entityType'], string> = {
  contact: 'Contacto',
  company: 'Empresa',
  opportunity: 'Oportunidad',
  activity: 'Actividad',
  email: 'Correo',
  task: 'Tarea',
  'flota-prospecto': 'Prospecto',
};

export const FILE_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image', label: 'Imágenes' },
  { value: 'document', label: 'Documentos' },
  { value: 'spreadsheet', label: 'Hojas de cálculo' },
] as const;

export function isExtractableDocumentFile(file: File): boolean {
  const m = (file.type || '').toLowerCase().split(';')[0].trim();
  return m.startsWith('image/') || m === 'application/pdf';
}

export function isExtractableDocumentMime(mimeType: string): boolean {
  const m = (mimeType || '').toLowerCase().split(';')[0].trim();
  return m.startsWith('image/') || m === 'application/pdf';
}

export const DOCUMENT_TIPO_LABELS: Record<string, string> = {
  dni: 'DNI',
  licencia: 'Licencia de conducir',
  soat: 'SOAT',
  tive: 'Tarjeta vehicular',
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(name: string, mimeType: string): string {
  const fromName = name.includes('.') ? name.split('.').pop()?.trim().toLowerCase() : '';
  if (fromName && fromName.length <= 8) return fromName.toUpperCase();

  const mimeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
  };
  if (mimeMap[mimeType]) return mimeMap[mimeType];
  if (mimeType.includes('word')) return 'DOC';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS';
  return 'FILE';
}

export function matchesFileType(file: FileAttachment, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'image') return file.mimeType.startsWith('image/');
  if (filter === 'document') {
    return file.mimeType.includes('word') || file.mimeType.includes('document');
  }
  if (filter === 'spreadsheet') {
    return file.mimeType.includes('sheet') || file.mimeType.includes('excel');
  }
  return file.mimeType === filter;
}

export function isNavigableFileEntity(
  entityType: FileAttachment['entityType'],
): entityType is 'contact' | 'company' | 'opportunity' {
  return entityType === 'contact' || entityType === 'company' || entityType === 'opportunity';
}

export type FilesSortKey = 'name' | 'size' | 'uploadedAt' | 'uploadedByName' | 'entityName';
export type FilesSortDir = 'asc' | 'desc';

export function sortFiles(
  files: FileAttachment[],
  sortKey: FilesSortKey,
  sortDir: FilesSortDir,
): FileAttachment[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...files].sort((a, b) => {
    if (sortKey === 'size') return (a.size - b.size) * dir;
    if (sortKey === 'uploadedAt') {
      return (Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt)) * dir;
    }
    const av =
      sortKey === 'entityName'
        ? (a.entityName ?? FILE_ENTITY_TYPE_LABELS[a.entityType])
        : a[sortKey];
    const bv =
      sortKey === 'entityName'
        ? (b.entityName ?? FILE_ENTITY_TYPE_LABELS[b.entityType])
        : b[sortKey];
    return String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' }) * dir;
  });
}
