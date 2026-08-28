import { useCallback, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Loader2,
  MessageCircle,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';
import { FlotaAreaSvgIcon } from '@/components/icons/FlotaAreaSvgIcon';
import { ComercialAreaSvgIcon } from '@/components/icons/ComercialAreaSvgIcon';
import { AvatarImage } from '@/lib/avatar';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  downloadWhatsAppAudienceTemplate,
  formatWhatsAppPhoneDisplay,
  parseWhatsAppAudienceFromFile,
} from './whatsappAudienceExcel';
import {
  CrmAudienceImportDialog,
  type CrmAudienceSource,
} from './CrmAudienceImportDialog';
import {
  audienceCount,
  audienceFileName,
  audiencePreviewContacts,
  type WhatsAppAudience,
} from './whatsappAudienceModel';

const AUDIENCE_PREVIEW_LIMIT = 40;

const audienceActionBtnClass = cn(
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-4 text-[13px] font-semibold shadow-none transition-colors',
  'border-[#e1e7ee] bg-white/70 text-[#1f2933] hover:border-primary hover:bg-white',
  'dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:hover:border-primary dark:hover:bg-gray-800',
);

const audienceActionIconClass = 'size-[18px] shrink-0 text-[#72808f] dark:text-gray-400';

export function AudienceTab({
  audience,
  onImport,
  onRemoveIds,
  onClear,
}: {
  audience: WhatsAppAudience;
  onImport: (audience: WhatsAppAudience) => void;
  onRemoveIds: (ids: string[]) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [crmSource, setCrmSource] = useState<CrmAudienceSource | null>(null);

  const total = audienceCount(audience);
  const fileName = audienceFileName(audience);
  const preview = audiencePreviewContacts(audience, AUDIENCE_PREVIEW_LIMIT);
  const deferred = audience.mode === 'crmSelectAll';
  const hiddenCount = Math.max(0, total - preview.length);
  const canRemoveRows = audience.mode === 'explicit';

  const processFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const result = await parseWhatsAppAudienceFromFile(file);
        if (result.errors.length > 0) {
          toast.error(result.errors[0]);
          return;
        }
        onImport({
          mode: 'explicit',
          contacts: result.contacts,
          fileName: file.name,
        });
        const skippedMsg =
          result.skipped > 0 ? ` · ${result.skipped} fila(s) omitida(s)` : '';
        toast.success(`${result.contacts.length} contacto(s) importados${skippedMsg}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al importar Excel');
      } finally {
        setImporting(false);
        setDragOver(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [onImport],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_400px]">
      <div className="flex min-h-[420px] flex-col rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Importar audiencia</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sube un Excel con columnas <strong>nombre</strong> y <strong>teléfono</strong>. Opcional:{' '}
            <strong>empresa</strong> para mapear variables de la plantilla.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />

          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex w-full max-w-lg flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
              dragOver
                ? 'border-[#13944C] bg-[#13944C]/5'
                : 'border-muted-foreground/25 hover:border-[#13944C]/50 hover:bg-muted/30',
              importing && 'pointer-events-none opacity-60',
            )}
          >
            {importing ? (
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-full bg-[#13944C]/10">
                <Upload className="size-7 text-[#13944C]" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">
                {importing
                  ? 'Leyendo archivo…'
                  : total > 0
                    ? 'Arrastra otro Excel o haz clic para reemplazar'
                    : 'Arrastra tu archivo Excel aquí'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                o haz clic para seleccionar · .xlsx, .xls
              </p>
            </div>
            {fileName && total > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <FileSpreadsheet className="size-3.5" />
                {fileName}
              </span>
            ) : null}
          </button>

          <div className="flex w-full max-w-lg flex-col gap-3">
            <button
              type="button"
              className={audienceActionBtnClass}
              onClick={downloadWhatsAppAudienceTemplate}
            >
              <XlsSvgIcon className="size-[18px] shrink-0" />
              Descargar plantilla Excel
            </button>

            <div className="flex items-center gap-3 py-0.5">
              <div className="h-px flex-1 bg-border/60" />
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                o importa desde el CRM
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={audienceActionBtnClass}
                onClick={() => setCrmSource('flota')}
              >
                <FlotaAreaSvgIcon className={cn(audienceActionIconClass, 'text-primary/80')} />
                Importar de Flota
              </button>
              <button
                type="button"
                className={audienceActionBtnClass}
                onClick={() => setCrmSource('comercial')}
              >
                <ComercialAreaSvgIcon className={cn(audienceActionIconClass, 'text-primary/80')} />
                Importar de Comercial
              </button>
            </div>
          </div>

          <p className="max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
            Teléfonos Perú: 9 dígitos (987654321) o con código país (51987654321). Se omiten filas sin
            nombre o teléfono válido y duplicados.
          </p>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              En este envío
              <Badge variant="secondary" className="ml-2 align-middle">
                {total}
              </Badge>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {total > 0
                ? deferred
                  ? `${total} del filtro CRM · se cargan al enviar`
                  : `${total} contacto(s) listos para enviar`
                : 'Importa un Excel para armar la audiencia'}
            </p>
          </div>
          {total > 0 ? (
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={onClear}>
              <Trash2 className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
        </div>

        {total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageCircle className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Sin contactos</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              La lista aparecerá aquí después de importar el archivo.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {preview.map((c) => (
              <div key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                <span className="flex size-8 shrink-0 overflow-hidden rounded-full">
                  <AvatarImage name={c.name} size={32} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{c.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {formatWhatsAppPhoneDisplay(c.phone)}
                  </p>
                  {c.company ? (
                    <p className="truncate text-[11px] text-muted-foreground/80">{c.company}</p>
                  ) : null}
                  {c.city ? (
                    <p className="truncate text-[11px] text-muted-foreground/80">{c.city}</p>
                  ) : null}
                </div>
                {canRemoveRows ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    onClick={() => onRemoveIds([c.id])}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {hiddenCount > 0 ? (
              <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                y {hiddenCount.toLocaleString('es-PE')} más
                {deferred ? ' (filtro CRM completo al enviar)' : ''}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {crmSource ? (
        <CrmAudienceImportDialog
          key={crmSource}
          source={crmSource}
          onOpenChange={(open) => {
            if (!open) setCrmSource(null);
          }}
          onImport={onImport}
        />
      ) : null}
    </div>
  );
}
