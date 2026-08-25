import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { GlassCard } from '@/components/shared/GlassCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { ComercialInclusiveMultiFilter } from '@/components/shared/ComercialInclusiveMultiFilter';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { EyeSvgIcon } from '@/components/icons/EyeSvgIcon';
import { TrashSvgIcon } from '@/components/icons/TrashSvgIcon';
import { cn } from '@/lib/utils';
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  matchesInclusiveMultiFilterValue,
} from '@/lib/comercialFilterSurface';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import { PhonePreview } from './PhonePreview';
import { CreateTemplateDialog } from './CreateTemplateDialog';
import {
  WHATSAPP_CATEGORY_ICON,
  WHATSAPP_CATEGORY_META,
  WHATSAPP_CATEGORY_META_CODE,
  WHATSAPP_STATUS_CLASS,
  WHATSAPP_STATUS_LABEL,
  extractWhatsAppPlaceholders,
  type WhatsAppTemplate,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateStatus,
} from './mockData';

function renderVariables(body: string, sampleVariables: string[]): string {
  return body.replace(/\{\{([a-z][a-z0-9_]*|\d+)\}\}/gi, (_, key: string) => {
    if (/^\d+$/.test(key)) {
      const label = sampleVariables[Number(key) - 1];
      return label ? `«${label}»` : `«${key}»`;
    }
    return `«${key}»`;
  });
}

