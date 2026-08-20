import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { navigateOnAuxClick, navigateOnClick } from "@/lib/navigateOnClick";
import type { DateRange } from "react-day-picker";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from '@/lib/notify';
import { EyeSvgIcon } from "@/components/icons/EyeSvgIcon";
import { PencilFileSvgIcon } from "@/components/icons/PencilFileSvgIcon";
import { TrashSvgIcon } from "@/components/icons/TrashSvgIcon";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Phone,
  Mail,
  Building2,
  Users,
  Loader2,
} from "lucide-react";
import { UsersGroupRoundedSvgIcon } from "@/components/icons/UsersGroupRoundedSvgIcon";
import { ChartSquareIcon } from "@/components/icons/ChartSquareIcon";
import { PaletteIcon } from "@/components/icons/PaletteIcon";
import { contactSourceLabels, etapaLabels } from "@/data/mock";
import { useCrmConfigStore, getSourceLabelFromCatalog, useLeadSourceOptions } from "@/store/crmConfigStore";
import { useAppStore } from "@/store";
import { canBulkReassignCommercialModule, canPickOtherCommercialAdvisor } from "@/data/rbac";
import {
  NewContactWizard,
  type NewContactData,
} from "@/components/shared/NewContactWizard";
import { isLikelyOpportunityCuid } from "@/lib/opportunityApi";
import { getPrimaryCompany } from "@/lib/utils";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  ContactEditDialog,
  type ContactEditSavePayload,
} from "@/components/shared/ContactEditDialog";
import { ContactPreviewSheet } from "@/components/shared/ContactPreviewSheet";
import { MultiAdvisorFilter } from "@/components/shared/MultiAdvisorFilter";
import { MultiCheckboxFilterActions } from "@/components/shared/MultiCheckboxFilterActions";
import { useMultiAdvisorFilter } from "@/hooks/useMultiAdvisorFilter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BatchReassignAdvisorDialog } from "@/components/shared/BatchReassignAdvisorDialog";
import { GhostTableSkeleton } from "@/components/shared/GhostTableSkeleton";
import { GlassCard } from "@/components/shared/GlassCard";
import { ImportInProgressDialog } from "@/components/shared/ImportInProgressDialog";
import { Pagination } from "@/components/shared/Pagination";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuTriggerButton,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ComercialTableColgroup } from "@/components/shared/ComercialTableColgroup";
import {
  comercialTableActionsColumnSizing,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
  comercialTableCheckboxWrapClass,
} from "@/lib/comercialTableLayout";
import { formatDateShort } from "@/lib/formatters";
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  comercialProCommandClass,
  dateRangeToQueryBounds,
  isInclusiveMultiFilterSelected,
  toggleInclusiveMultiFilter,
  formatInclusiveMultiFilterLabel,
  isInclusiveMultiFilterNone,
  isInclusiveMultiFilterAll,
  INCLUSIVE_MULTI_NONE,
  inclusiveMultiSourceFilterToApiParam,
  formatInclusiveMultiSourceFilterLabel,
} from "@/lib/comercialFilterSurface";
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from "@/lib/crmTableSurface";
import { api } from "@/lib/api";
import { contactDetailHref } from "@/lib/detailRoutes";
import type { Contact } from "@/types";
import { companyListAll } from "@/lib/companyApi";
import { newCompanyDataToPatchBody } from "@/lib/companyWizardMap";
import {
  type ApiContactDetail,
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactListPaginated,
  contactListEtapaCounts,
  bulkDeleteContacts,
  bulkReassignContacts,
  primaryCompanyIdFromApiContact,
  apiContactDetailToListRow,
} from "@/lib/contactApi";
import { buildOptimisticContact } from "@/lib/optimisticEntities";
import {
  generateOptimisticId,
  useOptimisticCrmStore,
} from "@/store/optimisticCrmStore";
import { usePermissions } from "@/hooks/usePermissions";
import {
  downloadImportExportCsv,
  previewContactsImportCsv,
  startImportJob,
  type ContactImportPreviewResult,
} from "@/lib/importExportApi";
import { IMPORT_SPREADSHEET_ACCEPT } from "@/lib/importSpreadsheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImportJobsStore } from "@/store/importJobsStore";
import {
  CrmEntityCardGridSkeleton,
} from "@/components/shared/CrmListPageSkeleton";
import { FileNewSvgIcon } from "@/components/icons/FileNewSvgIcon";
import { ImportSvgIcon } from "@/components/icons/ImportSvgIcon";
import { ExportSvgIcon } from "@/components/icons/ExportSvgIcon";
import { ColumnsSvgIcon } from "@/components/icons/ColumnsSvgIcon";
import { FilterSvgIcon } from "@/components/icons/FilterSvgIcon";
import { DateRangeFilterButton } from "@/components/ui/date-range-filter-button";

const DEFAULT_ITEMS_PER_PAGE = 25;

/** Tras crear un contacto, vincula oportunidades existentes por PATCH (mismo criterio que detalle de oportunidad). */
async function linkNewContactToOpportunities(
  contactId: string,
  opportunityIds: string[] | undefined,
): Promise<{ linked: number; hadError: boolean }> {
  const unique = [...new Set(opportunityIds ?? [])].filter((id) =>
    isLikelyOpportunityCuid(id),
  );
  if (unique.length === 0) return { linked: 0, hadError: false };
  let linked = 0;
  let hadError = false;
  for (const oppId of unique) {
    try {
      await api(`/opportunities/${oppId}`, {
        method: "PATCH",
        body: JSON.stringify({ contactId }),
      });
      linked += 1;
    } catch {
      hadError = true;
    }
  }
  return { linked, hadError };
}

const CONTACTOS_TABLE_SKELETON_COLUMNS = [
  { label: "", className: "w-10", skeletonCell: "checkbox" as const },
  { label: "", className: "w-10" },
  { label: "Nombre", className: "min-w-0 max-w-[20rem]" },
  { label: "Empresa", className: "hidden min-w-0 max-w-[16rem] md:table-cell" },
  { label: "Teléfono", className: "hidden lg:table-cell" },
  { label: "Email", className: "hidden min-w-0 max-w-[14rem] xl:table-cell" },
  { label: "Fuente", className: "hidden lg:table-cell" },
  { label: "Recuperado", className: "hidden lg:table-cell" },
  { label: "Etapa" },
  { label: "Asesor", className: "hidden xl:table-cell" },
  { label: "Creación", className: "hidden md:table-cell" },
];

function importPreviewCell(v: string | undefined) {
  const t = (v ?? "").trim();
  if (!t) return "—";
  return (
    <span className="block truncate" title={t}>
      {t}
    </span>
  );
}

