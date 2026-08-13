import { useEffect, useState, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Eye, Loader2, MoreVertical, RefreshCw, Search, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import {
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
} from '@/components/ui/form-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClassSticky,
} from '@/lib/crmTableSurface';
import { comercialTableCheckboxWrapClass } from '@/lib/comercialTableLayout';
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  comercialProCommandClass,
  dateRangeToQueryBounds,
} from '@/lib/comercialFilterSurface';
import {
  fetchFacebookLeads, fetchFacebookForms, fetchFacebookAccounts, syncFacebookLeads, syncFacebookForms,
  sendLeadToComercial, sendLeadToFlota, previewLeadImport, deleteFacebookLead, bulkDeleteFacebookLeads,
  facebookPlatformLabel, leadImportedToComercial,
  type FacebookLead, type FacebookForm, type LeadTableColumn,
} from '@/lib/marketingApi';
import {
  LeadImportForm,
  ComercialEntityPicker,
  applyLeadImportPreview,
  EMPTY_COMERCIAL_IMPORT,
  EMPTY_EMPRESA_IMPORT,
  EMPTY_FLOTA_IMPORT,
  EMPTY_OPORTUNIDAD_IMPORT,
  type ComercialEntityType,
  type ComercialImportForm,
  type EmpresaImportForm,
  type FlotaImportForm,
  type LeadImportTarget,
  type OportunidadImportForm,
} from '@/pages/marketing/LeadImportForm';

const SKIP_FORM_FIELD = /^(full_?name|first_?name|last_?name|nombre|phone(_number)?|tel[eé]fono|celular|cel|email|correo|mail|inbox_url|platform|is_organic)$/i;

function humanizeFormFieldName(name: string): string {
  const cleaned = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function platformBadgeClass(platform?: string | null) {
  if (platform === 'ig') {
    return 'border-pink-300/60 bg-pink-50 text-pink-800 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-200';
  }
  if (platform === 'fb') {
    return 'border-blue-300/60 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
  }
  return 'border-border bg-muted text-muted-foreground';
}

function LeadInfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="break-words text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function LeadInfoText({ value, mono }: { value?: string | null; mono?: boolean }) {
  if (!value) return <span className="font-normal text-muted-foreground">—</span>;
  return <span className={cn(mono && 'font-mono tabular-nums')}>{value}</span>;
}

function leadFieldValue(lead: FacebookLead, key: string): string | null {
  const field = lead.fieldData?.find((f) => f.name === key);
  const fromForm = field?.values?.filter(Boolean).join(', ') || null;
  if (fromForm) return fromForm;
  if (/full_?name|first_?name|nombre/i.test(key)) return lead.fullName;
  if (/phone|tel[eé]fono|celular/i.test(key)) return lead.phone;
  if (/email|correo|mail/i.test(key)) return lead.email;
  return null;
}

function isMonoField(key: string) {
  return /phone|tel|cel|email|mail/i.test(key);
}

function isNameField(key: string) {
  return /name|nombre/i.test(key);
}

function leadColumnDefaultWidth(col: LeadTableColumn): number {
  if (isNameField(col.key)) return 180;
  if (/phone|tel|cel/i.test(col.key)) return 152;
  if (/email|mail/i.test(col.key)) return 180;
  return 176;
}

const FIXED_COL_WIDTHS = { select: 44, actions: 40, fuente: 112, destino: 112, fecha: 140 } as const;

function ColumnResizeHandle({ onResizeStart }: { onResizeStart: (clientX: number) => void }) {
  const start = (clientX: number, e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(clientX);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e: MouseEvent) => start(e.clientX, e)}
      onTouchStart={(e: TouchEvent) => start(e.touches[0]?.clientX ?? 0, e)}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-y-0 right-0 z-10 flex w-5 cursor-col-resize items-center justify-center group/rez"
    >
      <div className="pointer-events-none h-4 w-[2px] rounded-full bg-gray-200 transition-all select-none group-hover/rez:w-[5px] group-hover/rez:bg-blue-500 group-active/rez:w-[5px] group-active/rez:bg-blue-500" />
    </div>
  );
}

