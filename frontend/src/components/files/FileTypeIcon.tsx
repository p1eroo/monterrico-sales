import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  FileCode,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MIME_TO_ICON: Record<string, LucideIcon> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/jpg': Image,
  'image/png': Image,
  'image/gif': Image,
  'image/webp': Image,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'text/plain': FileText,
  'text/csv': FileSpreadsheet,
};

function getIconForMime(mimeType: string): LucideIcon {
  const icon = MIME_TO_ICON[mimeType];
  if (icon) return icon;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('code') || mimeType.includes('json')) return FileCode;
  return File;
}

interface FileTypeIconProps {
  mimeType: string;
  className?: string;
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const Icon = getIconForMime(mimeType);
  return <Icon className={cn('size-5 shrink-0 text-muted-foreground', className)} />;
}
