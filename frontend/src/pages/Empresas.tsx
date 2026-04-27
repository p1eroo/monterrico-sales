import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, Building2, Users, ChevronRight, ChevronLeft, Briefcase,
  FileSpreadsheet, Upload, Download, Plus, List, Grid3X3, Loader2,
  Eye, Pencil, Trash2, MoreHorizontal, Globe, Tag, User, MapPin,
} from 'lucide-react';
import type { Etapa, CompanyRubro, CompanyTipo, Company, ContactSource } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useCompaniesStore } from '@/store/companiesStore';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ImportInProgressDialog } from '@/components/shared/ImportInProgressDialog';
import { CompanyEditDialog, type CompanyEditSavePayload } from '@/components/shared/CompanyEditDialog';
import { CompanyPreviewSheet } from '@/components/shared/CompanyPreviewSheet';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { addCalendarDaysLocalIso } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import {
  downloadImportExportCsv,
  previewCompaniesImportCsv,
  startImportJob,
  type CompanyImportPreviewResult,
} from '@/lib/importExportApi';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import {
  type ApiCompanyRecord,
  type CompanySummaryRow,
  companyListSummaryPaginated,
  companySummaryEtapaCounts,
  isLikelyCompanyCuid,
} from '@/lib/companyApi';
import { isLikelyContactCuid, contactCreate } from '@/lib/contactApi';
import { companyDetailHref, contactDetailHref } from '@/lib/detailRoutes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useImportJobsStore } from '@/store/importJobsStore';
import {
  CrmDataTableSkeleton,
  CrmEntityCardGridSkeleton,
} from '@/components/shared/CrmListPageSkeleton';

const EMPRESAS_TABLE_SKELETON_COLUMNS = [
  { label: 'Empresa', className: '', cellClassName: '' },
  { label: 'Etapa', className: 'hidden md:table-cell' },
  { label: 'Fuente', className: 'hidden lg:table-cell' },
  { label: 'Rubro', className: 'hidden md:table-cell' },
  { label: 'Tipo', className: 'hidden md:table-cell' },
  { label: 'Recuperado', className: 'hidden lg:table-cell' },
  { label: 'Asesor', className: 'hidden xl:table-cell' },
  { label: 'Creación', className: '' },
  { label: 'Contactos', className: 'text-center' },
  { label: 'Última interacción', className: '' },
  { label: '', className: 'w-10' },
] as const;

type EmpresaSummaryRow = CompanySummaryRow & { isLocalOnly?: boolean };

function slugifyCompany(company: string): string {
  return encodeURIComponent(company.trim());
}

function empresaDetailPath(row: EmpresaSummaryRow): string {
  if (row.isLocalOnly || !isLikelyCompanyCuid(row.id)) {
    return `/empresas/${slugifyCompany(row.name)}`;
  }
  return companyDetailHref({ id: row.id, urlSlug: row.urlSlug });
}

function localCompanyToSummary(c: Company): EmpresaSummaryRow {
  return {
    id: c.id,
    name: c.name,
    razonSocial: null,
    ruc: null,
    telefono: null,
    domain: c.domain ?? null,
    rubro: c.rubro ?? null,
    tipo: c.tipo ?? null,
    facturacionEstimada: 0,
    fuente: null,
    etapa: 'lead',
    assignedTo: null,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
    contactCount: 0,
    totalEstimatedValue: 0,
    displayEtapa: 'lead',
    displayFuente: null,
    displayAdvisorUserId: null,
    displayAdvisorName: null,
    clienteRecuperado: null,
    contactsPreview: [],
    lastInteractionAt: null,
    isLocalOnly: true,
  };
}

