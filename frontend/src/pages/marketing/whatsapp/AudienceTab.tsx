import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/shared/GlassCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';
import { FlotaAreaSvgIcon } from '@/components/icons/FlotaAreaSvgIcon';
import { ComercialAreaSvgIcon } from '@/components/icons/ComercialAreaSvgIcon';
import { AvatarImage } from '@/lib/avatar';
import {
  crmTableBodyRowClass,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
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
import { WHATSAPP_SOURCE_LABEL, type WhatsAppContact } from './mockData';

const PAGE_SIZE = 25;

const audienceActionBtnClass = cn(
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-4 text-[13px] font-semibold shadow-none transition-colors',
  'border-[#e1e7ee] bg-white/70 text-[#1f2933] hover:border-primary hover:bg-white',
  'dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:hover:border-primary dark:hover:bg-gray-800',
);

const audienceActionIconClass = 'size-[18px] shrink-0 text-[#72808f] dark:text-gray-400';

const audienceToolbarBtnClass = cn(
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-none transition-colors',
  'border-[#e1e7ee] bg-white/70 text-[#1f2933] hover:border-primary hover:bg-white',
  'dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:hover:border-primary dark:hover:bg-gray-800',
);

function ImportPanel({
  importing,
  dragOver,
  total,
  fileName,
  fileRef,
  onFileChange,
  onDrop,
  setDragOver,
  onOpenCrm,
}: {
  importing: boolean;
  dragOver: boolean;
  total: number;
  fileName: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  setDragOver: (v: boolean) => void;
  onOpenCrm: (source: CrmAudienceSource) => void;
}) {
  return (
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
            onClick={() => onOpenCrm('flota')}
          >
            <FlotaAreaSvgIcon className={cn(audienceActionIconClass, 'text-primary/80')} />
            Importar de Flota
          </button>
          <button
            type="button"
            className={audienceActionBtnClass}
            onClick={() => onOpenCrm('comercial')}
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
  );
}

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
  const [page, setPage] = useState(1);

  const total = audienceCount(audience);
  const fileName = audienceFileName(audience);
  const deferred = audience.mode === 'crmSelectAll';
  const canRemoveRows = audience.mode === 'explicit';

  const tableRows: WhatsAppContact[] = useMemo(() => {
    if (audience.mode === 'explicit') return audience.contacts;
    return audiencePreviewContacts(audience, audience.preview.length || 40);
  }, [audience]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [page, tableRows]);

  const hiddenBeyondPreview = Math.max(0, total - tableRows.length);

  useEffect(() => {
    setPage(1);
  }, [audience]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  const subtitle =
    total === 0
      ? 'Importa un Excel o contactos del CRM para armar la audiencia'
      : deferred
        ? `${total.toLocaleString('es-PE')} del filtro CRM · se cargan al enviar`
        : `${total.toLocaleString('es-PE')} contacto(s) listos para enviar`;

  return (
    <div className="space-y-4">
      {total === 0 ? (
        <div className="flex min-h-[420px] flex-col rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold">Importar audiencia</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sube un Excel con columnas <strong>nombre</strong> y <strong>teléfono</strong>. Opcional:{' '}
              <strong>empresa</strong> para mapear variables de la plantilla.
            </p>
          </div>
          <ImportPanel
            importing={importing}
            dragOver={dragOver}
            total={total}
            fileName={fileName}
            fileRef={fileRef}
            onFileChange={onFileChange}
            onDrop={onDrop}
            setDragOver={setDragOver}
            onOpenCrm={setCrmSource}
          />
        </div>
      ) : (
        <GlassCard>
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Audiencia de este envío
                <Badge variant="secondary" className="ml-2 align-middle">
                  {total.toLocaleString('es-PE')}
                </Badge>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
              {fileName ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileSpreadsheet className="size-3.5" />
                  {fileName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={onFileChange}
              />
              <button
                type="button"
                className={audienceToolbarBtnClass}
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                {importing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Excel
              </button>
              <button
                type="button"
                className={audienceToolbarBtnClass}
                onClick={() => setCrmSource('flota')}
              >
                <FlotaAreaSvgIcon className="size-3.5 text-primary/80" />
                Flota
              </button>
              <button
                type="button"
                className={audienceToolbarBtnClass}
                onClick={() => setCrmSource('comercial')}
              >
                <ComercialAreaSvgIcon className="size-3.5 text-primary/80" />
                Comercial
              </button>
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={onClear}>
                <Trash2 className="size-3.5" />
                Limpiar
              </Button>
            </div>
          </div>

          {tableRows.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Sin filas para mostrar"
              description="La audiencia está vacía o aún no hay vista previa disponible."
            />
          ) : (
            <>
              <div className="max-h-[calc(100vh-360px)] min-h-[320px] overflow-auto border-t border-border/40 scrollbar-thin">
                <table className="w-full table-fixed bg-transparent">
                  <thead>
                    <tr className={cn('sticky top-0 z-10 h-[36px] text-left', crmTableHeaderRowClass)}>
                      <th className="w-[44%] px-3 text-[11px] font-bold">Contacto</th>
                      <th className="w-[18%] px-3 text-[11px] font-bold">Teléfono</th>
                      <th className="hidden w-[18%] px-3 text-[11px] font-bold md:table-cell">
                        Empresa
                      </th>
                      <th className="hidden w-[12%] px-3 text-[11px] font-bold lg:table-cell">
                        Ciudad
                      </th>
                      <th className="w-[10%] px-3 text-[11px] font-bold">Origen</th>
                      {canRemoveRows ? (
                        <th className="w-[48px] px-2 text-[11px] font-bold">
                          <span className="sr-only">Quitar</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((c) => (
                      <tr key={c.id} className={cn('h-[52px] last:border-b-0', crmTableBodyRowClass)}>
                        <td className="overflow-hidden px-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex size-8 shrink-0 overflow-hidden rounded-full">
                              <AvatarImage name={c.name} size={32} />
                            </span>
                            <span className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="overflow-hidden px-3">
                          <span className="block truncate font-mono text-[13px] text-muted-foreground">
                            {formatWhatsAppPhoneDisplay(c.phone)}
                          </span>
                        </td>
                        <td className="hidden overflow-hidden px-3 md:table-cell">
                          <span className="block truncate text-[13px] text-muted-foreground">
                            {c.company || '—'}
                          </span>
                        </td>
                        <td className="hidden overflow-hidden px-3 lg:table-cell">
                          <span className="block truncate text-[13px] text-muted-foreground">
                            {c.city || '—'}
                          </span>
                        </td>
                        <td className="overflow-hidden px-3">
                          <Badge variant="outline" className="h-6 rounded-full text-[11px] font-semibold">
                            {WHATSAPP_SOURCE_LABEL[c.source]}
                          </Badge>
                        </td>
                        {canRemoveRows ? (
                          <td className="px-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => onRemoveIds([c.id])}
                              aria-label={`Quitar a ${c.name}`}
                            >
                              <X className="size-4" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hiddenBeyondPreview > 0 ? (
                <div className={cn('border-t px-5 py-2.5 text-xs text-muted-foreground', crmTableFooterClass)}>
                  Vista previa de {tableRows.length.toLocaleString('es-PE')} contacto(s). Los{' '}
                  {hiddenBeyondPreview.toLocaleString('es-PE')} restantes del filtro CRM se cargan al
                  enviar.
                </div>
              ) : null}

              {tableRows.length > PAGE_SIZE ? (
                <div className={cn('border-t px-4 py-2', crmTableFooterClass)}>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={tableRows.length}
                    pageSize={PAGE_SIZE}
                  />
                </div>
              ) : null}
            </>
          )}
        </GlassCard>
      )}

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
