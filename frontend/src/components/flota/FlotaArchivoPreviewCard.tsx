import { Download, Eye, FileArchive, FileText, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { formatFileSize } from "@/lib/fileUtils";
import type { FileAttachment } from "@/types";

interface FlotaArchivoPreviewCardProps {
  file: FileAttachment;
  previewUrl?: string;
  onView: (file: FileAttachment) => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
}

function PreviewFallback({ file }: { file: FileAttachment }) {
  const Icon = file.mimeType.startsWith("video/")
    ? Video
    : file.mimeType.includes("pdf")
      ? FileText
      : FileArchive;

  return (
    <div className="flex flex-col items-center gap-2 px-3 text-muted-foreground">
      <Icon className="size-9 opacity-50" />
      <span className="line-clamp-2 text-center text-[11px]">{file.name}</span>
    </div>
  );
}

export function FlotaArchivoPreviewCard({
  file,
  previewUrl,
  onView,
  onDownload,
  onDelete,
}: FlotaArchivoPreviewCardProps) {
  const isImage = file.mimeType.startsWith("image/") && previewUrl;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-none">
      <div className="flex items-start justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatDate(file.uploadedAt)} · {file.uploadedByName}
          </p>
        </div>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(file)}
            title="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onView(file)}
        className="flex aspect-[4/3] w-full items-center justify-center bg-muted/25 p-2 transition-colors hover:bg-muted/40"
      >
        {isImage ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-full max-w-full rounded-md object-contain"
            loading="lazy"
          />
        ) : (
          <PreviewFallback file={file} />
        )}
      </button>

      <div className="grid grid-cols-2 divide-x divide-border/50 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onView(file)}
          className="h-9 rounded-none text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Eye className="size-3.5" />
          Ver
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDownload(file)}
          className="h-9 rounded-none text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3.5" />
          Descargar
        </Button>
      </div>

      <p className="border-t border-border/40 px-3 py-1.5 text-[10px] text-muted-foreground">
        {formatFileSize(file.size)}
      </p>
    </div>
  );
}