const QUALITY_CLASS: Record<string, string> = {
  alta: 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  media: 'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  baja: 'border-red-300/60 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const CATEGORY_OPTIONS = (Object.keys(WHATSAPP_CATEGORY_META) as WhatsAppTemplateCategory[]).map(
  (value) => ({ value, label: WHATSAPP_CATEGORY_META[value] }),
);

const STATUS_OPTIONS = (Object.keys(WHATSAPP_STATUS_LABEL) as WhatsAppTemplateStatus[]).map(
  (value) => ({ value, label: WHATSAPP_STATUS_LABEL[value] }),
);

const TOGGLEABLE_COLUMNS = [
  { id: 'categoria', label: 'Categoría' },
  { id: 'body', label: 'Cuerpo' },
  { id: 'calidad', label: 'Calidad' },
  { id: 'variables', label: 'Variables' },
  { id: 'botones', label: 'Botones' },
  { id: 'fecha', label: 'Creada' },
] as const;

type ColumnId = (typeof TOGGLEABLE_COLUMNS)[number]['id'];

const CRM_CELL_MUTED = 'text-[13px] text-[#475569] dark:text-gray-400';

function TemplatePreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: WhatsAppTemplate;
  onClose: () => void;
  onUse: (id: string) => void;
}) {
  const body = renderVariables(template.body, template.sampleVariables);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-template-preview-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-8 pt-8 scrollbar-thin">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2
                id="wa-template-preview-title"
                className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-foreground"
              >
                {template.name}
                <Badge
                  variant="outline"
                  className={cn(
                    'h-6 rounded-full text-[11px] font-semibold',
                    WHATSAPP_STATUS_CLASS[template.status],
                  )}
                >
                  {WHATSAPP_STATUS_LABEL[template.status]}
                </Badge>
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {WHATSAPP_CATEGORY_META[template.category]} · {template.language.toUpperCase()} · Creada{' '}
                {template.createdAt}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full bg-muted/70 text-muted-foreground shadow-none hover:bg-muted"
              onClick={onClose}
            >
              <X className="size-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>

          <div className="mt-6 grid min-w-0 items-start gap-6 pb-2 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 space-y-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contenido
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{body}</p>
              </div>
              {template.buttons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Botones
                  </p>
                  {template.buttons.map((button, index) => (
                    <div key={index} className="rounded-lg border px-3 py-2 text-sm">
                      {button.type === 'quick_reply' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">⚡ {button.text}</span>
                      ) : button.type === 'url' ? (
                        <span className="break-all text-blue-600 dark:text-blue-400">
                          🔗 {button.text} — {button.url}
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">📞 {button.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden min-w-0 lg:block">
              <PhonePreview
                senderName="Taxi Monterrico"
                contactName="Contacto"
                header={template.header ? renderVariables(template.header, template.sampleVariables) : undefined}
                headerMedia={template.headerMedia}
                footer={template.footer}
                body={body}
                buttons={template.buttons}
                read
                time="Ahora"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 bg-background px-8 py-5">
          <Button
            type="button"
            variant="outline"
            className="h-9 text-sm font-normal"
            onClick={onClose}
          >
            Cerrar
          </Button>
          {template.status === 'approved' && (
            <Button
              type="button"
              className="h-9 text-sm font-normal shadow-md"
              onClick={() => onUse(template.id)}
            >
              <Send className="size-4" />
              Usar en envío
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TemplatesTab({
  templates,
  onCreate,
  onDelete,
  onSync,
  syncing,
  onUseTemplate,
}: {
  templates: WhatsAppTemplate[];
  onCreate: (t: WhatsAppTemplate) => void;
  onDelete: (id: string) => void;
  onSync: () => void;
  syncing: boolean;
  onUseTemplate: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Partial<Record<ColumnId, boolean>>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<WhatsAppTemplate | null>(null);

  const closePreview = useCallback(() => setPreview(null), []);
  const isColumnVisible = (id: ColumnId) => hiddenColumns[id] !== true;

  const hasActiveFilters =
    Boolean(search.trim()) || categoryFilter.length > 0 || statusFilter.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (!matchesInclusiveMultiFilterValue(categoryFilter, t.category)) return false;
      if (!matchesInclusiveMultiFilterValue(statusFilter, t.status)) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none placeholder:text-[#8a9aab] transition-colors hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>
          <ComercialInclusiveMultiFilter
            value={categoryFilter}
            onChange={(next) => {
              setCategoryFilter(next);
              setPage(1);
            }}
            options={CATEGORY_OPTIONS}
            placeholder="Categoría"
            countLabel="categorías"
            icon={<LayoutGrid className={comercialFilterIconClass} />}
          />
          <ComercialInclusiveMultiFilter
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            placeholder="Estado"
            countLabel="estados"
            icon={<Activity className={comercialFilterIconClass} />}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter([]);
                setStatusFilter([]);
                setPage(1);
              }}
            >
              <X className="size-4" /> Limpiar
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-5">
            <Popover modal={false}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] transition-opacity hover:opacity-70 dark:text-gray-100"
                >
                  <ColumnsSvgIcon className="size-[18px]" />
                  Columnas
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={cn(comercialProPopoverClass, 'w-[200px] p-1.5')}
                align="end"
                sideOffset={8}
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <div className="flex flex-col">
                  {TOGGLEABLE_COLUMNS.map((col) => {
                    const visible = isColumnVisible(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() =>
                          setHiddenColumns((prev) => ({ ...prev, [col.id]: visible }))
                        }
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={visible}
                          className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                        <span className="text-[#1f2933] dark:text-gray-100">{col.label}</span>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-9 text-sm font-normal"
                onClick={onSync}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sincronizar
              </Button>
              <Button
                className="h-9 text-sm font-normal shadow-md"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                Nueva
              </Button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No hay plantillas"
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros o crea una nueva plantilla.'
                : 'Crea una plantilla o sincroniza las aprobadas desde Meta.'
            }
            actionLabel="Nueva plantilla"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 scrollbar-thin">
            <table className="w-full table-fixed bg-transparent">
              <thead>
                <tr className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                  <th className="px-3 text-[11px] font-bold">Plantilla</th>
                  {isColumnVisible('categoria') && <th className="w-[130px] px-3 text-[11px] font-bold">Categoría</th>}
                  {isColumnVisible('body') && <th className="px-3 text-[11px] font-bold">Cuerpo</th>}
                  <th className="w-[120px] px-3 text-[11px] font-bold">Estado</th>
                  {isColumnVisible('calidad') && <th className="w-[110px] px-3 text-[11px] font-bold">Calidad</th>}
                  {isColumnVisible('variables') && <th className="w-[100px] px-3 text-[11px] font-bold">Variables</th>}
                  {isColumnVisible('botones') && <th className="w-[90px] px-3 text-[11px] font-bold">Botones</th>}
                  {isColumnVisible('fecha') && <th className="w-[120px] px-3 text-[11px] font-bold">Creada</th>}
                  <th className="w-[116px]" />
                </tr>
              </thead>
              <tbody className="bg-transparent">
                {pagedData.map((t) => {
                  const CategoryIcon = WHATSAPP_CATEGORY_ICON[t.category];
                  return (
                    <tr
                      key={t.id}
                      className={cn('h-[52px] last:border-b-0', crmTableBodyRowClassInteractive)}
                      onClick={() => setPreview(t)}
                    >
                      <td className="overflow-hidden px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <CategoryIcon className="size-4 text-muted-foreground" />
                          </span>
                          <div className="min-w-0">
                            <p className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100" title={t.name}>
                              {t.name}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {t.language.toUpperCase()} · {WHATSAPP_CATEGORY_META_CODE[t.category]}
                            </p>
                          </div>
                        </div>
                      </td>
                      {isColumnVisible('categoria') && (
                        <td className="overflow-hidden px-3">
                          <span className={CRM_CELL_MUTED}>{WHATSAPP_CATEGORY_META[t.category]}</span>
                        </td>
                      )}
                      {isColumnVisible('body') && (
                        <td className="overflow-hidden px-3">
                          <span
                            className="line-clamp-2 block max-h-10 text-[13px] leading-snug text-[#475569] dark:text-gray-400"
                            title={renderVariables(t.body, t.sampleVariables)}
                          >
                            {renderVariables(t.body, t.sampleVariables)}
                          </span>
                        </td>
                      )}
                      <td className="overflow-hidden px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold',
                            WHATSAPP_STATUS_CLASS[t.status],
                          )}
                        >
                          {WHATSAPP_STATUS_LABEL[t.status]}
                        </Badge>
                      </td>
                      {isColumnVisible('calidad') && (
                        <td className="overflow-hidden px-3">
                          <Badge
                            variant="outline"
                            className={cn('h-6 rounded-full px-2.5 text-[11px] font-medium', QUALITY_CLASS[t.qualityRating])}
                          >
                            {t.qualityRating}
                          </Badge>
                        </td>
                      )}
                      {isColumnVisible('variables') && (
                        <td className="overflow-hidden px-3">
                          <span className={CRM_CELL_MUTED}>
                            {extractWhatsAppPlaceholders(t.header, t.body).length}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('botones') && (
                        <td className="overflow-hidden px-3">
                          <span className={CRM_CELL_MUTED}>{t.buttons.length}</span>
                        </td>
                      )}
                      {isColumnVisible('fecha') && (
                        <td className="overflow-hidden px-3">
                          <span className={CRM_CELL_MUTED}>{t.createdAt}</span>
                        </td>
                      )}
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title="Vista previa"
                            onClick={() => setPreview(t)}
                          >
                            <EyeSvgIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title="Usar en envío"
                            disabled={t.status !== 'approved'}
                            onClick={() => onUseTemplate(t.id)}
                          >
                            <Send className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar"
                            onClick={() => onDelete(t.id)}
                          >
                            <TrashSvgIcon />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
            </>
          )}
      </GlassCard>

      {createOpen ? (
        <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreate} />
      ) : null}

      {preview ? (
        <TemplatePreviewModal
          template={preview}
          onClose={closePreview}
          onUse={(id) => {
            closePreview();
            onUseTemplate(id);
          }}
        />
      ) : null}
    </div>
  );
}
