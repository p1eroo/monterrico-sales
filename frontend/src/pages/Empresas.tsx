import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, Building2, Users, ChevronRight, ChevronLeft, Briefcase,
  FileSpreadsheet, Upload, Download, Plus, List, Grid3X3, DollarSign, Loader2,
} from 'lucide-react';
import type { Etapa, CompanyRubro, CompanyTipo, Company, ContactSource } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useCompaniesStore } from '@/store/companiesStore';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';

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
import { formatCurrency } from '@/lib/formatters';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  downloadImportExportCsv,
  previewCompaniesImportCsv,
  uploadImportCsv,
  type CompanyImportPreviewResult,
} from '@/lib/importExportApi';
import {
  type ApiCompanyRecord,
  type CompanySummaryRow,
  companyListSummaryPaginated,
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

const etapaOrder: Etapa[] = ['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'];

const etapaTabs: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...etapaOrder.map((e) => ({ value: e, label: etapaLabels[e] })),
];

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

const ITEMS_PER_PAGE = 25;

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { companies: standaloneCompanies } = useCompaniesStore();

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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [newEmpresaOpen, setNewEmpresaOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] =
    useState<CompanyImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(
    null,
  );
  const [exportBusy, setExportBusy] = useState(false);
  const { users, activeUsers } = useUsers();
  const { hasPermission } = usePermissions();

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

  const filtersDefault =
    !searchDebounced &&
    sourceFilter === 'todos' &&
    etapaFilter === 'todos' &&
    rubroFilter === 'todos' &&
    tipoFilter === 'todos' &&
    advisorFilter === 'todos';

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

  async function handleNewEmpresaSubmit(data: NewCompanyData) {
    const monto = Number(data.facturacion);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('La facturación estimada debe ser mayor que 0');
      return;
    }
    if (!data.origenLead) {
      toast.error('Selecciona la fuente del lead');
      return;
    }

    const assignedTo = data.propietario?.trim() || activeUsers[0]?.id || '';

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
      toast.error(
        e instanceof Error ? e.message : 'No se pudo guardar la empresa en el servidor',
      );
      return;
    }
    const oppTitle =
      data.nombreNegocio.trim() || data.nombreComercial.trim() || 'Sin título';
    const expectedCloseDate =
      data.fechaCierre.trim() ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let contactId: string | undefined;
    try {
      const contactBody: Record<string, unknown> = {
        name: data.nombreComercial.trim(),
        telefono: (data.telefono || '').trim() || '000000000',
        correo: (data.correo || '').trim() || `lead-${created.id}@temp.local`,
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
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear el contacto en el servidor',
      );
      return;
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
          contactId,
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

    if (!opportunityApiError) {
      toast.success(`Empresa "${data.nombreComercial}" creada con contacto y oportunidad "${oppTitle}"`);
    } else {
      toast.warning(
        `Empresa y contacto guardados. ${opportunityApiError} (la oportunidad quedó pendiente).`,
      );
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
      setImportBusy(false);
    }
  }

  async function confirmCompanyImport() {
    const file = pendingImportFile;
    if (
      !file ||
      !importPreviewData ||
      importPreviewData.okCount === 0 ||
      importPreviewData.errorCount > 0
    ) {
      closeImportPreview();
      return;
    }
    closeImportPreview();
    setImportBusy(true);
    try {
      const r = await uploadImportCsv('companies', file);
      const errMsg =
        r.errors.length > 0
          ? r.errors
              .slice(0, 5)
              .map((x) => `Fila ${x.row}: ${x.message}`)
              .join('\n') + (r.errors.length > 5 ? `\n…y ${r.errors.length - 5} más` : '')
          : undefined;
      if (r.created === 0 && r.errors.length > 0) {
        toast.error('No se importó ninguna fila', { description: errMsg });
      } else {
        toast.success(
          `Importación: ${r.created} fila(s) procesada(s) correctamente${
            r.skipped ? ` · ${r.skipped} vacía(s) omitidas` : ''
          }`,
          errMsg ? { description: errMsg } : undefined,
        );
      }
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
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
                      Corrige el CSV y vuelve a elegir el archivo. No se importará nada mientras haya
                      errores en la vista previa.
                    </span>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
            {importPreviewData && importPreviewData.rows.length > 0 ? (
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-11">Fila</TableHead>
                    <TableHead className="w-[4.5rem]">Estado</TableHead>
                    <TableHead className="w-[14%]">Empresa</TableHead>
                    <TableHead className="w-[8%]">RUC</TableHead>
                    <TableHead className="w-[14%]">Resumen</TableHead>
                    <TableHead className="w-[14%]">Contacto</TableHead>
                    <TableHead className="w-[9%]">Etapa</TableHead>
                    <TableHead className="w-[9%] text-right">Fact. est.</TableHead>
                    <TableHead className="min-w-[18%]">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreviewData.rows
                    .slice()
                    .sort((a, b) => a.row - b.row)
                    .map((row) => (
                      <TableRow key={row.row}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {row.row}
                        </TableCell>
                        <TableCell>
                          {row.ok ? (
                            <Badge variant="secondary" className="font-normal">
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="font-normal">
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="break-words text-sm align-top">
                          {row.empresaNombre || '—'}
                        </TableCell>
                        <TableCell className="break-all text-xs align-top text-muted-foreground">
                          {row.empresaRuc || '—'}
                        </TableCell>
                        <TableCell className="break-words text-xs align-top text-muted-foreground">
                          {row.empresaResumen}
                        </TableCell>
                        <TableCell className="break-words text-sm align-top">
                          {row.contactoVista || '—'}
                        </TableCell>
                        <TableCell className="text-sm align-top">{row.etapa}</TableCell>
                        <TableCell className="text-right text-sm align-top tabular-nums">
                          {formatCurrency(row.facturacionEstimada)}
                        </TableCell>
                        <TableCell className="break-words text-sm align-top text-muted-foreground">
                          {row.ok ? '—' : row.error ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
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
        accept=".csv,text/csv"
        className="hidden"
        onChange={onCompanyImportChange}
      />
      <PageHeader
        title="Empresas"
        description="Gestiona empresas y cuentas comerciales"
      >
        {hasPermission('empresas.exportar') && (
          <Button
            variant="outline"
            size="sm"
            disabled={exportBusy}
            title="CSV sin id: RUC enriquece con SUNAT; columnas contacto_* y etapa como en contactos; oportunidad al vincular contacto."
            onClick={() => void handleCompanyTemplate()}
          >
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{' '}
            Plantilla
          </Button>
        )}
        {hasPermission('empresas.crear') && (
          <Button
            variant="outline"
            size="sm"
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
            size="sm"
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

      {/* Stats (conteos por etapa solo en servidor filtrado; aquí filtros como en Contactos) */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={etapaFilter === 'todos' ? 'secondary' : 'outline'}
          className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          onClick={() => { setEtapaFilter('todos'); setPage(1); }}
        >
          <Briefcase className="size-3.5" /> Total: {total}
        </Badge>
        {etapaTabs.slice(1).map((tab) => (
          <Badge
            key={tab.value}
            variant={etapaFilter === tab.value ? 'secondary' : 'outline'}
            className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            onClick={() => { setEtapaFilter(tab.value); setPage(1); }}
          >
            {tab.label}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las fuentes</SelectItem>
              {Object.entries(contactSourceLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={etapaFilter} onValueChange={(v) => { setEtapaFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las etapas</SelectItem>
              {Object.entries(etapaLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rubroFilter} onValueChange={(v) => { setRubroFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rubro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los rubros</SelectItem>
              {Object.entries(companyRubroLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(companyTipoLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={advisorFilter} onValueChange={(v) => { setAdvisorFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Asesor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los asesores</SelectItem>
              {users.map((u) => (
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
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Cargando empresas...
          </div>
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
                  <TableHead className="hidden lg:table-cell">Cliente Recuperado</TableHead>
                  <TableHead className="hidden xl:table-cell">Asesor</TableHead>
                  <TableHead className="text-center">Contactos</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
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
                    onClick={() => navigate(empresaDetailPath(emp))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Building2 className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          {emp.domain && (
                            <a
                              href={emp.domain.startsWith('http') ? emp.domain : `https://${emp.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
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
                      {emp.clienteRecuperado === 'si' ? 'Sí' : emp.clienteRecuperado === 'no' ? 'No' : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {emp.displayAdvisorName ?? '—'}
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
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(emp.totalEstimatedValue)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm">
                        <ChevronRight className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRows.map((emp) => {
              const rubro = parseRubroFromApi(emp.rubro);
              const tipo = parseTipoFromApi(emp.tipo);
              const rowKey = emp.isLocalOnly ? `local-${emp.id}` : emp.id;
              return (
              <Card
                key={rowKey}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(empresaDetailPath(emp))}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{emp.name}</h3>
                      {emp.domain && (
                        <p className="text-xs text-muted-foreground truncate">{emp.domain}</p>
                      )}
                    </div>
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
                      <Badge variant="secondary" className="text-xs">Cliente Recuperado</Badge>
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
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                      <DollarSign className="size-3.5" />
                      {formatCurrency(emp.totalEstimatedValue)}
                    </span>
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
    </div>
  );
}
