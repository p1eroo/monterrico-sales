'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
} from '@/components/ui/form-dialog';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import { ComercialInclusiveMultiFilter } from '@/components/shared/ComercialInclusiveMultiFilter';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { etapaLabels } from '@/data/mock';
import { contactListPaginated, type ApiContactListRow } from '@/lib/contactApi';
import {
  CIUDAD_OPTIONS,
  flotaProspectosCounts,
  flotaProspectosList,
  type FlotaProspectoRow,
} from '@/lib/flotaProspectosApi';
import {
  comercialTableCheckboxWrapClass,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
} from '@/lib/comercialTableLayout';
import {
  comercialFilterIconClass,
  INCLUSIVE_MULTI_NONE,
  isInclusiveMultiFilterNone,
} from '@/lib/comercialFilterSurface';
import {
  crmTableBodyRowClass,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import {
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from './whatsappAudienceExcel';
import type { WhatsAppContact } from './mockData';

export type CrmAudienceSource = 'flota' | 'comercial';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const COMERCIAL_COL_WIDTHS = {
  nombre: 280,
  telefono: 140,
  etapa: 150,
} as const;

const FLOTA_COL_WIDTHS = {
  nombre: 240,
  celular: 140,
  ciudad: 120,
  contacto: 150,
} as const;

function inclusiveMultiToApiParam(selected: string[]): string | undefined {
  if (isInclusiveMultiFilterNone(selected)) return INCLUSIVE_MULTI_NONE;
  if (selected.length === 0) return undefined;
  return selected.join(',');
}

function buildFlotaCiudadFilters(ciudadFilter: string[]): Record<string, string> | undefined {
  if (isInclusiveMultiFilterNone(ciudadFilter)) {
    return { ciudad: INCLUSIVE_MULTI_NONE };
  }
  if (ciudadFilter.length === 0) return undefined;
  return { ciudad: ciudadFilter.join(',') };
}

function flotaRowToContact(row: FlotaProspectoRow): WhatsAppContact | null {
  const name = (row.nombreCompleto ?? '').trim();
  const phone = normalizeWhatsAppPhone(row.celular ?? row.movil ?? '');
  if (!name || !phone) return null;
  return {
    id: row.id,
    name,
    phone,
    city: row.ciudad?.trim() || undefined,
    source: 'crm',
    hasWhatsApp: true,
  };
}

function comercialRowToContact(row: ApiContactListRow): WhatsAppContact | null {
  const name = (row.name ?? '').trim();
  const phone = normalizeWhatsAppPhone(row.telefono ?? '');
  if (!name || !phone) return null;
  return {
    id: row.id,
    name,
    phone,
    source: 'crm',
    hasWhatsApp: true,
  };
}

function ContactoBadge({ contactado }: { contactado?: boolean }) {
  return contactado ? (
    <Badge
      variant="ghost"
      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      Contactado
    </Badge>
  ) : (
    <Badge
      variant="ghost"
      className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
    >
      Sin contactar
    </Badge>
  );
}

export function CrmAudienceImportDialog({
  source,
  onOpenChange,
  onImport,
}: {
  source: CrmAudienceSource | null;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: WhatsAppContact[], fileName: string) => void;
}) {
  const isFlota = source === 'flota';
  const label = isFlota ? 'prospecto' : 'contacto';
  const fileName = isFlota ? 'Flota' : 'Comercial';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [contactadoFilter, setContactadoFilter] = useState<string[]>([]);
  const [ciudadFilter, setCiudadFilter] = useState<string[]>([]);
  const [etapaFilter, setEtapaFilter] = useState<string[]>([]);
  const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
  const [flotaRows, setFlotaRows] = useState<FlotaProspectoRow[]>([]);
  const [comercialRows, setComercialRows] = useState<ApiContactListRow[]>([]);
  const [selectedById, setSelectedById] = useState<Map<string, WhatsAppContact>>(new Map());
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [importingAll, setImportingAll] = useState(false);

  const listQueryParams = useMemo(() => {
    if (isFlota) {
      return {
        search: debouncedSearch || undefined,
        estado: inclusiveMultiToApiParam(estadoFilter),
        contactado: inclusiveMultiToApiParam(contactadoFilter),
        filters: buildFlotaCiudadFilters(ciudadFilter),
      };
    }
    return {
      search: debouncedSearch || undefined,
      etapa: etapaFilter.length > 0 ? etapaFilter.join(',') : undefined,
    };
  }, [
    isFlota,
    debouncedSearch,
    estadoFilter,
    contactadoFilter,
    ciudadFilter,
    etapaFilter,
  ]);

  useEffect(() => {
    setSelectAllMode(false);
    setSelectedById(new Map());
  }, [listQueryParams, source]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, estadoFilter, contactadoFilter, ciudadFilter, etapaFilter, pageSize, source]);

  useEffect(() => {
    if (!isFlota) return;
    flotaProspectosCounts()
      .then((counts) => {
        setEstadoOptions(Object.keys(counts.estadoCounts ?? {}).sort());
      })
      .catch(() => {});
  }, [isFlota]);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (isFlota) {
          const res = await flotaProspectosList({
            page,
            limit: pageSize,
            ...listQueryParams,
          });
          if (cancelled) return;
          setFlotaRows(res.data);
          setTotal(res.total);
        } else {
          const res = await contactListPaginated({
            page,
            limit: pageSize,
            ...listQueryParams,
          });
          if (cancelled) return;
          setComercialRows(res.data);
          setTotal(res.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `No se pudieron cargar los ${label}s`);
          setFlotaRows([]);
          setComercialRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    source,
    isFlota,
    label,
    page,
    pageSize,
    listQueryParams,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageContacts = useMemo(() => {
    if (isFlota) {
      return flotaRows.map((row) => ({ row, contact: flotaRowToContact(row) }));
    }
    return comercialRows.map((row) => ({ row, contact: comercialRowToContact(row) }));
  }, [isFlota, flotaRows, comercialRows]);


  const selectedCount = selectAllMode ? total : selectedById.size;

  const fetchAllMatchingContacts = useCallback(async (): Promise<WhatsAppContact[]> => {
    const limit = 100;
    const contacts: WhatsAppContact[] = [];
    let pageNum = 1;
    let totalPages = 1;

    while (pageNum <= totalPages) {
      if (isFlota) {
        const res = await flotaProspectosList({
          ...listQueryParams,
          page: pageNum,
          limit,
        });
        totalPages = Math.max(1, Math.ceil(res.total / limit));
        for (const row of res.data) {
          const contact = flotaRowToContact(row);
          if (contact) contacts.push(contact);
        }
      } else {
        const res = await contactListPaginated({
          ...listQueryParams,
          page: pageNum,
          limit,
        });
        totalPages = Math.max(1, Math.ceil(res.total / limit));
        for (const row of res.data) {
          const contact = comercialRowToContact(row);
          if (contact) contacts.push(contact);
        }
      }
      pageNum += 1;
    }

    return contacts;
  }, [isFlota, listQueryParams]);

  const toggleRow = useCallback((contact: WhatsAppContact | null) => {
    if (selectAllMode) return;
    if (!contact) {
      toast.error('Este registro no tiene nombre o celular válido.');
      return;
    }
    setSelectedById((prev) => {
      const next = new Map(prev);
      if (next.has(contact.id)) next.delete(contact.id);
      else next.set(contact.id, contact);
      return next;
    });
  }, [selectAllMode]);

  const toggleSelectAll = useCallback(() => {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelectedById(new Map());
      return;
    }
    setSelectAllMode(true);
    setSelectedById(new Map());
  }, [selectAllMode]);

  const clearSelection = useCallback(() => {
    setSelectAllMode(false);
    setSelectedById(new Map());
  }, []);

  const close = () => onOpenChange(false);

  const handleAdd = async () => {
    if (selectedCount === 0) {
      toast.error('Selecciona al menos un registro para añadir.');
      return;
    }

    if (selectAllMode) {
      setImportingAll(true);
      const toastId = toast.loading(`Cargando ${label}s del filtro…`);
      try {
        const selected = await fetchAllMatchingContacts();
        if (selected.length === 0) {
          toast.error('No hay registros válidos con nombre y celular.', { id: toastId });
          return;
        }
        onImport(selected, fileName);
        toast.success(`${selected.length} ${label}${selected.length === 1 ? '' : 's'} añadido(s)`, {
          id: toastId,
        });
        close();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `No se pudieron cargar los ${label}s`,
          { id: toastId },
        );
      } finally {
        setImportingAll(false);
      }
      return;
    }

    const selected = Array.from(selectedById.values());
    onImport(selected, fileName);
    toast.success(`${selected.length} ${label}${selected.length === 1 ? '' : 's'} añadido(s)`);
    close();
  };

  const etapaFilterOptions = useMemo(
    () => Object.entries(etapaLabels).map(([value, text]) => ({ value, label: text })),
    [],
  );

  const estadoFilterOptions = useMemo(
    () => estadoOptions.map((est) => ({ value: est, label: est })),
    [estadoOptions],
  );

  const ciudadFilterOptions = useMemo(
    () => CIUDAD_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const contactadoFilterOptions = useMemo(
    () => [
      { value: 'true', label: 'Contactado' },
      { value: 'false', label: 'Sin contactar' },
    ],
    [],
  );

  return (
    <FormDialogShell
      open={Boolean(source)}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      maxWidthClassName="sm:max-w-[min(97vw,92rem)]"
      contentClassName="!max-h-[min(92vh,880px)]"
      title={`Importar ${label}s · ${fileName}`}
      description={
        <>
          Selecciona filas de la tabla. Los filtros aplican sobre el listado del CRM (paginado).
          {selectedCount > 0 ? (
            <span className="mt-1 block font-medium text-foreground">
              {selectAllMode
                ? `Todos los ${total} ${label}${total === 1 ? '' : 's'} del filtro seleccionados`
                : `${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'}`}
            </span>
          ) : null}
        </>
      }
      bodyClassName="mt-4 flex min-h-0 flex-col pb-0"
      footer={(
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            La selección se mantiene al cambiar de página. Al confirmar, reemplaza la audiencia actual.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectedCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={clearSelection}
                disabled={importingAll}
              >
                Limpiar selección
              </Button>
            ) : null}
            <Button type="button" variant="outline" className={formDialogBtnOutlineClass} onClick={close} disabled={importingAll}>
              Cancelar
            </Button>
            <Button
              type="button"
              className={formDialogBtnPrimaryClass}
              disabled={loading || importingAll || selectedCount === 0}
              onClick={() => void handleAdd()}
            >
              {importingAll ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cargando…
                </>
              ) : (
                <>
                  Añadir {selectedCount} {label}
                  {selectedCount === 1 ? '' : 's'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    >
      <GlassCard className="flex min-h-[min(60vh,520px)] flex-col">
        {loading && flotaRows.length === 0 && comercialRows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando {label}s…</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <p className="text-sm font-medium">No se pudo cargar la tabla</p>
            <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative w-full min-w-0 max-w-[400px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
                <Input
                  type="search"
                  placeholder={isFlota ? 'Buscar nombre o celular…' : 'Buscar contacto…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
                />
              </div>
              {isFlota ? (
                <>
                  <ComercialInclusiveMultiFilter
                    placeholder="Estado"
                    countLabel="estados"
                    value={estadoFilter}
                    onChange={setEstadoFilter}
                    options={estadoFilterOptions}
                    embedInFormDialog
                  />
                  <ComercialInclusiveMultiFilter
                    placeholder="Ciudad"
                    countLabel="ciudades"
                    value={ciudadFilter}
                    onChange={setCiudadFilter}
                    options={ciudadFilterOptions}
                    embedInFormDialog
                  />
                  <ComercialInclusiveMultiFilter
                    placeholder="Contacto"
                    countLabel="opciones"
                    value={contactadoFilter}
                    onChange={setContactadoFilter}
                    options={contactadoFilterOptions}
                    embedInFormDialog
                  />
                </>
              ) : (
                <ComercialInclusiveMultiFilter
                  placeholder="Etapa"
                  countLabel="etapas"
                  value={etapaFilter}
                  onChange={setEtapaFilter}
                  options={etapaFilterOptions}
                  icon={<ChartSquareIcon className={comercialFilterIconClass} />}
                  embedInFormDialog
                />
              )}
              <span className="text-xs text-muted-foreground lg:ml-auto">
                {loading ? 'Actualizando…' : `${total} ${label}${total === 1 ? '' : 's'} en total`}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto border-t border-border/40 scrollbar-thin max-h-[min(52vh,480px)]">
              <table
                className="w-full table-fixed"
                style={{
                  minWidth: isFlota
                    ? 44 + FLOTA_COL_WIDTHS.nombre + FLOTA_COL_WIDTHS.celular + FLOTA_COL_WIDTHS.ciudad + FLOTA_COL_WIDTHS.contacto
                    : 44 + COMERCIAL_COL_WIDTHS.nombre + COMERCIAL_COL_WIDTHS.telefono + COMERCIAL_COL_WIDTHS.etapa,
                }}
              >
                <colgroup>
                  <col />
                  {isFlota ? (
                    <>
                      <col style={{ width: FLOTA_COL_WIDTHS.nombre }} />
                      <col style={{ width: FLOTA_COL_WIDTHS.celular }} />
                      <col style={{ width: FLOTA_COL_WIDTHS.ciudad }} />
                      <col style={{ width: FLOTA_COL_WIDTHS.contacto }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: COMERCIAL_COL_WIDTHS.nombre }} />
                      <col style={{ width: COMERCIAL_COL_WIDTHS.telefono }} />
                      <col style={{ width: COMERCIAL_COL_WIDTHS.etapa }} />
                    </>
                  )}
                </colgroup>
                <thead>
                  <tr className={cn('sticky top-0 z-10 h-[36px] text-left', crmTableHeaderRowClass)}>
                    <th className={comercialTableLeadingCellClass('select')}>
                      <div className={comercialTableCheckboxWrapClass}>
                        <Checkbox
                          checked={selectAllMode}
                          onCheckedChange={toggleSelectAll}
                          disabled={total === 0 || importingAll}
                          className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                      </div>
                    </th>
                    <th
                      className={comercialTableLeadingCellClass('nombre', { primaryColumnId: 'nombre' })}
                      style={comercialTableCellStyle('nombre', isFlota ? FLOTA_COL_WIDTHS.nombre : COMERCIAL_COL_WIDTHS.nombre)}
                    >
                      Nombre
                    </th>
                    <th
                      className={comercialTableLeadingCellClass(isFlota ? 'celular' : 'telefono')}
                      style={comercialTableCellStyle(
                        isFlota ? 'celular' : 'telefono',
                        isFlota ? FLOTA_COL_WIDTHS.celular : COMERCIAL_COL_WIDTHS.telefono,
                      )}
                    >
                      {isFlota ? 'Celular' : 'Teléfono'}
                    </th>
                    {isFlota ? (
                      <>
                        <th
                          className={comercialTableLeadingCellClass('ciudad')}
                          style={comercialTableCellStyle('ciudad', FLOTA_COL_WIDTHS.ciudad)}
                        >
                          Ciudad
                        </th>
                        <th
                          className={comercialTableLeadingCellClass('contacto')}
                          style={comercialTableCellStyle('contacto', FLOTA_COL_WIDTHS.contacto)}
                        >
                          Contacto
                        </th>
                      </>
                    ) : (
                      <th
                        className={comercialTableLeadingCellClass('etapa')}
                        style={comercialTableCellStyle('etapa', COMERCIAL_COL_WIDTHS.etapa)}
                      >
                        Etapa
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageContacts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isFlota ? 5 : 4}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        No hay registros con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    pageContacts.map(({ row, contact }) => {
                      const checked = selectAllMode || (contact ? selectedById.has(contact.id) : false);
                      const invalid = !contact;
                      if (isFlota) {
                        const p = row as FlotaProspectoRow;
                        return (
                          <tr
                            key={p.id}
                            className={cn(
                              'h-[48px] last:border-b-0',
                              crmTableBodyRowClass,
                              invalid && 'opacity-50',
                              checked && 'bg-primary/5',
                            )}
                          >
                            <td
                              className={comercialTableLeadingCellClass('select')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={comercialTableCheckboxWrapClass}>
                                <Checkbox
                                  checked={checked}
                                  disabled={invalid || selectAllMode || importingAll}
                                  onCheckedChange={() => toggleRow(contact)}
                                  className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                                />
                              </div>
                            </td>
                            <td
                              className={comercialTableLeadingCellClass('nombre', { primaryColumnId: 'nombre' })}
                              style={comercialTableCellStyle('nombre', FLOTA_COL_WIDTHS.nombre)}
                            >
                              <span
                                className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
                                title={p.nombreCompleto || undefined}
                              >
                                {p.nombreCompleto || '—'}
                              </span>
                            </td>
                            <td
                              className={comercialTableLeadingCellClass('celular')}
                              style={comercialTableCellStyle('celular', FLOTA_COL_WIDTHS.celular)}
                            >
                              <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400">
                                {formatWhatsAppPhoneDisplay(
                                  normalizeWhatsAppPhone(p.celular ?? p.movil) ??
                                    p.celular ??
                                    p.movil,
                                )}
                              </span>
                            </td>
                            <td
                              className={comercialTableLeadingCellClass('ciudad')}
                              style={comercialTableCellStyle('ciudad', FLOTA_COL_WIDTHS.ciudad)}
                            >
                              <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400">
                                {p.ciudad?.trim() || '—'}
                              </span>
                            </td>
                            <td
                              className={comercialTableLeadingCellClass('contacto')}
                              style={comercialTableCellStyle('contacto', FLOTA_COL_WIDTHS.contacto)}
                            >
                              <ContactoBadge contactado={p.contactado} />
                            </td>
                          </tr>
                        );
                      }
                      const c = row as ApiContactListRow;
                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            'h-[48px] last:border-b-0',
                            crmTableBodyRowClass,
                            invalid && 'opacity-50',
                            checked && 'bg-primary/5',
                          )}
                        >
                          <td
                            className={comercialTableLeadingCellClass('select')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className={comercialTableCheckboxWrapClass}>
                              <Checkbox
                                checked={checked}
                                disabled={invalid || selectAllMode || importingAll}
                                onCheckedChange={() => toggleRow(contact)}
                                className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                              />
                            </div>
                          </td>
                          <td
                            className={comercialTableLeadingCellClass('nombre', { primaryColumnId: 'nombre' })}
                            style={comercialTableCellStyle('nombre', COMERCIAL_COL_WIDTHS.nombre)}
                          >
                            <span
                              className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
                              title={c.name || undefined}
                            >
                              {c.name || '—'}
                            </span>
                          </td>
                          <td
                            className={comercialTableLeadingCellClass('telefono')}
                            style={comercialTableCellStyle('telefono', COMERCIAL_COL_WIDTHS.telefono)}
                          >
                            <span
                              className="block truncate text-[13px] text-[#475569] dark:text-gray-400"
                              title={c.telefono || undefined}
                            >
                              {formatWhatsAppPhoneDisplay(
                                normalizeWhatsAppPhone(c.telefono) ?? c.telefono,
                              )}
                            </span>
                          </td>
                          <td
                            className={comercialTableLeadingCellClass('etapa')}
                            style={comercialTableCellStyle('etapa', COMERCIAL_COL_WIDTHS.etapa)}
                          >
                            {c.etapa ? <StatusBadge status={c.etapa} /> : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={cn('flex h-14 shrink-0 items-center px-5', crmTableFooterClass)}>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </div>
          </>
        )}
      </GlassCard>
    </FormDialogShell>
  );
}