function EmpresaContactsList({
  items,
  totalCount,
  onPick,
}: {
  items: { id: string; name: string; urlSlug?: string }[];
  totalCount: number;
  onPick: (row: { id: string; urlSlug?: string }) => void;
}) {
  return (
    <>
      <div className="border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Contactos vinculados ({totalCount}
          {items.length < totalCount ? ` · mostrando ${items.length}` : ''})
        </p>
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onPick(c)}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Clic en el contador / fila abre lista de contactos (evita navegar con la fila/tarjeta). */
function EmpresaContactsPopover({
  contactCount,
  preview,
  variant = 'table',
}: {
  contactCount: number;
  preview: { id: string; name: string; urlSlug?: string }[];
  variant?: 'table' | 'card';
}) {
  const navigate = useNavigate();
  const n = contactCount;
  const go = (row: { id: string; urlSlug?: string }) =>
    navigate(contactDetailHref(row));

  if (n === 0) {
    if (variant === 'card') {
      return (
        <p className="flex items-center gap-2">
          <Users className="size-3 shrink-0" /> Sin contactos
        </p>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'table' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 font-normal"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver ${n} contacto${n !== 1 ? 's' : ''}`}
          >
            <Badge variant="secondary" className="tabular-nums">
              {n}
            </Badge>
          </Button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md text-left hover:bg-muted/80 -mx-1 px-1 py-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver ${n} contacto${n !== 1 ? 's' : ''}`}
          >
            <Users className="size-3 shrink-0" />
            <span>
              {n} contacto{n !== 1 ? 's' : ''}
              <span className="ml-1 text-xs text-primary">· ver</span>
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align={variant === 'table' ? 'center' : 'start'}
        onClick={(e) => e.stopPropagation()}
      >
        <EmpresaContactsList items={preview} totalCount={n} onPick={go} />
      </PopoverContent>
    </Popover>
  );
}

function parseRubroFromApi(s: string | null | undefined): CompanyRubro | undefined {
  if (!s) return undefined;
  return s in companyRubroLabels ? (s as CompanyRubro) : undefined;
}

function parseTipoFromApi(s: string | null | undefined): CompanyTipo | undefined {
  if (!s) return undefined;
  return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
}

function sourceLabelFromApi(s: string | null | undefined): string {
  if (!s) return '—';
  return s in contactSourceLabels
    ? contactSourceLabels[s as ContactSource]
    : s;
}

function importPreviewCell(v: string | undefined) {
  const t = (v ?? '').trim();
  if (t === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="block truncate" title={t}>
      {t}
    </span>
  );
}

const ITEMS_PER_PAGE = 25;

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { companies: standaloneCompanies, updateCompany, deleteCompany } = useCompaniesStore();

  const [summaryRows, setSummaryRows] = useState<CompanySummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [etapaFilter, setEtapaFilter] = useState<string>('todos');
  const [rubroFilter, setRubroFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    advisorFilter,
    setAdvisorFilter,
    'todos',
  );
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [newEmpresaOpen, setNewEmpresaOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreviewInProgress, setImportPreviewInProgress] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] =
    useState<CompanyImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(
    null,
  );
  const [exportBusy, setExportBusy] = useState(false);
  const { activeAdvisors } = useUsers();
  const { hasPermission } = usePermissions();
  const [previewEmpresa, setPreviewEmpresa] = useState<EmpresaSummaryRow | null>(null);
  const [editEmpresa, setEditEmpresa] = useState<EmpresaSummaryRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaSummaryRow | null>(null);
  const [etapaTabCounts, setEtapaTabCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const enqueueImportJob = useImportJobsStore((s) => s.enqueueJob);
  const companyImportCompletionTick = useImportJobsStore(
    (s) => s.completionTickByEntity.companies,
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyListSummaryPaginated({
        page,
        limit: ITEMS_PER_PAGE,
        search: searchDebounced || undefined,
        etapa: etapaFilter === 'todos' ? undefined : etapaFilter,
        fuente: sourceFilter === 'todos' ? undefined : sourceFilter,
        assignedTo: advisorFilter === 'todos' ? undefined : advisorFilter,
        rubro: rubroFilter === 'todos' ? undefined : rubroFilter,
        tipo: tipoFilter === 'todos' ? undefined : tipoFilter,
      });
      setSummaryRows(res.data);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages));
    } catch {
      setSummaryRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    searchDebounced,
    etapaFilter,
    sourceFilter,
    advisorFilter,
    rubroFilter,
    tipoFilter,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadEtapaTabCounts = useCallback(async () => {
    try {
      const { counts } = await companySummaryEtapaCounts({
        search: searchDebounced || undefined,
        fuente: sourceFilter === 'todos' ? undefined : sourceFilter,
        assignedTo: advisorFilter === 'todos' ? undefined : advisorFilter,
        rubro: rubroFilter === 'todos' ? undefined : rubroFilter,
        tipo: tipoFilter === 'todos' ? undefined : tipoFilter,
      });
      setEtapaTabCounts(counts);
    } catch {
      setEtapaTabCounts({});
    }
  }, [
    searchDebounced,
    sourceFilter,
    advisorFilter,
    rubroFilter,
    tipoFilter,
  ]);

  useEffect(() => {
    void loadEtapaTabCounts();
  }, [loadEtapaTabCounts]);

  useEffect(() => {
    if (!companyImportCompletionTick) return;
    void loadSummary();
    void loadEtapaTabCounts();
  }, [companyImportCompletionTick, loadEtapaTabCounts, loadSummary]);

  const filtersDefault =
    !searchDebounced &&
    sourceFilter === 'todos' &&
    etapaFilter === 'todos' &&
    rubroFilter === 'todos' &&
    tipoFilter === 'todos' &&
    (canSeeAllAdvisors
      ? advisorFilter === 'todos'
      : advisorFilter === currentUserId);

  const companyImportPreviewCsvKeys = useMemo(() => {
    const withCols = importPreviewData?.rows.find(
      (r) => r.csvColumns && Object.keys(r.csvColumns).length > 0,
    );
    return withCols ? Object.keys(withCols.csvColumns) : [];
  }, [importPreviewData]);

  const displayRows = useMemo((): EmpresaSummaryRow[] => {
    if (page !== 1 || !filtersDefault || standaloneCompanies.length === 0) {
      return summaryRows;
    }
    const names = new Set(
      summaryRows.map((r) => r.name.trim().toLowerCase()),
    );
    const locals = standaloneCompanies
      .filter((c) => !names.has(c.name.trim().toLowerCase()))
      .map(localCompanyToSummary);
    return [...locals, ...summaryRows];
  }, [summaryRows, page, filtersDefault, standaloneCompanies]);

  /** Conteos de pestañas: servidor + empresas solo locales (cuentan como etapa lead). */
  const effectiveEtapaTabCounts = useMemo((): Record<string, number> => {
    const base = etapaTabCounts ? { ...etapaTabCounts } : null;
    if (!base) return {};
    if (!(page === 1 && filtersDefault && standaloneCompanies.length > 0)) {
      return base;
    }
    const names = new Set(
      summaryRows.map((r) => r.name.trim().toLowerCase()),
    );
    let extraLead = 0;
    for (const c of standaloneCompanies) {
      if (!names.has(c.name.trim().toLowerCase())) {
        extraLead += 1;
      }
    }
    if (extraLead > 0) {
      base.lead = (base.lead ?? 0) + extraLead;
    }
    return base;
  }, [
    etapaTabCounts,
    page,
    filtersDefault,
    standaloneCompanies,
    summaryRows,
  ]);

  useEffect(() => {
    if (etapaTabCounts == null) return;
    if (etapaFilter === 'todos') return;
    if ((effectiveEtapaTabCounts[etapaFilter] ?? 0) > 0) return;
    setEtapaFilter('todos');
    setPage(1);
  }, [etapaTabCounts, etapaFilter, effectiveEtapaTabCounts]);

  async function handleNewEmpresaSubmit(
    data: NewCompanyData,
    meta: NewCompanyWizardSubmitMeta,
  ) {
    if (!data.origenLead) {
      const msg = 'Selecciona la fuente del lead';
      toast.error(msg);
      throw new Error(msg);
    }

    if (meta.mode === 'update' && meta.existingCompanyId) {
      try {
        await api(`/companies/${meta.existingCompanyId}`, {
          method: 'PATCH',
          body: JSON.stringify(newCompanyDataToPatchBody(data)),
        });
        await loadSummary();
        toast.success(`Empresa "${data.nombreComercial.trim()}" actualizada`);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'No se pudo actualizar la empresa';
        toast.error(msg);
        throw e instanceof Error ? e : new Error(msg);
      }
      return;
    }

    const monto = Number(data.facturacion);
    if (!Number.isFinite(monto) || monto <= 0) {
      const msg = 'La facturación estimada debe ser mayor que 0';
      toast.error(msg);
      throw new Error(msg);
    }

    const assignedTo = data.propietario?.trim() || activeAdvisors[0]?.id || '';

    let created: ApiCompanyRecord;
    try {
      created = await api<ApiCompanyRecord>('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: data.nombreComercial.trim(),
          razonSocial: data.razonSocial.trim() || undefined,
          ruc: data.ruc.trim() || undefined,
          telefono: data.telefono.trim() || undefined,
          domain: data.dominio.trim() || undefined,
          rubro: data.rubro || undefined,
          tipo: data.tipoEmpresa || undefined,
          linkedin: data.linkedin.trim() || undefined,
          correo: data.correo.trim() || undefined,
          distrito: data.distrito.trim() || undefined,
          provincia: data.provincia.trim() || undefined,
          departamento: data.departamento.trim() || undefined,
          direccion: data.direccion.trim() || undefined,
          facturacionEstimada: monto,
          fuente: data.origenLead,
          clienteRecuperado: data.clienteRecuperado,
          etapa: data.etapa,
          ...(assignedTo && isLikelyContactCuid(assignedTo)
            ? { assignedTo }
            : {}),
        }),
      });
      await loadSummary();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo guardar la empresa en el servidor';
      toast.error(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
    const oppTitle =
      data.nombreNegocio.trim() || data.nombreComercial.trim() || 'Sin título';
    const expectedCloseDate =
      data.fechaCierre.trim() || addCalendarDaysLocalIso(30);
    const rawCorreo = (data.correo || '').trim();
    const useEmailAsContactName =
      !!rawCorreo &&
      !rawCorreo.toLowerCase().endsWith('@temp.local') &&
      rawCorreo.includes('@');
    const contactDisplayName = useEmailAsContactName
      ? rawCorreo
      : data.nombreComercial.trim();
    let contactId: string | undefined;
    let contactApiError: string | null = null;
    if (rawCorreo) {
      try {
        const contactBody: Record<string, unknown> = {
          name: contactDisplayName,
          telefono: (data.telefono || '').trim(),
          correo: rawCorreo,
          fuente: (data.origenLead || 'base') as ContactSource,
          etapa: data.etapa,
          estimatedValue: monto,
          companyId: created.id,
          clienteRecuperado: data.clienteRecuperado,
        };
        if (assignedTo && isLikelyContactCuid(assignedTo)) {
          contactBody.assignedTo = assignedTo;
        }
        const createdContact = await contactCreate(contactBody);
        contactId = createdContact.id;
      } catch (e) {
        contactApiError =
          e instanceof Error
            ? e.message
            : 'No se pudo crear el contacto en el servidor';
      }
    }

    let opportunityApiError: string | null = null;
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: oppTitle,
          amount: monto,
          etapa: data.etapa,
          fuente: data.origenLead,
          expectedCloseDate,
          companyId: created.id,
          ...(contactId ? { contactId } : {}),
          priority: 'media',
          ...(assignedTo && isLikelyContactCuid(assignedTo) ? { assignedTo } : {}),
        }),
      });
    } catch (e) {
      opportunityApiError =
        e instanceof Error
          ? e.message
          : 'No se pudo crear la oportunidad en el servidor';
    }

    await loadSummary();

    if (!opportunityApiError && !contactApiError) {
      const suffix = contactId
        ? `con contacto y oportunidad "${oppTitle}"`
        : `con oportunidad "${oppTitle}" (sin contacto: indica un correo para crearlo)`;
      toast.success(`Empresa "${data.nombreComercial}" creada ${suffix}`);
    } else if (!opportunityApiError && contactApiError) {
      toast.warning(
        `Empresa y oportunidad "${oppTitle}" creadas. No se pudo crear el contacto: ${contactApiError}`,
      );
    } else if (opportunityApiError && !contactApiError) {
      const saved = contactId ? 'Empresa y contacto guardados.' : 'Empresa guardada.';
      toast.warning(`${saved} ${opportunityApiError} (la oportunidad quedó pendiente).`);
    } else {
      toast.warning(
        `Empresa guardada. No se pudo crear el contacto (${contactApiError}). ${opportunityApiError} (la oportunidad quedó pendiente).`,
      );
    }
  }

  function openCompanyDetail(emp: EmpresaSummaryRow) {
    navigate(empresaDetailPath(emp));
  }

  function openCompanyPreview(emp: EmpresaSummaryRow) {
    setPreviewEmpresa(emp);
  }

  function openCompanyEdit(emp: EmpresaSummaryRow) {
    if (!hasPermission('empresas.editar')) {
      toast.error('No tienes permiso para editar empresas');
      return;
    }
    setEditEmpresa(emp);
  }

  function requestDeleteCompany(emp: EmpresaSummaryRow) {
    if (!hasPermission('empresas.eliminar')) {
      toast.error('No tienes permiso para eliminar empresas');
      return;
    }
    setEmpresaToDelete(emp);
    setDeleteDialogOpen(true);
  }

  async function handleSaveCompanyFromList(payload: CompanyEditSavePayload) {
    if (!editEmpresa) return;
    try {
      if (editEmpresa.isLocalOnly) {
        updateCompany(editEmpresa.id, {
          name: payload.name,
          domain: payload.domain || undefined,
          rubro: (payload.rubro || undefined) as CompanyRubro | undefined,
          tipo: (payload.tipo || undefined) as CompanyTipo | undefined,
        });
        await loadSummary();
        toast.success('Empresa actualizada correctamente');
        return;
      }
      await api<ApiCompanyRecord>(`/companies/${editEmpresa.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          domain: payload.domain?.trim() || undefined,
          telefono: payload.telefono.trim() || undefined,
          rubro: payload.rubro || undefined,
          tipo: payload.tipo || undefined,
        }),
      });
      await loadSummary();
      toast.success('Empresa actualizada correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      throw e;
    }
  }

  async function handleConfirmDeleteEmpresa() {
    if (!empresaToDelete) return;
    try {
      if (empresaToDelete.isLocalOnly) {
        deleteCompany(empresaToDelete.id);
        await loadSummary();
        toast.success('Empresa eliminada correctamente');
        return;
      }
      if (!isLikelyCompanyCuid(empresaToDelete.id)) {
        toast.error('Solo se pueden eliminar empresas guardadas en el servidor');
        return;
      }
      await api(`/companies/${empresaToDelete.id}`, { method: 'DELETE' });
      await loadSummary();
      toast.success('Empresa eliminada correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setEmpresaToDelete(null);
    }
  }

  const startIndex = total === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, total);
  const localExtraOnPage =
    page === 1 && filtersDefault
      ? standaloneCompanies.filter(
          (c) =>
            !summaryRows.some(
              (r) =>
                r.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
            ),
        ).length
      : 0;

  async function handleCompanyTemplate() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('companies', 'template');
      toast.success('Plantilla descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar la plantilla');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleCompanyExport() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('companies', 'export');
      toast.success('Exportación descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportBusy(false);
    }
  }

  function openCompanyImport() {
    importInputRef.current?.click();
  }

  function closeImportPreview() {
    setImportPreviewOpen(false);
    setImportPreviewData(null);
    setPendingImportFile(null);
  }

  async function onCompanyImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportPreviewInProgress(true);
    setImportBusy(true);
    try {
      const preview = await previewCompaniesImportCsv(file);
      setImportPreviewData(preview);
      setPendingImportFile(file);
      setImportPreviewOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al generar vista previa',
      );
    } finally {
      setImportPreviewInProgress(false);
      setImportBusy(false);
    }
  }

  async function confirmCompanyImport() {
    const file = pendingImportFile;
    const preview = importPreviewData;
    if (
      !file ||
      !preview ||
      preview.okCount === 0 ||
      preview.errorCount > 0
    ) {
      closeImportPreview();
      return;
    }
    closeImportPreview();
    setImportBusy(true);
    try {
      const job = await startImportJob('companies', file);
      enqueueImportJob(job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ImportInProgressDialog
        open={importPreviewInProgress}
        title="Generando vista previa"
        description="Puede tardar unos segundos si el archivo tiene muchas filas."
        footerNote=""
      />
      <Dialog
        open={importPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closeImportPreview();
        }}
      >
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Vista previa · importar empresas</DialogTitle>
            <DialogDescription className="text-left">
              {importPreviewData ? (
                <>
                  <span className="block">
                    {importPreviewData.okCount} fila(s) lista(s) ·{' '}
                    {importPreviewData.errorCount} con error
                    {importPreviewData.skipped
                      ? ` · ${importPreviewData.skipped} vacía(s) omitida(s)`
                      : ''}
                    . Los datos SUNAT/RENIEC/CEE se consultan al confirmar la importación, no en esta vista.
                  </span>
                  {importPreviewData.errorCount > 0 ? (
                    <span className="mt-2 block text-destructive">
                      Corrige el archivo y vuelve a elegirlo. No se importará nada mientras haya
                      errores en la vista previa.
                    </span>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
            {importPreviewData && importPreviewData.rows.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table
                  containerClassName="overflow-visible"
                  className="w-max min-w-full text-sm"
                >
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-20 w-12 min-w-12 whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]">
                        Fila
                      </TableHead>
                      <TableHead
                        className={cn(
                          'sticky z-20 w-[5.5rem] min-w-[5.5rem] whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]',
                          'left-12',
                        )}
                      >
                        Estado
                      </TableHead>
                      {companyImportPreviewCsvKeys.map((key) => (
                        <TableHead
                          key={key}
                          className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-bottom font-normal text-muted-foreground"
                        >
                          <span className="block truncate" title={key}>
                            {key}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="w-[14rem] min-w-[14rem] max-w-[14rem] align-bottom">
                        Motivo / detalle
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreviewData.rows
                      .slice()
                      .sort((a, b) => a.row - b.row)
                      .map((row) => (
                        <TableRow key={row.row}>
                          <TableCell
                            className={cn(
                              'sticky left-0 z-10 bg-background px-2 align-top tabular-nums text-muted-foreground shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]',
                            )}
                          >
                            {row.row}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'sticky left-12 z-10 bg-background px-2 align-top shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]',
                            )}
                          >
                            {row.ok ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 font-normal text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              >
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="font-normal">
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          {companyImportPreviewCsvKeys.map((key) => (
                            <TableCell
                              key={`${row.row}-${key}`}
                              className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-top text-xs"
                            >
                              {importPreviewCell(row.csvColumns?.[key])}
                            </TableCell>
                          ))}
                          <TableCell className="w-[14rem] min-w-[14rem] max-w-[14rem] align-top text-muted-foreground">
                            <span
                              className="block truncate"
                              title={row.ok ? undefined : row.error}
                            >
                              {row.ok
                                ? importPreviewCell(undefined)
                                : (row.error ?? '—')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : importPreviewData ? (
              <p className="text-sm text-muted-foreground">No hay filas que mostrar.</p>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={closeImportPreview}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !importPreviewData ||
                importPreviewData.okCount === 0 ||
                importPreviewData.errorCount > 0
              }
              onClick={() => void confirmCompanyImport()}
            >
              Importar {importPreviewData ? `(${importPreviewData.okCount})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_SPREADSHEET_ACCEPT}
        className="hidden"
        onChange={onCompanyImportChange}
      />
      <PageHeader
        title="Empresas"
        description="Gestiona empresas y cuentas comerciales"
      >
        <span className="mr-2 text-sm text-muted-foreground">Total: {total}</span>
        {hasPermission('empresas.exportar') && (
          <Button
            variant="outline"
            disabled={exportBusy}
            title="Sin id: RUC enriquece con SUNAT; columnas contacto_* y etapa como en contactos; oportunidad al vincular contacto."
            onClick={() => void handleCompanyTemplate()}
          >
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{' '}
            Plantilla
          </Button>
        )}
        {hasPermission('empresas.crear') && (
          <Button
            variant="outline"
            disabled={importBusy}
            title="Por fila: empresa (reutiliza si nombre/RUC existe), contacto opcional con DNI/CEE Factiliza, misma lógica de etapa que contactos."
            onClick={openCompanyImport}
          >
            {importBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{' '}
            Importar
          </Button>
        )}
        {hasPermission('empresas.exportar') && (
          <Button
            variant="outline"
            disabled={exportBusy}
            onClick={() => void handleCompanyExport()}
          >
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{' '}
            Exportar
          </Button>
        )}
        <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => setNewEmpresaOpen(true)}>
          <Plus className="size-4" /> Nueva Empresa
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-[580px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa o contacto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto">
              <div className="flex items-center gap-3">
                <Globe className="size-3.5" />
                <SelectValue placeholder="Fuente" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Fuentes</SelectItem>
              {Object.entries(contactSourceLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={etapaFilter} onValueChange={(v) => { setEtapaFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto">
              <div className="flex items-center gap-3">
                <Tag className="size-3.5" />
                <SelectValue placeholder="Etapa" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Etapas</SelectItem>
              {Object.entries(etapaLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rubroFilter} onValueChange={(v) => { setRubroFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto">
              <div className="flex items-center gap-3">
                <MapPin className="size-3.5" />
                <SelectValue placeholder="Rubro" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Rubros</SelectItem>
              {Object.entries(companyRubroLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto">
              <div className="flex items-center gap-3">
                <Building2 className="size-3.5" />
                <SelectValue placeholder="Tipo" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Tipos</SelectItem>
              {Object.entries(companyTipoLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={advisorFilter}
            onValueChange={(v) => { setAdvisorFilter(v); setPage(1); }}
            disabled={!canSeeAllAdvisors}
          >
            <SelectTrigger className="w-auto">
              <div className="flex items-center gap-3">
                <User className="size-3.5" />
                <SelectValue placeholder="Asesor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Asesores</SelectItem>
              {activeAdvisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center rounded-md border">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('cards')}
              className="rounded-l-none"
            >
              <Grid3X3 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          viewMode === 'table' ? (
            <CrmDataTableSkeleton
              columns={[...EMPRESAS_TABLE_SKELETON_COLUMNS]}
              rows={10}
              aria-label="Cargando empresas"
            />
          ) : (
            <CrmEntityCardGridSkeleton count={8} aria-label="Cargando empresas" />
          )
        ) : displayRows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No se encontraron empresas"
            description="Intenta ajustar los filtros o crea una nueva empresa."
            actionLabel="Nueva empresa"
            onAction={() => setNewEmpresaOpen(true)}
          />
        ) : viewMode === 'table' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Etapa</TableHead>
                  <TableHead className="hidden lg:table-cell">Fuente</TableHead>
                  <TableHead className="hidden md:table-cell">Rubro</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden lg:table-cell">Recuperado</TableHead>
                  <TableHead className="hidden xl:table-cell">Asesor</TableHead>
                  <TableHead>Creación</TableHead>
                  <TableHead className="text-center">Contactos</TableHead>
                  <TableHead>Última interacción</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((emp) => {
                  const rubro = parseRubroFromApi(emp.rubro);
                  const tipo = parseTipoFromApi(emp.tipo);
                  const rowKey = emp.isLocalOnly ? `local-${emp.id}` : emp.id;
                  return (
                  <TableRow
                    key={rowKey}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openCompanyDetail(emp)}
                  >
<TableCell>
                      <div className="min-w-0 flex items-center gap-2 max-w-[220px]">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Building2 className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{emp.name}</p>
                          {emp.domain && (
                            <a
                              href={emp.domain.startsWith('http') ? emp.domain : `https://${emp.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {emp.domain}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge status={emp.displayEtapa as Etapa} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {sourceLabelFromApi(emp.displayFuente)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {rubro ? companyRubroLabels[rubro] : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {tipo ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {emp.clienteRecuperado === 'si' ? 'Recuperado' : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {emp.displayAdvisorName ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(emp.createdAt).toLocaleDateString('es-PE')}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center">
                        <EmpresaContactsPopover
                          contactCount={emp.contactCount}
                          preview={emp.contactsPreview}
                          variant="table"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {emp.lastInteractionAt
                        ? new Date(emp.lastInteractionAt).toLocaleDateString('es-PE')
                        : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openCompanyPreview(emp)}>
                            <Eye /> Vista previa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openCompanyEdit(emp)}
                            disabled={!hasPermission('empresas.editar')}
                          >
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => requestDeleteCompany(emp)}
                            disabled={!hasPermission('empresas.eliminar')}
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRows.map((emp) => {
              const rubro = parseRubroFromApi(emp.rubro);
              const tipo = parseTipoFromApi(emp.tipo);
              const rowKey = emp.isLocalOnly ? `local-${emp.id}` : emp.id;
              return (
              <Card
                key={rowKey}
                className="cursor-pointer gap-0 py-0 transition-shadow hover:shadow-md"
                onClick={() => openCompanyDetail(emp)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{emp.name}</h3>
                      {emp.domain && (
                        <p className="text-xs text-muted-foreground truncate">{emp.domain}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-xs" aria-label="Acciones">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompanyPreview(emp);
                          }}
                        >
                          <Eye /> Vista previa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompanyEdit(emp);
                          }}
                          disabled={!hasPermission('empresas.editar')}
                        >
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteCompany(emp);
                          }}
                          disabled={!hasPermission('empresas.eliminar')}
                        >
                          <Trash2 /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatusBadge status={emp.displayEtapa as Etapa} />
                    {rubro && (
                      <Badge variant="outline" className="text-xs">{companyRubroLabels[rubro]}</Badge>
                    )}
                    {tipo && (
                      <Badge variant="outline" className="text-xs">Tipo {tipo}</Badge>
                    )}
                    {emp.clienteRecuperado === 'si' && (
                      <Badge variant="secondary" className="text-xs">Recuperado</Badge>
                    )}
                  </div>

                  <div
                    className="mt-3 text-sm text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EmpresaContactsPopover
                      contactCount={emp.contactCount}
                      preview={emp.contactsPreview}
                      variant="card"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span>Creación: {new Date(emp.createdAt).toLocaleDateString('es-PE')}</span>
                      <span>
                        Última interact.: {emp.lastInteractionAt
                          ? new Date(emp.lastInteractionAt).toLocaleDateString('es-PE')
                          : '—'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {emp.displayAdvisorName ?? '—'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && (total > 0 || displayRows.length > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `Mostrando ${startIndex}-${endIndex} de ${total} en servidor`
              : `${displayRows.length} empresa${displayRows.length !== 1 ? 's' : ''} (solo en dispositivo)`}
            {localExtraOnPage > 0 && total > 0
              ? ` · +${localExtraOnPage} local${localExtraOnPage !== 1 ? 'es' : ''}`
              : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <NewCompanyWizard
        open={newEmpresaOpen}
        onOpenChange={setNewEmpresaOpen}
        onSubmit={handleNewEmpresaSubmit}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setEmpresaToDelete(null);
        }}
        title="Eliminar empresa"
        description={
          empresaToDelete
            ? `¿EStás seguro que deseas eliminar esta empresa? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => void handleConfirmDeleteEmpresa()}
        variant="destructive"
      />

      <CompanyPreviewSheet
        row={previewEmpresa}
        open={previewEmpresa !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewEmpresa(null);
        }}
        onOpenFullDetail={() => {
          const e = previewEmpresa;
          setPreviewEmpresa(null);
          if (e) openCompanyDetail(e);
        }}
        onEdit={() => {
          const e = previewEmpresa;
          setPreviewEmpresa(null);
          if (e) openCompanyEdit(e);
        }}
      />

      <CompanyEditDialog
        row={editEmpresa}
        open={editEmpresa !== null}
        onOpenChange={(open) => {
          if (!open) setEditEmpresa(null);
        }}
        onSave={handleSaveCompanyFromList}
      />
    </div>
  );
}