function DestinoBadge({ lead }: { lead: FacebookLead }) {
  if (leadImportedToComercial(lead)) {
    return (
      <Badge variant="outline" className="inline-flex h-6 items-center rounded-full border-emerald-300/60 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
        Comercial
      </Badge>
    );
  }
  if (lead.importedAsFlotaProspectoId) {
    return (
      <Badge variant="outline" className="inline-flex h-6 items-center rounded-full border-amber-300/60 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        Flota
      </Badge>
    );
  }
  return <span className="text-[13px] text-[#475569] dark:text-gray-400">Pendiente</span>;
}

function LeadDetailModal({ lead, open, onOpenChange, onSent }: {
  lead: FacebookLead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const [importTarget, setImportTarget] = useState<LeadImportTarget | null>(null);
  const [comercialEntity, setComercialEntity] = useState<ComercialEntityType | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [flotaForm, setFlotaForm] = useState<FlotaImportForm>(EMPTY_FLOTA_IMPORT);
  const [comercialForm, setComercialForm] = useState<ComercialImportForm>(EMPTY_COMERCIAL_IMPORT);
  const [empresaForm, setEmpresaForm] = useState<EmpresaImportForm>(EMPTY_EMPRESA_IMPORT);
  const [oportunidadForm, setOportunidadForm] = useState<OportunidadImportForm>(EMPTY_OPORTUNIDAD_IMPORT);

  const extraFormFields = (lead?.fieldData || []).filter((f) => !SKIP_FORM_FIELD.test(f.name.trim()));
  const alreadyComercial = !!lead && leadImportedToComercial(lead);
  const alreadyFlota = !!lead?.importedAsFlotaProspectoId;

  useEffect(() => {
    if (!open) {
      setImportTarget(null);
      setComercialEntity(null);
      setPreviewing(false);
      setFlotaForm(EMPTY_FLOTA_IMPORT);
      setComercialForm(EMPTY_COMERCIAL_IMPORT);
      setEmpresaForm(EMPTY_EMPRESA_IMPORT);
      setOportunidadForm(EMPTY_OPORTUNIDAD_IMPORT);
    }
  }, [open, lead?.id]);

  const openImport = async (target: LeadImportTarget) => {
    if (!lead) return;
    setImportTarget(target);
    setComercialEntity(null);
    if (target === 'comercial') return;
    setPreviewing(true);
    try {
      const preview = await previewLeadImport(lead.id, target);
      setFlotaForm(applyLeadImportPreview(EMPTY_FLOTA_IMPORT, preview));
    } catch {
      toast.error('No se pudo analizar el lead. Completa el formulario a mano.');
    } finally {
      setPreviewing(false);
    }
  };

  const selectComercialEntity = async (entity: ComercialEntityType) => {
    if (!lead) return;
    setComercialEntity(entity);
    setPreviewing(true);
    try {
      const preview = await previewLeadImport(lead.id, 'comercial', entity);
      if (entity === 'empresa') setEmpresaForm(applyLeadImportPreview(EMPTY_EMPRESA_IMPORT, preview));
      else if (entity === 'oportunidad') setOportunidadForm(applyLeadImportPreview(EMPTY_OPORTUNIDAD_IMPORT, preview));
      else setComercialForm(applyLeadImportPreview(EMPTY_COMERCIAL_IMPORT, preview));
    } catch {
      toast.error('No se pudo analizar el lead. Completa el formulario a mano.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleBackFromImport = () => {
    if (importTarget === 'comercial' && comercialEntity) {
      setComercialEntity(null);
      return;
    }
    setImportTarget(null);
  };

  const handleImport = async () => {
    if (!lead || !importTarget) return;
    if (importTarget === 'flota') {
      if (!flotaForm.nombreCompleto.trim() || !flotaForm.celular.trim()) {
        toast.error('Nombre y celular son requeridos');
        return;
      }
      setImporting(true);
      try {
        await sendLeadToFlota(lead.id, flotaForm);
        toast.success('Prospecto importado a Flota');
        onSent();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al importar');
      } finally {
        setImporting(false);
      }
      return;
    }
    if (!comercialEntity) return;
    if (comercialEntity === 'contacto' && !comercialForm.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (comercialEntity === 'empresa' && !empresaForm.name.trim()) {
      toast.error('El nombre de la empresa es requerido');
      return;
    }
    if (comercialEntity === 'oportunidad') {
      if (!oportunidadForm.title.trim()) {
        toast.error('El título es requerido');
        return;
      }
      if (!oportunidadForm.contactName.trim()) {
        toast.error('El nombre del contacto es requerido');
        return;
      }
      const amount = Number(oportunidadForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('El monto debe ser mayor que 0');
        return;
      }
      if (!oportunidadForm.expectedCloseDate.trim()) {
        toast.error('La fecha de cierre es requerida');
        return;
      }
    }
    setImporting(true);
    try {
      const dto = comercialEntity === 'empresa'
        ? { entityType: 'empresa' as const, ...empresaForm }
        : comercialEntity === 'oportunidad'
          ? { entityType: 'oportunidad' as const, ...oportunidadForm }
          : { entityType: 'contacto' as const, ...comercialForm };
      await sendLeadToComercial(lead.id, dto);
      const ok = comercialEntity === 'empresa'
        ? 'Empresa importada a Comercial'
        : comercialEntity === 'oportunidad'
          ? 'Oportunidad importada a Comercial'
          : 'Contacto importado a Comercial';
      toast.success(ok);
      onSent();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const importingPanel = importTarget !== null;
  const choosingComercial = importTarget === 'comercial' && !comercialEntity;
  const importTitle = importTarget === 'flota'
    ? 'Importar a Flota'
    : choosingComercial
      ? 'Enviar a Comercial'
      : comercialEntity === 'empresa'
        ? 'Importar empresa'
        : comercialEntity === 'oportunidad'
          ? 'Importar oportunidad'
          : 'Importar contacto';
  const importPanelLabel = importTarget === 'flota'
    ? 'Nuevo prospecto'
    : choosingComercial
      ? '¿Qué quieres crear?'
      : comercialEntity === 'empresa'
        ? 'Nueva empresa'
        : comercialEntity === 'oportunidad'
          ? 'Nueva oportunidad'
          : 'Nuevo contacto';

  return (
    <FormDialogShell
      open={open && !!lead}
      onOpenChange={onOpenChange}
      maxWidthClassName={importingPanel ? 'sm:max-w-5xl' : 'sm:max-w-lg'}
      title={importingPanel ? importTitle : 'Detalle del Lead'}
      description={lead ? `${lead.form.name} · ${new Date(lead.createdTime).toLocaleString('es-PE')}` : undefined}
      footer={(
        <div className="flex flex-row justify-end gap-3">
          {importingPanel ? (
            <>
              <Button
                type="button"
                variant="outline"
                className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
                onClick={handleBackFromImport}
                disabled={importing}
              >
                Volver
              </Button>
              {choosingComercial ? null : (
                <Button
                  type="button"
                  className={cn('min-w-[7.5rem]', formDialogBtnPrimaryClass)}
                  onClick={() => void handleImport()}
                  disabled={importing || previewing}
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {importing ? 'Importando…' : 'Importar'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
                onClick={() => void openImport('flota')}
                disabled={alreadyFlota}
              >
                {alreadyFlota ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
                {alreadyFlota ? 'Enviado a Flota' : 'Enviar a Flota'}
              </Button>
              <Button
                type="button"
                className={cn('min-w-[7.5rem]', formDialogBtnPrimaryClass)}
                onClick={() => void openImport('comercial')}
                disabled={alreadyComercial}
              >
                {alreadyComercial ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
                {alreadyComercial ? 'Enviado a Comercial' : 'Enviar a Comercial'}
              </Button>
            </>
          )}
        </div>
      )}
    >
      {lead ? (
        <div className={cn(importingPanel && 'grid gap-8 lg:grid-cols-2 lg:gap-10')}>
          <div className="space-y-5">
            <div className="space-y-4">
              <LeadInfoRow label="Nombre">
                <LeadInfoText value={lead.fullName} />
              </LeadInfoRow>
              <LeadInfoRow label="Teléfono">
                <LeadInfoText value={lead.phone} mono />
              </LeadInfoRow>
              <LeadInfoRow label="Email">
                <LeadInfoText value={lead.email} />
              </LeadInfoRow>
              <LeadInfoRow label="Anuncio">
                <LeadInfoText value={lead.adName} />
              </LeadInfoRow>
              <LeadInfoRow label="Fuente">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold',
                      platformBadgeClass(lead.platform),
                    )}
                  >
                    {facebookPlatformLabel(lead.platform)}
                  </Badge>
                  {lead.isOrganic ? (
                    <span className="text-xs font-normal text-muted-foreground">Orgánico</span>
                  ) : null}
                </div>
              </LeadInfoRow>
              <LeadInfoRow label="Destino">
                <DestinoBadge lead={lead} />
              </LeadInfoRow>
            </div>

            {extraFormFields.length > 0 ? (
              <div className="space-y-3 border-t border-border/50 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Respuestas del formulario
                </p>
                <div className="space-y-3">
                  {extraFormFields.map((f, i) => (
                    <LeadInfoRow key={`${f.name}-${i}`} label={humanizeFormFieldName(f.name)}>
                      <LeadInfoText value={f.values?.join(', ') || null} />
                    </LeadInfoRow>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {importingPanel ? (
            <div className="space-y-3 border-t border-border/50 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" />
                {importPanelLabel}
              </p>
              {choosingComercial ? (
                <ComercialEntityPicker onSelect={(entity) => void selectComercialEntity(entity)} />
              ) : previewing || !importTarget ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  Analizando el lead…
                </div>
              ) : (
                <LeadImportForm
                  target={importTarget}
                  comercialEntity={comercialEntity ?? 'contacto'}
                  flota={flotaForm}
                  comercial={comercialForm}
                  empresa={empresaForm}
                  oportunidad={oportunidadForm}
                  onFlotaChange={setFlotaForm}
                  onComercialChange={setComercialForm}
                  onEmpresaChange={setEmpresaForm}
                  onOportunidadChange={setOportunidadForm}
                />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </FormDialogShell>
  );
}

type DeleteTarget = {
  type: 'single' | 'bulk';
  id?: string;
  count?: number;
  name?: string;
};

export default function MarketingLeads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFormId = searchParams.get('formId') || '';
  const [leads, setLeads] = useState<FacebookLead[]>([]);
  const [columns, setColumns] = useState<LeadTableColumn[]>([]);
  const [forms, setForms] = useState<FacebookForm[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(initialFormId));
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState(initialFormId);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailLead, setDetailLead] = useState<FacebookLead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const load = async (p: number) => {
    if (!formFilter) {
      setLeads([]);
      setColumns([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const bounds = dateRangeToQueryBounds(dateRange);
      const res = await fetchFacebookLeads({
        page: p,
        limit: pageSize,
        search: search || undefined,
        formId: formFilter,
        dateFrom: bounds.from,
        dateTo: bounds.to,
      });
      setLeads(res.data);
      setColumns(res.columns ?? []);
      setTotal(res.total);
    } catch {
      setLeads([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async () => {
    try {
      const data = await fetchFacebookForms();
      setForms(data);
    } catch {
      // empty
    }
  };

  useEffect(() => { void loadForms(); }, []);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setSelectAllMode(false);
    void load(1);
  }, [search, formFilter, dateRange, pageSize]);

  useEffect(() => {
    setColWidths({});
  }, [formFilter]);

  useEffect(() => { void load(page); }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const colWidth = (id: string, fallback: number) => colWidths[id] ?? fallback;

  const startColResize = (id: string, current: number, startX: number) => {
    const onMove = (clientX: number) => {
      const next = Math.min(520, Math.max(88, current + (clientX - startX)));
      setColWidths((prev) => ({ ...prev, [id]: next }));
    };
    const onMouseMove = (ev: globalThis.MouseEvent) => onMove(ev.clientX);
    const onTouchMove = (ev: globalThis.TouchEvent) => onMove(ev.touches[0]?.clientX ?? startX);
    const stop = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', stop);
  };

  const tableWidth =
    FIXED_COL_WIDTHS.select +
    FIXED_COL_WIDTHS.actions +
    columns.reduce((sum, col) => sum + colWidth(col.key, leadColumnDefaultWidth(col)), 0) +
    colWidth('fuente', FIXED_COL_WIDTHS.fuente) +
    colWidth('destino', FIXED_COL_WIDTHS.destino) +
    colWidth('fecha', FIXED_COL_WIDTHS.fecha);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const accounts = await fetchFacebookAccounts();
      let totalImported = 0;
      for (const acc of accounts) {
        await syncFacebookForms(acc.id);
        const r = await syncFacebookLeads(acc.id);
        totalImported += r.imported;
      }
      toast.success(`${totalImported} leads importados`);
      void loadForms();
      void load(page);
    } catch {
      toast.error('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectAllMode) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelected(new Set());
      return;
    }
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  };

  const handleSelectAllPages = () => {
    setSelectAllMode(true);
    setSelected(new Set(leads.map((l) => l.id)));
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'single' && deleteTarget.id) {
        await deleteFacebookLead(deleteTarget.id);
        toast.success('Lead eliminado');
      } else {
        const result = await bulkDeleteFacebookLeads(
          selectAllMode
            ? {
                selectAll: true,
                formId: formFilter || undefined,
                search: search || undefined,
                dateFrom: dateRangeToQueryBounds(dateRange).from,
                dateTo: dateRangeToQueryBounds(dateRange).to,
              }
            : { ids: Array.from(selected) },
        );
        toast.success(`${result.deleted} lead(s) eliminados`);
      }
      setDeleteTarget(null);
      setSelected(new Set());
      setSelectAllMode(false);
      void load(page);
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const allPageSelected = leads.length > 0 && selected.size === leads.length;
  const selectedCount = selectAllMode ? total : selected.size;
  const formLabel = forms.find((f) => f.id === formFilter)?.name ?? 'Formulario';
  const hasActiveFilters = search.trim() !== '' || Boolean(dateRange?.from || dateRange?.to);

  const selectForm = (id: string) => {
    setFormFilter(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('formId', id);
      else next.delete('formId');
      return next;
    }, { replace: true });
  };

  const clearFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setPage(1);
    setSelected(new Set());
    setSelectAllMode(false);
  };

  return (
    <div>
      <PageHeader
        title="Leads Facebook"
        description="Leads importados desde formularios de Facebook Lead Ads"
        className="mb-4"
      >
        <Button className="h-9 text-sm font-normal shadow-md" onClick={() => void handleSync()} disabled={syncing}>
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Sincronizar
        </Button>
      </PageHeader>

      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {selectAllMode ? (
              <span className="text-sm font-medium">Todos los {total} leads del filtro están seleccionados</span>
            ) : (
              <span className="text-sm font-medium">{selected.size} de {total} seleccionados</span>
            )}
            {!selectAllMode && allPageSelected && total > leads.length && (
              <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={handleSelectAllPages}>
                Seleccionar todos los {total} leads
              </Button>
            )}
            {selectAllMode && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 text-xs"
                onClick={() => { setSelectAllMode(false); setSelected(new Set()); }}
              >
                Deseleccionar todo
              </Button>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget({ type: 'bulk', count: selectedCount })}
          >
            <Trash2 className="size-4" /> Eliminar ({selectedCount})
          </Button>
        </div>
      )}

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre, teléfono o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!formFilter}
              className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none disabled:opacity-60"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className={`!h-10 w-[240px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left ${formFilter ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
                <ChartSquareIcon className={comercialFilterIconClass} />
                <span className="truncate flex-1">{formFilter ? formLabel : 'Selecciona un formulario'}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className={cn(comercialProPopoverClass, 'w-[280px] p-1.5')} align="start" sideOffset={8}>
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {forms.map((f) => (
                      <CommandItem key={f.id} onSelect={() => selectForm(f.id)}>
                        <span className="[&_svg]:!text-primary-foreground">
                          <Checkbox
                            checked={formFilter === f.id}
                            className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                        </span>
                        <span className="truncate">{f.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <DateRangeFilterButton
            value={dateRange}
            onChange={setDateRange}
            placeholder="Fecha"
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}
        </div>

        {!formFilter ? (
          <div className="border-t border-border/40 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">Selecciona un formulario para ver los leads</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada formulario tiene sus propias preguntas; las columnas se adaptan al que elijas.
            </p>
          </div>
        ) : loading && leads.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center border-t border-border/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="border-t border-border/40 p-8 text-center text-sm text-muted-foreground">
            {search || dateRange ? 'Sin resultados' : 'Este formulario aún no tiene leads.'}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 scrollbar-thin">
            <table className="w-full table-fixed" style={{ minWidth: tableWidth }}>
              <colgroup>
                <col style={{ width: FIXED_COL_WIDTHS.select }} />
                <col style={{ width: FIXED_COL_WIDTHS.actions }} />
                {columns.map((col) => (
                  <col key={col.key} style={{ width: colWidth(col.key, leadColumnDefaultWidth(col)) }} />
                ))}
                <col style={{ width: colWidth('fuente', FIXED_COL_WIDTHS.fuente) }} />
                <col style={{ width: colWidth('destino', FIXED_COL_WIDTHS.destino) }} />
                <col style={{ width: colWidth('fecha', FIXED_COL_WIDTHS.fecha) }} />
              </colgroup>
              <thead>
                <tr className={cn('h-[36px] text-left', crmTableHeaderRowClassSticky)}>
                  <th className="px-2">
                    <div className={comercialTableCheckboxWrapClass}>
                      <Checkbox
                        checked={selectAllMode || allPageSelected}
                        onCheckedChange={toggleSelectAll}
                        className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                    </div>
                  </th>
                  <th />
                  {columns.map((col) => {
                    const width = colWidth(col.key, leadColumnDefaultWidth(col));
                    return (
                      <th
                        key={col.key}
                        className="relative overflow-hidden px-3 text-[11px] font-bold"
                        title={col.label}
                      >
                        <span className="block truncate pr-2">{col.label}</span>
                        <ColumnResizeHandle onResizeStart={(x) => startColResize(col.key, width, x)} />
                      </th>
                    );
                  })}
                  {(['fuente', 'destino', 'fecha'] as const).map((id) => {
                    const labels = { fuente: 'Fuente', destino: 'Destino', fecha: 'Fecha' };
                    const width = colWidth(id, FIXED_COL_WIDTHS[id]);
                    return (
                      <th key={id} className="relative overflow-hidden px-3 text-[11px] font-bold">
                        <span className="block truncate pr-2">{labels[id]}</span>
                        <ColumnResizeHandle onResizeStart={(x) => startColResize(id, width, x)} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const isSelected = selectAllMode || selected.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={cn('h-[48px] last:border-b-0', crmTableBodyRowClassInteractive)}
                      onClick={() => setDetailLead(lead)}
                    >
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>
                        <div className={comercialTableCheckboxWrapClass}>
                          <Checkbox
                            checked={isSelected}
                            disabled={selectAllMode}
                            onCheckedChange={() => toggleSelect(lead.id)}
                            className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                              <Eye /> Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget({ type: 'single', id: lead.id, name: lead.fullName || 'este lead' })}
                            >
                              <Trash2 /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      {columns.map((col) => {
                        const value = leadFieldValue(lead, col.key);
                        return (
                          <td key={col.key} className="overflow-hidden px-3">
                            <span
                              className={cn(
                                'block truncate text-[13px] text-[#475569] dark:text-gray-400',
                                isNameField(col.key) && 'font-semibold text-[#0F172A] dark:text-gray-100',
                                isMonoField(col.key) && 'font-mono tabular-nums',
                              )}
                              title={value || undefined}
                            >
                              {value || '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="overflow-hidden px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-[11px] font-semibold',
                            platformBadgeClass(lead.platform),
                          )}
                        >
                          {facebookPlatformLabel(lead.platform)}
                        </Badge>
                      </td>
                      <td className="overflow-hidden px-3">
                        <DestinoBadge lead={lead} />
                      </td>
                      <td className="overflow-hidden px-3">
                        <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400">
                          {new Date(lead.createdTime).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {formFilter && total > 0 && (
          <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        )}
      </GlassCard>

      <FormDialogShell
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        maxWidthClassName="sm:max-w-md"
        title={`Eliminar lead${deleteTarget?.type === 'bulk' ? 's' : ''}`}
        description="Esta acción no se puede deshacer."
        footer={(
          <div className="flex flex-row justify-end">
            <Button
              type="button"
              variant="destructive"
              className="h-10 min-w-[7.5rem] rounded-lg px-6 shadow-none"
              onClick={() => void executeDelete()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="size-5 text-red-600" />
          </div>
          <p className="text-sm">
            {deleteTarget?.type === 'single' ? (
              <>¿Estás seguro de eliminar <strong>{deleteTarget.name}</strong>?</>
            ) : (
              <>
                ¿Estás seguro de eliminar <strong>{deleteTarget?.count ?? 0} lead(s)</strong>?
                {selectAllMode && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Se eliminarán todos los leads que coinciden con el filtro actual.
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </FormDialogShell>

      <LeadDetailModal
        lead={detailLead}
        open={!!detailLead}
        onOpenChange={(v) => { if (!v) setDetailLead(null); }}
        onSent={() => void load(page)}
      />
    </div>
  );
}