export default function ContactosPage() {
  const navigate = useNavigate();
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    queryParams: advisorListParams,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();
  const { hasPermission } = usePermissions();
  const canEditAssignee = canPickOtherCommercialAdvisor(hasPermission);
  const canReassignAdvisor = canBulkReassignCommercialModule(hasPermission, "contactos");
  const pendingContacts = useOptimisticCrmStore((s) => s.pendingContacts);
  const addPendingContact = useOptimisticCrmStore((s) => s.addPendingContact);
  const removePendingContact = useOptimisticCrmStore(
    (s) => s.removePendingContact,
  );
  const isPendingContactId = useOptimisticCrmStore((s) => s.isPendingContactId);
  const [apiRows, setApiRows] = useState<ApiContactListRow[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const bundle = useCrmConfigStore((s) => s.bundle);
  const leadSourceOptions = useLeadSourceOptions();

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [etapaFilter, setEtapaFilter] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    empresa: true,
    telefono: true,
    correo: true,
    fuente: true,
    clienteRecuperado: true,
    etapa: true,
    asesor: true,
    fecha: true,
    ultimaInteraccion: true,
  });
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [interactionRange, setInteractionRange] = useState<DateRange | undefined>();
  const [creationRange, setCreationRange] = useState<DateRange | undefined>();
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768)
      return "cards";
    return "table";
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchReassignDialogOpen, setBatchReassignDialogOpen] = useState(false);
  const [batchReassigning, setBatchReassigning] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreviewInProgress, setImportPreviewInProgress] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] =
    useState<ContactImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [etapaTabCounts, setEtapaTabCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const enqueueImportJob = useImportJobsStore((s) => s.enqueueJob);
  const contactImportCompletionTick = useImportJobsStore(
    (s) => s.completionTickByEntity.contacts,
  );

  const contactImportPreviewCsvKeys = useMemo(() => {
    const withCols = importPreviewData?.rows.find(
      (r) => r.csvColumns && Object.keys(r.csvColumns).length > 0,
    );
    return withCols ? Object.keys(withCols.csvColumns) : [];
  }, [importPreviewData]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const listFilterParams = useMemo(() => {
    const { from: interactionFromIso, to: interactionToIso } =
      dateRangeToQueryBounds(interactionRange);
    const { from: createdFromIso, to: createdToIso } =
      dateRangeToQueryBounds(creationRange);
    return {
      search: searchDebounced || undefined,
      etapa: etapaFilter.length > 0 ? etapaFilter.join(',') : undefined,
      fuente: inclusiveMultiSourceFilterToApiParam(sourceFilter),
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      lastInteractionFrom: interactionFromIso,
      lastInteractionTo: interactionToIso,
      createdFrom: createdFromIso,
      createdTo: createdToIso,
    };
  }, [
    searchDebounced,
    etapaFilter,
    sourceFilter,
    advisorListParams,
    interactionRange,
    creationRange,
  ]);

  useEffect(() => {
    setSelectedContacts([]);
    setSelectAllMode(false);
  }, [listFilterParams]);

  const loadApiContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactListPaginated({
        page,
        limit: pageSize,
        ...listFilterParams,
      });
      setApiRows(res.data);
      setTotalContacts(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setApiRows([]);
      setTotalContacts(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, listFilterParams]);

  useEffect(() => {
    void loadApiContacts();
  }, [loadApiContacts]);

  const loadEtapaTabCounts = useCallback(async () => {
    try {
      const { counts } = await contactListEtapaCounts(listFilterParams);
      setEtapaTabCounts(counts);
    } catch {
      setEtapaTabCounts({});
    }
  }, [listFilterParams]);

  useEffect(() => {
    void loadEtapaTabCounts();
  }, [loadEtapaTabCounts]);

  useEffect(() => {
    if (!contactImportCompletionTick) return;
    void loadApiContacts();
    void loadEtapaTabCounts();
  }, [contactImportCompletionTick, loadApiContacts, loadEtapaTabCounts]);

  const paginatedContacts = useMemo(
    () => apiRows.map(mapApiContactRowToContact),
    [apiRows],
  );

  const displayedContacts = useMemo(() => {
    const apiIds = new Set(paginatedContacts.map((c) => c.id));
    const pending = pendingContacts.filter((c) => !apiIds.has(c.id));
    return [...pending, ...paginatedContacts];
  }, [paginatedContacts, pendingContacts]);

  const effectiveEtapaTabCounts = useMemo((): Record<string, number> => {
    const base = etapaTabCounts ? { ...etapaTabCounts } : null;
    if (!base) return {};
    for (const p of pendingContacts) {
      const key = p.etapa;
      base[key] = (base[key] ?? 0) + 1;
    }
    return base;
  }, [etapaTabCounts, pendingContacts]);

  useEffect(() => {
    if (etapaTabCounts == null) return;
    if (etapaFilter.length === 0 || isInclusiveMultiFilterNone(etapaFilter)) return;
    const hasAnyResult = etapaFilter.some((e) => (effectiveEtapaTabCounts[e] ?? 0) > 0);
    if (hasAnyResult) return;
    setEtapaFilter([]);
    setPage(1);
  }, [etapaTabCounts, etapaFilter, effectiveEtapaTabCounts]);

  function openContactDetail(contact: Contact, event?: React.MouseEvent) {
    if (isPendingContactId(contact.id)) {
      toast.info("Guardando contacto…");
      return;
    }
    const path = contactDetailHref(contact);
    if (event) {
      navigateOnClick(event, path, navigate);
      return;
    }
    navigate(path);
  }

  function openContactPreview(contact: Contact) {
    setPreviewContact(contact);
  }

  function openContactEdit(contact: Contact) {
    if (isPendingContactId(contact.id)) {
      toast.info("Guardando contacto…");
      return;
    }
    if (!isLikelyContactCuid(contact.id)) {
      toast.error("Solo se pueden editar contactos guardados");
      return;
    }
    setEditContact(contact);
  }

  async function handleSaveContactFromList(payload: ContactEditSavePayload) {
    const targetContact = editContact;
    if (!targetContact) return;
    const contactId = targetContact.id;
    const prevRowIndex = apiRows.findIndex((r) => r.id === contactId);
    const prevRow = prevRowIndex >= 0 ? apiRows[prevRowIndex] : null;

    // Close modal and update optimistically
    setEditContact(null);
    if (prevRow) {
      const updatedRows = [...apiRows];
      updatedRows[prevRowIndex] = {
        ...prevRow,
        name: payload.name,
        cargo: payload.cargo || null,
        telefono: payload.telefono,
        correo: payload.correo,
        fuente: payload.fuente,
        ...(payload.assignedTo !== undefined && canEditAssignee
          ? { assignedTo: payload.assignedTo, user: { ...prevRow.user, id: payload.assignedTo, name: prevRow.user?.name ?? '' } }
          : {}),
      } as ApiContactListRow;
      setApiRows(updatedRows);
    }

    toast.loading('Guardando cambios…', { id: `save-${contactId}` });
    try {
      const body: Record<string, unknown> = {
        name: payload.name,
        cargo: payload.cargo || null,
        telefono: payload.telefono,
        correo: payload.correo,
        fuente: payload.fuente,
      };
      if (payload.assignedTo !== undefined && canEditAssignee) {
        if (!isLikelyContactCuid(payload.assignedTo)) {
          toast.error("El asesor seleccionado no es válido.", { id: `save-${contactId}` });
          if (prevRow && prevRowIndex >= 0) {
            const rollback = [...apiRows];
            rollback[prevRowIndex] = prevRow;
            setApiRows(rollback);
          }
          setEditContact(editContact);
          return;
        }
        body.assignedTo = payload.assignedTo;
      }
      const result = await api<ApiContactDetail>(`/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      // Reconcile with actual API response
      setApiRows((prev) => prev.map((r) => (r.id === contactId ? apiContactDetailToListRow(result) : r)));
      toast.success('Contacto actualizado', { id: `save-${contactId}` });
    } catch (e) {
      // Revert on error
      if (prevRow && prevRowIndex >= 0) {
        setApiRows((prev) => {
          const next = [...prev];
          next[prevRowIndex] = prevRow;
          return next;
        });
      }
      toast.error(e instanceof Error ? e.message : "No se pudo guardar", { id: `save-${contactId}` });
    }
  }
  const startIndex = totalContacts === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalContacts);

  const hasActiveFilters =
    etapaFilter.length > 0 ||
    sourceFilter.length > 0 ||
    advisorFilterIsActive ||
    search !== "" ||
    Boolean(interactionRange?.from || interactionRange?.to) ||
    Boolean(creationRange?.from || creationRange?.to);

  function clearFilters() {
    setSearch("");
    setEtapaFilter([]);
    setSourceFilter([]);
    setInteractionRange(undefined);
    setCreationRange(undefined);
    resetAdvisorFilter();
    setPage(1);
    setSelectedContacts([]);
    setSelectAllMode(false);
  }

  function toggleSelectAll() {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelectedContacts([]);
      return;
    }
    if (
      selectedContacts.length === displayedContacts.length &&
      displayedContacts.length > 0
    ) {
      setSelectedContacts([]);
      return;
    }
    setSelectedContacts(displayedContacts.map((l) => l.id));
  }

  function handleSelectAllMatchingFilter() {
    setSelectAllMode(true);
    setSelectedContacts(displayedContacts.map((l) => l.id));
  }

  function toggleSelectContact(id: string) {
    if (selectAllMode) return;
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  const selectedDeleteCount = selectAllMode ? totalContacts : selectedContacts.length;
  const allPageSelected =
    !selectAllMode &&
    displayedContacts.length > 0 &&
    selectedContacts.length === displayedContacts.length;

  async function handleBatchDelete() {
    if (selectedDeleteCount === 0) return;
    setBatchDeleting(true);
    toast.loading('Eliminando…', { id: 'batch-delete-contacts' });
    try {
      const result = await bulkDeleteContacts(
        selectAllMode
          ? { selectAll: true, ...listFilterParams }
          : {
              ids: selectedContacts.filter(
                (id) => !isPendingContactId(id) && isLikelyContactCuid(id),
              ),
            },
      );
      setBatchDeleteDialogOpen(false);
      setSelectedContacts([]);
      setSelectAllMode(false);
      await loadApiContacts();
      await loadEtapaTabCounts();
      toast.success(`${result.deleted} contacto(s) eliminado(s)`, {
        id: 'batch-delete-contacts',
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar',
        { id: 'batch-delete-contacts' },
      );
    } finally {
      setBatchDeleting(false);
    }
  }

  async function handleBatchReassign(newAssignedTo: string) {
    if (selectedDeleteCount === 0) return;
    setBatchReassigning(true);
    toast.loading('Reasignando…', { id: 'batch-reassign-contacts' });
    try {
      const result = await bulkReassignContacts(
        selectAllMode
          ? { selectAll: true, newAssignedTo, ...listFilterParams }
          : {
              newAssignedTo,
              ids: selectedContacts.filter(
                (id) => !isPendingContactId(id) && isLikelyContactCuid(id),
              ),
            },
      );
      setBatchReassignDialogOpen(false);
      setSelectedContacts([]);
      setSelectAllMode(false);
      await loadApiContacts();
      await loadEtapaTabCounts();
      toast.success(`${result.updated} contacto(s) reasignado(s)`, {
        id: 'batch-reassign-contacts',
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo reasignar',
        { id: 'batch-reassign-contacts' },
      );
    } finally {
      setBatchReassigning(false);
    }
  }

  async function handleDelete() {
    if (!contactToDelete) return;
    if (isPendingContactId(contactToDelete)) {
      toast.error("Espera a que termine de guardarse el contacto");
      setContactToDelete(null);
      return;
    }
    if (!isLikelyContactCuid(contactToDelete)) {
      toast.error("Solo se pueden eliminar contactos guardados");
      setContactToDelete(null);
      return;
    }
    try {
      toast.loading('Eliminando…', { id: 'delete-contact' });
      await api(`/contacts/${contactToDelete}`, { method: "DELETE" });
      await loadApiContacts();
      toast.success("Contacto eliminado correctamente", { id: 'delete-contact' });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar",
        { id: 'delete-contact' },
      );
    }
    setContactToDelete(null);
  }

  async function onSubmitNewContact(data: NewContactData) {
    const LOADING_ID = 'create-contact-list';
    if (!data.phone?.trim()) {
      toast.error("El teléfono es obligatorio", { id: LOADING_ID });
      return;
    }
    if (!data.email?.trim()) {
      toast.error("El correo es obligatorio", { id: LOADING_ID });
      return;
    }
    if (data.newCompanyWizardData) {
      const w = data.newCompanyWizardData;
      const existingCoId = data.newCompanyWizardUpdate?.companyId;

      if (existingCoId) {
        if (!w.origenLead) {
          toast.error("Selecciona la fuente del lead en el wizard de empresa", { id: LOADING_ID });
          return;
        }
        toast.loading('Guardando…', { id: LOADING_ID });
        try {
          await api(`/companies/${existingCoId}`, {
            method: "PATCH",
            body: JSON.stringify(newCompanyDataToPatchBody(w)),
          });
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "No se pudo actualizar la empresa",
          );
          return;
        }

        const body: Record<string, unknown> = {
          name: data.name.trim(),
          telefono: data.phone.trim(),
          correo: data.email.trim(),
          fuente: data.source,
          etapa: data.etapaCiclo,
          cargo: data.cargo?.trim() || undefined,
          departamento: data.departamento?.trim() || undefined,
          provincia: data.provincia?.trim() || undefined,
          distrito: data.distrito?.trim() || undefined,
          direccion: data.direccion?.trim() || undefined,
          clienteRecuperado: data.clienteRecuperado,
          companyId: existingCoId,
        };
        if (data.assignedTo && isLikelyContactCuid(data.assignedTo)) {
          body.assignedTo = data.assignedTo;
        }

        const optId = generateOptimisticId("c");
        addPendingContact(
          buildOptimisticContact(optId, data, {
            companyDisplayName: w.nombreComercial.trim(),
          }),
        );

        let linkedOpps = 0;
        let hadOppLinkError = false;
        try {
          const created = await api<ApiContactDetail>("/contacts", {
            method: "POST",
            body: JSON.stringify(body),
          });
          const r = await linkNewContactToOpportunities(
            created.id,
            data.selectedOpportunityIds,
          );
          linkedOpps = r.linked;
          hadOppLinkError = r.hadError;
        } catch (e) {
          removePendingContact(optId);
          toast.error(
            e instanceof Error
              ? e.message
              : "No se pudo crear el contacto",
          );
          return;
        }

        removePendingContact(optId);
        await loadApiContacts();
        let successMsg = `Contacto "${data.name}" creado · empresa "${w.nombreComercial.trim()}" actualizada`;
        if (linkedOpps > 0) {
          successMsg += ` · ${linkedOpps} oportunidad${linkedOpps > 1 ? "es" : ""} vinculada${linkedOpps > 1 ? "s" : ""}`;
          if (hadOppLinkError)
            successMsg += " (algunas oportunidades no se pudieron vincular)";
        }
        toast.success(successMsg);
        setNewContactOpen(false);
        return;
      }

      const factEmpresa = (() => {
        const f = Number(w.facturacion);
        if (Number.isFinite(f) && f > 0) return f;
        return 0;
      })();
      if (factEmpresa <= 0) {
        toast.error(
          "Indica facturación estimada de la empresa en el asistente (paso comercial u oportunidad).",
        );
        return;
      }
      if (!w.origenLead) {
        toast.error("Selecciona la fuente del lead en el wizard de empresa");
        return;
      }

      const newCompany = {
        name: w.nombreComercial.trim(),
        razonSocial: w.razonSocial.trim() || undefined,
        ruc: w.ruc.trim() || undefined,
        telefono: w.telefono.trim() || undefined,
        domain: w.dominio.trim() || undefined,
        rubro: w.rubro || undefined,
        tipo: w.tipoEmpresa || undefined,
        linkedin: w.linkedin.trim() || undefined,
        correo: w.contactoCorreo.trim() || w.correo.trim() || undefined,
        distrito: w.distrito.trim() || undefined,
        provincia: w.provincia.trim() || undefined,
        departamento: w.departamento.trim() || undefined,
        direccion: w.direccion.trim() || undefined,
        facturacionEstimada: factEmpresa,
        fuente: w.origenLead,
        clienteRecuperado: w.clienteRecuperado,
        etapa: w.etapa,
        ...(w.propietario && isLikelyContactCuid(w.propietario)
          ? { assignedTo: w.propietario }
          : {}),
      };

      const body: Record<string, unknown> = {
        name: data.name.trim(),
        telefono: data.phone.trim(),
        correo: data.email.trim(),
        fuente: data.source,
        etapa: data.etapaCiclo,
        cargo: data.cargo?.trim() || undefined,
        departamento: data.departamento?.trim() || undefined,
        provincia: data.provincia?.trim() || undefined,
        distrito: data.distrito?.trim() || undefined,
        direccion: data.direccion?.trim() || undefined,
        clienteRecuperado: data.clienteRecuperado,
        newCompany,
      };
      if (data.assignedTo && isLikelyContactCuid(data.assignedTo)) {
        body.assignedTo = data.assignedTo;
      }

      const optId = generateOptimisticId("c");
      addPendingContact(
        buildOptimisticContact(optId, data, {
          companyDisplayName: w.nombreComercial.trim(),
        }),
      );

      let contactId: string;
      let companyId: string | undefined;
      let linkedExistingOpps = 0;
      let hadExistingOppErr = false;
      try {
        const created = await api<ApiContactDetail>("/contacts", {
          method: "POST",
          body: JSON.stringify(body),
        });
        contactId = created.id;
        companyId = primaryCompanyIdFromApiContact(created);
        const r = await linkNewContactToOpportunities(
          contactId,
          data.selectedOpportunityIds,
        );
        linkedExistingOpps = r.linked;
        hadExistingOppErr = r.hadError;
      } catch (e) {
        removePendingContact(optId);
        toast.error(
          e instanceof Error
            ? e.message
            : "No se pudo crear el contacto",
        );
        return;
      }

      if (!companyId) {
        removePendingContact(optId);
        toast.error(
          "No se pudo obtener la empresa vinculada al contacto creado",
        );
        return;
      }

      if (w.nombreNegocio.trim()) {
        const monto = factEmpresa;
        const oppBody: Record<string, unknown> = {
          title: w.nombreNegocio.trim(),
          amount: monto,
          etapa: w.etapa,
          fuente: w.origenLead,
          status: "abierta",
          priority: "media",
          expectedCloseDate:
            w.fechaCierre.trim() ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          contactId,
          companyId,
        };
        if (w.propietario && isLikelyOpportunityCuid(w.propietario)) {
          oppBody.assignedTo = w.propietario;
        }
        try {
          await api("/opportunities", {
            method: "POST",
            body: JSON.stringify(oppBody),
          });
        } catch (e) {
          toast.error(
            e instanceof Error
              ? `${e.message} (contacto y empresa ya creados)`
              : "No se pudo crear la oportunidad; el contacto y la empresa ya están registrados",
          );
        }
      }

      removePendingContact(optId);
      await loadApiContacts();
      const msgParts = [
        `Contacto "${data.name}"`,
        `empresa "${w.nombreComercial.trim()}"`,
      ];
      if (w.nombreNegocio.trim())
        msgParts.push("oportunidad nueva desde el asistente");
      if (linkedExistingOpps > 0) {
        msgParts.push(
          `${linkedExistingOpps} oportunidad existente vinculada${hadExistingOppErr ? " (algunas no se pudieron vincular)" : ""}`,
        );
      }
      toast.success(`${msgParts.join(" · ")} — creados correctamente`);
      setNewContactOpen(false);
      return;
    }

    let companyId: string | undefined;
    if (data.companyId) {
      companyId = data.companyId;
    } else if (data.company.trim()) {
      try {
        const all = await companyListAll();
        const key = data.company.trim().toLowerCase();
        const found = all.find((c) => c.name.trim().toLowerCase() === key);
        if (found) {
          companyId = found.id;
        } else {
          toast.error(
            "No existe una empresa con ese nombre. Usa «Crear empresa» en el campo Empresa o elige una existente.",
          );
          return;
        }
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "No se pudo resolver la empresa",
        );
        return;
      }
    }

    const body: Record<string, unknown> = {
      name: data.name.trim(),
      telefono: data.phone.trim(),
      correo: data.email.trim(),
      fuente: data.source,
      etapa: data.etapaCiclo,
      cargo: data.cargo?.trim() || undefined,
      departamento: data.departamento?.trim() || undefined,
      provincia: data.provincia?.trim() || undefined,
      distrito: data.distrito?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
      clienteRecuperado: data.clienteRecuperado,
    };
    if (data.assignedTo && isLikelyContactCuid(data.assignedTo)) {
      body.assignedTo = data.assignedTo;
    }
    if (companyId) {
      body.companyId = companyId;
    }

    const optIdSimple = generateOptimisticId("c");
    addPendingContact(
      buildOptimisticContact(optIdSimple, data, {
        companyDisplayName: data.company.trim() || undefined,
      }),
    );

    let linkedListOpps = 0;
    let hadListOppErr = false;
    try {
      const created = await api<ApiContactDetail>("/contacts", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const r = await linkNewContactToOpportunities(
        created.id,
        data.selectedOpportunityIds,
      );
      linkedListOpps = r.linked;
      hadListOppErr = r.hadError;
    } catch (e) {
      removePendingContact(optIdSimple);
      toast.error(
        e instanceof Error
          ? e.message
          : "No se pudo crear el contacto",
      );
      return;
    }

    removePendingContact(optIdSimple);
    await loadApiContacts();
    let doneMsg = `Contacto "${data.name}" creado exitosamente`;
    if (linkedListOpps > 0) {
      doneMsg += ` · ${linkedListOpps} oportunidad${linkedListOpps > 1 ? "es" : ""} vinculada${linkedListOpps > 1 ? "s" : ""}`;
      if (hadListOppErr)
        doneMsg += " (algunas oportunidades no se pudieron vincular)";
    }
    toast.success(doneMsg);
    setNewContactOpen(false);
  }

  async function handleContactTemplate() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv("contacts", "template");
      toast.success("Plantilla descargada");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo descargar la plantilla",
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleContactExport() {
    try {
      setExportBusy(true);
      const params: Record<string, string> = {};
      if (searchDebounced) params.search = searchDebounced;
      if (etapaFilter.length > 0) params.etapa = etapaFilter.join(',');
      const fuenteParam = inclusiveMultiSourceFilterToApiParam(sourceFilter);
      if (fuenteParam) params.fuente = fuenteParam;
      if (advisorListParams.assignedTo) params.assignedTo = advisorListParams.assignedTo;
      if (advisorListParams.excludeAssignedTo) {
        params.excludeAssignedTo = advisorListParams.excludeAssignedTo;
      }
      if (advisorListParams.advisorPool) params.advisorPool = advisorListParams.advisorPool;
      const { from: interactionFromIso, to: interactionToIso } =
        dateRangeToQueryBounds(interactionRange);
      const { from: createdFromIso, to: createdToIso } =
        dateRangeToQueryBounds(creationRange);
      if (interactionFromIso) params.lastInteractionFrom = interactionFromIso;
      if (interactionToIso) params.lastInteractionTo = interactionToIso;
      if (createdFromIso) params.createdFrom = createdFromIso;
      if (createdToIso) params.createdTo = createdToIso;
      // Mapear columnas visibles de la tabla a nombres de columnas CSV
      const tableToCsv: Record<string, string[]> = {
        nombre: ["nombre"],
        empresa: ["empresa_nombre", "empresa_ruc"],
        telefono: ["telefono_1"],
        correo: ["correo"],
        fuente: ["fuente"],
        clienteRecuperado: ["cliente_recuperado"],
        etapa: ["etapa"],
        asesor: ["asignado_a"],
        ultimaInteraccion: ["ultima_interaccion"],
      };
      // Columnas siempre visibles (no están en columnVisibility porque no se pueden ocultar)
      const alwaysVisible = ["nombre", "cargo"];
      const csvColumns = [
        ...alwaysVisible.flatMap((key) => tableToCsv[key] || [key]),
        ...Object.entries(columnVisibility)
          .filter(([, visible]) => visible)
          .flatMap(([key]) => tableToCsv[key] || []),
      ];
      if (csvColumns.length > 0) params.columns = csvColumns.join(",");
      await downloadImportExportCsv("contacts", "export", params);
      toast.success("Exportación descargada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportBusy(false);
    }
  }

  function openContactImport() {
    importInputRef.current?.click();
  }

  async function onContactImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportPreviewInProgress(true);
    setImportBusy(true);
    try {
      const preview = await previewContactsImportCsv(file);
      setImportPreviewData(preview);
      setPendingImportFile(file);
      setImportPreviewOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al generar vista previa",
      );
    } finally {
      setImportPreviewInProgress(false);
      setImportBusy(false);
    }
  }

  function closeImportPreview() {
    setImportPreviewOpen(false);
    setImportPreviewData(null);
    setPendingImportFile(null);
  }

  async function confirmContactImport() {
    const file = pendingImportFile;
    const preview = importPreviewData;
    if (!file || !preview) {
      closeImportPreview();
      return;
    }
    closeImportPreview();
    setImportBusy(true);
    try {
      const job = await startImportJob("contacts", file);
      enqueueImportJob(job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div>
      <ImportInProgressDialog
        open={importPreviewInProgress}
        title="Generando vista previa"
        description="El sistema está leyendo el archivo Excel (.xlsx), convirtiendo la primera hoja y validando filas contra la base de datos. Las consultas externas solo ocurren al confirmar la importación."
        rowHint="Puede tardar unos segundos si el archivo tiene muchas filas."
      />
      <Dialog
        open={importPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closeImportPreview();
        }}
      >
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Vista previa de importación</DialogTitle>
            <DialogDescription className="text-left">
              {importPreviewData ? (
                <>
                  <span className="block">
                    {importPreviewData.okCount} fila(s) lista(s) ·{" "}
                    {importPreviewData.errorCount} con error
                    {importPreviewData.skipped
                      ? ` · ${importPreviewData.skipped} vacía(s) omitida(s)`
                      : ""}
                    . Teléfono, correo y fuente pueden ir en blanco. En Empresa
                    se muestra el RUC si viene en el archivo; si no, el nombre.
                  </span>
                  {importPreviewData.errorCount > 0 ? (
                    <span className="mt-2 block text-muted-foreground">
                      Las filas con error se omitirán durante la importación.
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
                  className="w-full min-w-max table-fixed"
                >
        <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 w-11 bg-background px-2">
                        Fila
                      </TableHead>
                      <TableHead className="sticky left-12 z-10 w-20 bg-background px-2">
                        Estado
                      </TableHead>
                      {contactImportPreviewCsvKeys.map((key) => (
                        <TableHead
                          key={key}
                          className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-bottom"
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
                              "sticky left-0 z-10 bg-background px-2 align-top tabular-nums text-muted-foreground shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]",
                            )}
                          >
                            {row.row}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "sticky left-12 z-10 bg-background px-2 align-top shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]",
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
                              <Badge
                                variant="destructive"
                                className="font-normal"
                              >
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          {contactImportPreviewCsvKeys.map((key) => (
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
                                : (row.error ?? "—")}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              importPreviewData && (
                <p className="text-sm text-muted-foreground">
                  No hay filas que mostrar.
                </p>
              )
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeImportPreview}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!importPreviewData}
              onClick={() => void confirmContactImport()}
            >
              Importar{" "}
              {importPreviewData ? `(${importPreviewData.okCount}/${importPreviewData.totalRows})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_SPREADSHEET_ACCEPT}
        className="hidden"
        onChange={onContactImportChange}
      />
      <PageHeader
        title="Contactos"
        description="Gestiona y da seguimiento a tus prospectos de venta"
        className="mb-4"
      >
        <Button onClick={() => setNewContactOpen(true)} className="h-9 w-[110px] text-sm font-normal shadow-md">
          <Plus /> Nuevo
        </Button>
      </PageHeader>

      {selectedDeleteCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {selectAllMode ? (
              <span className="text-sm font-medium">
                Todos los {totalContacts} contactos del filtro están seleccionados
              </span>
            ) : (
              <span className="text-sm font-medium">
                {selectedContacts.length} de {totalContacts} seleccionados
              </span>
            )}
            {allPageSelected && totalContacts > displayedContacts.length && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 text-xs"
                onClick={handleSelectAllMatchingFilter}
              >
                Seleccionar los {totalContacts} contactos del filtro
              </Button>
            )}
            {selectAllMode && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-1 text-xs"
                onClick={() => {
                  setSelectAllMode(false);
                  setSelectedContacts([]);
                }}
              >
                Deseleccionar todo
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canReassignAdvisor && (
              <Button
                size="sm"
                className="h-9 bg-blue-600 text-sm font-normal text-white shadow-md hover:bg-blue-700"
                onClick={() => setBatchReassignDialogOpen(true)}
                disabled={batchReassigning || batchDeleting}
              >
                {batchReassigning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UsersGroupRoundedSvgIcon className="size-4" />
                )}{" "}
                Reasignar ({selectedDeleteCount})
              </Button>
            )}
            {hasPermission("contactos.eliminar") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteDialogOpen(true)}
                disabled={batchDeleting || batchReassigning}
              >
                {batchDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}{" "}
                Eliminar ({selectedDeleteCount})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter bar + Table + Pagination en una sola tarjeta */}
      <GlassCard>
        {/* Filter bar */}
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
        <div className="relative w-full min-w-0 max-w-[400px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
          <Input
            placeholder="Buscar por nombre, empresa, email o teléfono..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`!h-10 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left ${etapaFilter.length > 0 ? "text-black dark:text-gray-100" : "text-[#8a9aab] dark:text-gray-400"}`}>
              <ChartSquareIcon className={comercialFilterIconClass} />
              <span className="truncate flex-1">
                {formatInclusiveMultiFilterLabel(
                  etapaFilter,
                  "Etapa",
                  (k) => etapaLabels[k] || k,
                  "etapas",
                )}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className={cn(comercialProPopoverClass, "w-[220px] p-1.5")} align="start" sideOffset={8}>
            <Command className={comercialProCommandClass}>
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandGroup>
                  {Object.entries(etapaLabels).map(([key, label]) => {
                    const selected = isInclusiveMultiFilterSelected(etapaFilter, key);
                    return (
                      <CommandItem
                        key={key}
                        onSelect={() => {
                          setEtapaFilter((prev) =>
                            toggleInclusiveMultiFilter(
                              prev,
                              key,
                              Object.keys(etapaLabels),
                            ),
                          );
                          setPage(1);
                        }}
                      >
                        <span className="[&_svg]:!text-primary-foreground">
                        <Checkbox
                          checked={selected}
                          className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                        />
                        </span>
                        <span>{label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              <MultiCheckboxFilterActions
                allSelected={isInclusiveMultiFilterAll(etapaFilter)}
                noneSelected={isInclusiveMultiFilterNone(etapaFilter)}
                onSelectAll={() => {
                  setEtapaFilter([]);
                  setPage(1);
                }}
                onClear={() => {
                  setEtapaFilter([INCLUSIVE_MULTI_NONE]);
                  setPage(1);
                }}
              />
            </Command>
          </PopoverContent>
        </Popover>

        <DateRangeFilterButton
          value={interactionRange}
          onChange={(range) => {
            setInteractionRange(range);
            setPage(1);
          }}
          placeholder="Última interacción"
        />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <div className="ml-auto hidden sm:flex items-center gap-5">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                  <ColumnsSvgIcon className="size-[18px]" />
                  Columnas
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="end" sideOffset={8}>
                <Command className={comercialProCommandClass}>
                  <CommandList>
                    <CommandGroup>
                      {[
                        { id: "empresa", label: "Empresa" },
                        { id: "telefono", label: "Teléfono" },
                        { id: "correo", label: "Email" },
                        { id: "fuente", label: "Fuente" },
                        { id: "clienteRecuperado", label: "Recuperado" },
                        { id: "etapa", label: "Etapa" },
                        { id: "asesor", label: "Asesor" },
                        { id: "fecha", label: "Creación" },
                        { id: "ultimaInteraccion", label: "U. Interacción" },
                      ].map((col) => {
                        const visible = columnVisibility[col.id] ?? true;
                        return (
                          <div
                            key={col.id}
                            onClick={() => setColumnVisibility((prev) => ({ ...prev, [col.id]: !visible }))}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
                          >
                            <Checkbox
                              checked={visible}
                              className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                            />
                            <span className="text-[#1f2933] dark:text-gray-100">{col.label}</span>
                          </div>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                  <FilterSvgIcon className="size-[18px]" />
                  Filtros
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn(comercialProPopoverClass, "w-[min(100vw-2rem,500px)] p-3")} align="end" sideOffset={8}>
                <div className="flex items-center gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={`!h-10 flex-1 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer text-left truncate flex items-center gap-1.5 ${sourceFilter.length > 0 ? "text-black dark:text-gray-100" : "text-[#8a9aab] dark:text-gray-400"}`}>
                        <PaletteIcon className={comercialFilterIconClass} />
                        <span className="truncate flex-1">
                          {formatInclusiveMultiSourceFilterLabel(
                            sourceFilter,
                            "Fuente",
                            (k) =>
                              getSourceLabelFromCatalog(
                                k,
                                bundle,
                                contactSourceLabels,
                              ),
                          )}
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="start" sideOffset={8}>
                      <Command className={comercialProCommandClass}>
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          <CommandGroup>
                            {leadSourceOptions.map(({ value: key, label }) => {
                              const selected = isInclusiveMultiFilterSelected(
                                sourceFilter,
                                key,
                              );
                              return (
                                <CommandItem
                                  key={key}
                                  onSelect={() => {
                                    setSourceFilter((prev) =>
                                      toggleInclusiveMultiFilter(
                                        prev,
                                        key,
                                        leadSourceOptions.map((o) => o.value),
                                      ),
                                    );
                                    setPage(1);
                                  }}
                                >
                                  <span className="[&_svg]:!text-primary-foreground">
                                  <Checkbox
                                    checked={selected}
                                    className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                                  />
                                  </span>
                                  <span>{label}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                        <MultiCheckboxFilterActions
                          allSelected={isInclusiveMultiFilterAll(sourceFilter)}
                          noneSelected={isInclusiveMultiFilterNone(sourceFilter)}
                          onSelectAll={() => {
                            setSourceFilter([]);
                            setPage(1);
                          }}
                          onClear={() => {
                            setSourceFilter([INCLUSIVE_MULTI_NONE]);
                            setPage(1);
                          }}
                        />
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <MultiAdvisorFilter
                    value={advisorFilter}
                    onChange={setAdvisorFilter}
                    advisors={activeAdvisors}
                    disabled={!canSeeAllAdvisors}
                    isActive={advisorFilterIsActive}
                    isInitialized={advisorFilterInitialized}
                    className="!h-10 flex-1"
                    onInteraction={() => setPage(1)}
                  />
                  <DateRangeFilterButton
                    value={creationRange}
                    onChange={(range) => {
                      setCreationRange(range);
                      setPage(1);
                    }}
                    placeholder="Creación"
                    className="min-w-0 w-auto flex-1"
                  />
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                  <MoreVertical className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {hasPermission("contactos.exportar") && (
                  <DropdownMenuItem
                    disabled={exportBusy}
                    onClick={() => void handleContactTemplate()}
                  >
                    {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileNewSvgIcon className="size-[18px]" />}
                    Plantilla
                  </DropdownMenuItem>
                )}
                {hasPermission("contactos.crear") && (
                  <DropdownMenuItem
                    disabled={importBusy}
                    onClick={openContactImport}
                  >
                    {importBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ImportSvgIcon className="size-[18px]" />}
                    Importar
                  </DropdownMenuItem>
                )}
                {hasPermission("contactos.exportar") && (
                  <DropdownMenuItem
                    disabled={exportBusy}
                    onClick={() => void handleContactExport()}
                  >
                    {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ExportSvgIcon className="size-[18px]" />}
                    Exportar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        {loading && apiRows.length === 0 && pendingContacts.length === 0 ? (
          viewMode === "table" ? (
            <GhostTableSkeleton
              columns={[
                { label: "", width: 44 },
                { label: "", width: 40 },
                { label: "Nombre", width: 280 },
                { label: "Empresa", width: 200 },
                { label: "Teléfono", width: 120, className: "hidden lg:table-cell" },
                { label: "Email", width: 200, className: "hidden xl:table-cell" },
                { label: "Fuente", width: 120, className: "hidden md:table-cell" },
                { label: "Recuperado", width: 100, className: "hidden md:table-cell" },
                { label: "Etapa", width: 140, className: "hidden md:table-cell" },
                { label: "Asesor", width: 150, className: "hidden xl:table-cell" },
                { label: "Creación", width: 120, className: "hidden md:table-cell" },
                { label: "U. Interacción", width: 140, className: "hidden lg:table-cell" },
              ]}
              rows={10}
            />
          ) : (
            <CrmEntityCardGridSkeleton
              count={8}
              aria-label="Cargando contactos"
            />
          )
        ) : totalContacts === 0 &&
          apiRows.length === 0 &&
          pendingContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron contactos"
            description="Intenta ajustar los filtros o crea un nuevo contacto."
          />
        ) : viewMode === "table" ? (
          <div className="border-t border-border/40 overflow-auto max-h-[calc(100vh-330px)] scrollbar-thin">
            <ContactsTable
              contacts={displayedContacts}
              selectedContacts={selectedContacts}
              selectAllMode={selectAllMode}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelect={toggleSelectContact}
              allSelected={
                selectAllMode ||
                (selectedContacts.length === displayedContacts.length &&
                  displayedContacts.length > 0)
              }
              isPendingContactId={isPendingContactId}
              onView={openContactDetail}
              onPreview={openContactPreview}
              onEdit={openContactEdit}
              onDelete={(id) => {
                setContactToDelete(id);
                setDeleteDialogOpen(true);
              }}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          </div>
        ) : (
          <div className="p-5 border-t border-border/40">
            <ContactsGrid
              contacts={displayedContacts}
              isPendingContactId={isPendingContactId}
              onView={openContactDetail}
              onPreview={openContactPreview}
              onEdit={openContactEdit}
              onDelete={(id) => {
                setContactToDelete(id);
                setDeleteDialogOpen(true);
              }}
            />
          </div>
        )}

        {totalContacts > 0 && (
          <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalContacts}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </GlassCard>

      <NewContactWizard
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        onSubmit={onSubmitNewContact}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Contacto"
        description="¿Estás seguro que deseas eliminar este contacto? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Batch Delete Confirmation */}
      <ConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        title="Eliminar Contactos Seleccionados"
        description={`¿Estás seguro que deseas eliminar ${selectedDeleteCount} contacto(s)? Esta acción no se puede deshacer.`}
        onConfirm={handleBatchDelete}
        variant="destructive"
        confirmLabel={batchDeleting ? "Eliminando..." : `Eliminar ${selectedDeleteCount}`}
      />

      <BatchReassignAdvisorDialog
        open={batchReassignDialogOpen}
        onOpenChange={setBatchReassignDialogOpen}
        count={selectedDeleteCount}
        entityLabel="contacto(s)"
        assignModule="contactos"
        onConfirm={handleBatchReassign}
        confirming={batchReassigning}
      />

      <ContactPreviewSheet
        contact={previewContact}
        open={previewContact !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewContact(null);
        }}
        onOpenFullDetail={() => {
          const c = previewContact;
          setPreviewContact(null);
          if (c) openContactDetail(c);
        }}
        onEdit={() => {
          const c = previewContact;
          setPreviewContact(null);
          if (c) openContactEdit(c);
        }}
      />

      <ContactEditDialog
        contact={editContact}
        open={editContact !== null}
        onOpenChange={(open) => {
          if (!open) setEditContact(null);
        }}
        onSave={handleSaveContactFromList}
        canEditAssignee={canEditAssignee}
      />
    </div>
  );
}

/* ─── Table View ─── */

interface ContactsTableProps {
  contacts: Contact[];
  selectedContacts: string[];
  selectAllMode: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  isPendingContactId: (id: string) => boolean;
  onView: (contact: Contact, event?: React.MouseEvent) => void;
  onPreview: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
}

function ContactsTable({
  contacts: data,
  selectedContacts,
  selectAllMode,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  isPendingContactId,
  onView,
  onPreview,
  onEdit,
  onDelete,
  columnVisibility,
  onColumnVisibilityChange,
}: ContactsTableProps) {
  const { hasPermission } = usePermissions();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "select",
        meta: { responsive: "" } as any,
        header: () => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded" />
          </div>
        ),
        cell: ({ row }) => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={selectAllMode || selectedContacts.includes(row.original.id)}
              disabled={selectAllMode}
              onCheckedChange={() => onToggleSelect(row.original.id)}
              className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
            />
          </div>
        ),
        ...comercialTableSelectColumnSizing,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DropdownMenuTriggerButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onPreview(row.original)}>
                <EyeSvgIcon /> Vista previa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <PencilFileSvgIcon /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {hasPermission("contactos.eliminar") && (
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original.id)}>
                  <TrashSvgIcon /> Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        ...comercialTableActionsColumnSizing,
      },
      {
        accessorKey: "name",
        id: "nombre",
        header: "Nombre",
        meta: { responsive: "" } as any,
        cell: ({ row }) => {
          const contact = row.original;
          const pending = isPendingContactId(contact.id);
          return (
            <div className="min-w-0 max-w-[20rem]">
              <div className="flex items-center gap-2">
                {pending ? (
                  <p
                    className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
                    title={contact.name}
                  >
                    {contact.name}
                  </p>
                ) : (
                  <Link
                    to={contactDetailHref(contact)}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-[13px] font-semibold text-[#0F172A] hover:text-primary dark:text-gray-100"
                    title={contact.name}
                  >
                    {contact.name}
                  </Link>
                )}
                {pending && (
                  <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
                    <Loader2 className="size-3 animate-spin" />
                    Guardando…
                  </Badge>
                )}
              </div>
              {contact.cargo && (
                <p className="mt-0.5 truncate text-[11px] text-[#64748B] dark:text-gray-400">
                  {contact.cargo}
                </p>
              )}
            </div>
          );
        },
        size: 240,
      },
      {
        accessorFn: (row) => getPrimaryCompany(row)?.name ?? "—",
        id: "empresa",
        header: "Empresa",
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="block max-w-[16rem] truncate text-[13px] text-[#475569] dark:text-gray-400" title={String(getValue())}>
            {String(getValue())}
          </span>
        ),
        enableSorting: false,
        size: 170,
      },
      {
        accessorKey: "telefono",
        id: "telefono",
        header: "Teléfono",
        enableHiding: true,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          return (
            <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || "—"}
            </span>
          );
        },
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: "correo",
        id: "correo",
        header: "Email",
        enableHiding: true,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          return (
            <span className="block max-w-[14rem] truncate text-[13px] text-[#475569] dark:text-gray-400" title={val}>
              {val || "—"}
            </span>
          );
        },
        enableSorting: false,
        size: 170,
      },
      {
        accessorKey: "fuente",
        id: "fuente",
        header: "Fuente",
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="inline-flex h-6 items-center rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            {getSourceLabelFromCatalog(String(getValue()), bundle, contactSourceLabels)}
          </span>
        ),
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: "clienteRecuperado",
        id: "clienteRecuperado",
        header: "Recuperado",
        size: 100,
        maxSize: 100,
        enableHiding: true,
        cell: ({ getValue }) => {
          const val = getValue();
          return val === "si" ? (
            <span className="text-[13px] font-medium text-emerald-700">Sí</span>
          ) : val === "no" ? (
            <span className="text-[13px] text-[#475569] dark:text-gray-400">No</span>
          ) : (
            <span className="text-[13px] text-gray-300">—</span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "etapa",
        id: "etapa",
        header: "Etapa",
        enableHiding: true,
        cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: "assignedToName",
        id: "asesor",
        header: "Asesor",
        enableHiding: true,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          return (
            <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || "—"}
            </span>
          );
        },
        enableSorting: false,
        size: 130,
      },
      {
        accessorKey: "createdAt",
        id: "fecha",
        header: "Creación",
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {formatDateShort(String(getValue()))}
          </span>
        ),
        sortingFn: "datetime",
        size: 120,
      },
      {
        accessorKey: "lastInteractionAt",
        id: "ultimaInteraccion",
        header: "U. Interacción",
        enableHiding: true,
        cell: ({ getValue }) => {
          const val = getValue() as string | null | undefined;
          return (
            <span className="text-[13px] text-[#475569] dark:text-gray-400">
              {val ? formatDateShort(val) : "—"}
            </span>
          );
        },
        enableSorting: false,
        size: 120,
      },
    ],
    [allSelected, onToggleSelectAll, selectedContacts, onToggleSelect, isPendingContactId, onPreview, onEdit, onDelete, hasPermission, bundle],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60 },
  });

  return (
    <table className="w-full table-fixed" style={{ minWidth: table.getTotalSize() }}>
        <ComercialTableColgroup columns={table.getVisibleLeafColumns()} />
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
              {hg.headers.map((header: any) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  className={comercialTableLeadingCellClass(header.column.id, {
                    primaryColumnId: "nombre",
                    sortable: header.column.getCanSort(),
                  })}
                  style={comercialTableCellStyle(header.column.id, header.getSize())}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <>
                        {header.column.getIsSorted() === "asc" ? (
                          <ChevronUp className="size-3 shrink-0" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ChevronDown className="size-3 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="size-3 shrink-0 text-[#94A3B8] dark:text-gray-500" />
                        )}
                      </>
                    )}
                  </div>
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); header.getResizeHandler()(e); }}
                      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); header.getResizeHandler()(e); }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-5 cursor-col-resize group/rez"
                    >
                      <div className="h-4 w-[2px] rounded-full bg-gray-200 group-hover/rez:bg-blue-500 group-active/rez:bg-blue-500 group-hover/rez:w-[5px] group-active/rez:w-[5px] transition-all select-none pointer-events-none" />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const pending = isPendingContactId(row.original.id);
            return (
              <tr
                key={row.id}
                className={cn(
                  'h-[48px] last:border-b-0',
                  crmTableBodyRowClassInteractive,
                  pending && 'bg-muted/40 hover:bg-muted/40',
                )}
                onClick={(e) => onView(row.original, e)}
                onAuxClick={(e) => navigateOnAuxClick(e, contactDetailHref(row.original))}
              >
                {row.getVisibleCells().map((cell: any) => (
                  <td
                    key={cell.id}
                    className={comercialTableLeadingCellClass(cell.column.id, {
                      primaryColumnId: "nombre",
                    })}
                    style={comercialTableCellStyle(cell.column.id, cell.column.getSize())}
                    onClick={
                      cell.column.id === "select" || cell.column.id === "actions"
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
  );
}

/* ─── Card View ─── */

interface ContactsGridProps {
  contacts: Contact[];
  isPendingContactId: (id: string) => boolean;
  onView: (contact: Contact, event?: React.MouseEvent) => void;
  onPreview: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

function ContactsGrid({
  contacts: data,
  isPendingContactId,
  onView,
  onPreview,
  onEdit,
  onDelete,
}: ContactsGridProps) {
  const { hasPermission } = usePermissions();
  return (
    <div className="grid w-full grid-cols-1 gap-3 px-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((contact) => {
        const pending = isPendingContactId(contact.id);
        const tel = contact.telefono?.trim() ?? "";
        const mail = contact.correo?.trim() ?? "";
        const showTel = !!tel && tel !== "-";
        const showMail = !!mail;
        return (
          <Card
            key={contact.id}
            className={
              pending
                ? "gap-0 max-w-full overflow-hidden border-dashed bg-muted/30 py-0"
                : "cursor-pointer gap-0 max-w-full overflow-hidden py-0 transition-shadow hover:shadow-md"
            }
            onClick={(e) => onView(contact, e)}
            onAuxClick={(e) => navigateOnAuxClick(e, contactDetailHref(contact))}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {pending ? (
                      <h3 className="truncate font-semibold">{contact.name}</h3>
                    ) : (
                      <h3 className="truncate font-semibold">
                        <Link
                          to={contactDetailHref(contact)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary"
                        >
                          {contact.name}
                        </Link>
                      </h3>
                    )}
                    {pending && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 text-[10px] font-normal"
                      >
                        <Loader2 className="size-3 animate-spin" />
                        Guardando…
                      </Badge>
                    )}
                  </div>
                  {contact.cargo && (
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.cargo}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                    <Building2 className="size-3 shrink-0" />{" "}
                    {getPrimaryCompany(contact)?.name ?? "—"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuTriggerButton className="size-6" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(contact);
                      }}
                    >
                      <EyeSvgIcon /> Vista previa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(contact);
                      }}
                    >
                      <PencilFileSvgIcon /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {hasPermission("contactos.eliminar") && (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(contact.id);
                        }}
                      >
                        <TrashSvgIcon /> Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge status={contact.etapa} />
                {contact.clienteRecuperado === "si" && (
                  <Badge variant="secondary" className="text-xs">
                    Recuperado
                  </Badge>
                )}
              </div>

              {(showTel || showMail) && (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {showTel && (
                    <p className="flex items-center gap-2 truncate">
                      <Phone className="size-3 shrink-0" /> {tel}
                    </p>
                  )}
                  {showMail && (
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="size-3 shrink-0" /> {mail}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  {contact.assignedToName}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
