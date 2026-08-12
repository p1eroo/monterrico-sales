export interface FileNameParts {
  base: string;
  extension: string;
}

export function splitFileName(fileName: string): FileNameParts {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) {
    return { base: fileName, extension: '' };
  }
  return {
    base: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot + 1).toLowerCase(),
  };
}

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  xlsx: 'Excel',
  xls: 'Excel',
  doc: 'Word',
  docx: 'Word',
  txt: 'Texto',
  csv: 'CSV',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  zip: 'ZIP',
  png: 'Imagen',
  jpg: 'Imagen',
  jpeg: 'Imagen',
  webp: 'Imagen',
  gif: 'Imagen',
  webm: 'Audio',
  mp3: 'Audio',
  ogg: 'Audio',
  m4a: 'Audio',
};

export function getFileTypeLabel(extension: string): string {
  if (!extension) return 'Archivo';
  return FILE_TYPE_LABELS[extension] || extension.toUpperCase();
}

export function usesPaperclipIcon(extension: string): boolean {
  return extension === 'xlsx' || extension === 'xls';
}

const FILE_TYPE_BADGE_STYLES: Record<string, { outgoing: string; panel: string }> = {
  pdf: {
    outgoing: 'bg-red-400/25 text-red-50',
    panel: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  xlsx: {
    outgoing: 'bg-emerald-200/20 text-emerald-50',
    panel: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  xls: {
    outgoing: 'bg-emerald-200/20 text-emerald-50',
    panel: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  doc: {
    outgoing: 'bg-blue-300/25 text-blue-50',
    panel: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  docx: {
    outgoing: 'bg-blue-300/25 text-blue-50',
    panel: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
};

export function getFileTypeBadgeStyle(
  extension: string,
  outgoing: boolean,
): { badge: string; label: string } {
  const matched = FILE_TYPE_BADGE_STYLES[extension];
  const label = extension ? extension.toUpperCase().slice(0, 4) : 'FILE';

  if (matched) {
    return {
      badge: outgoing ? matched.outgoing : matched.panel,
      label,
    };
  }

  return {
    badge: outgoing
      ? 'bg-white/15 text-white/90'
      : 'bg-muted text-muted-foreground',
    label,
  };
}
