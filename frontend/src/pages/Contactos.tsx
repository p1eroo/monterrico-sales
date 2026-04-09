import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X, ArrowUpDown,
  Phone, Mail, Building2, DollarSign, Users, ChevronLeft, ChevronRight,
  Upload, Download, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { NewContactWizard, type NewContactData } from '@/components/shared/NewContactWizard';
import { isLikelyOpportunityCuid } from '@/lib/opportunityApi';
import { getPrimaryCompany } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { ContactEditDialog, type ContactEditSavePayload } from '@/components/shared/ContactEditDialog';
import { ContactPreviewSheet } from '@/components/shared/ContactPreviewSheet';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ImportInProgressDialog } from '@/components/shared/ImportInProgressDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { contactDetailHref } from '@/lib/detailRoutes';
import type { Contact, Etapa } from '@/types';
import { companyListAll } from '@/lib/companyApi';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactListPaginated,
  contactListEtapaCounts,
  primaryCompanyIdFromApiContact,
} from '@/lib/contactApi';
import { buildOptimisticContact } from '@/lib/optimisticEntities';
import {
  generateOptimisticId,
  useOptimisticCrmStore,
} from '@/store/optimisticCrmStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  downloadImportExportCsv,
  previewContactsImportCsv,
  uploadImportCsv,
  type ContactImportPreviewResult,
} from '@/lib/importExportApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ITEMS_PER_PAGE = 25;

function importPreviewCell(v: string | undefined) {
  const t = (v ?? '').trim();
  return t || '—';
}

const etapaOrder: Etapa[] = [
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
];

const etapaTabs: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...etapaOrder.map((e) => ({ value: e, label: etapaLabels[e] })),
];

export default function ContactosPage() {
  const navigate = useNavigate();
  const { users } = useUsers();
  const { hasPermission } = usePermissions();
  const pendingContacts = useOptimisticCrmStore((s) => s.pendingContacts);
  const addPendingContact = useOptimisticCrmStore((s) => s.addPendingContact);
  const removePendingContact = useOptimisticCrmStore((s) => s.removePendingContact);
  const isPendingContactId = useOptimisticCrmStore((s) => s.isPendingContactId);
  const [apiRows, setApiRows] = useState<ApiContactListRow[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string>('todos');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importCommitInProgress, setImportCommitInProgress] = useState(false);
  const [importCommitRowHint, setImportCommitRowHint] = useState<
    string | undefined
  >(undefined);
  const [importPreviewInProgress, setImportPreviewInProgress] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] =
    useState<ContactImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(
    null,
  );
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [etapaTabCounts, setEtapaTabCounts] = useState<Record<
    string,
    number
  > | null>(null);

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

  const loadApiContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactListPaginated({
        page,
        limit: ITEMS_PER_PAGE,
        search: searchDebounced || undefined,
        etapa: etapaFilter === 'todos' ? undefined : etapaFilter,
        fuente: sourceFilter === 'todos' ? undefined : sourceFilter,
        assignedTo: advisorFilter === 'todos' ? undefined : advisorFilter,
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
  }, [page, searchDebounced, etapaFilter, sourceFilter, advisorFilter]);

  useEffect(() => {
    void loadApiContacts();
  }, [loadApiContacts]);

  const loadEtapaTabCounts = useCallback(async () => {
    try {
      const { counts } = await contactListEtapaCounts({
        search: searchDebounced || undefined,
        fuente: sourceFilter === 'todos' ? undefined : sourceFilter,
        assignedTo: advisorFilter === 'todos' ? undefined : advisorFilter,
      });
      setEtapaTabCounts(counts);
    } catch {
      setEtapaTabCounts({});
    }
  }, [searchDebounced, sourceFilter, advisorFilter]);

  useEffect(() => {
    void loadEtapaTabCounts();
  }, [loadEtapaTabCounts]);

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

  const visibleEtapaTabs = useMemo(() => {
    const rest = etapaTabs.slice(1);
    if (etapaTabCounts == null) {
      return rest;
    }
    return rest.filter((tab) => (effectiveEtapaTabCounts[tab.value] ?? 0) > 0);
  }, [etapaTabCounts, effectiveEtapaTabCounts]);

  useEffect(() => {
    if (etapaTabCounts == null) return;
    if (etapaFilter === 'todos') return;
    if ((effectiveEtapaTabCounts[etapaFilter] ?? 0) > 0) return;
    setEtapaFilter('todos');
    setPage(1);
  }, [etapaTabCounts, etapaFilter, effectiveEtapaTabCounts]);

  function openContactDetail(contact: Contact) {
    if (isPendingContactId(contact.id)) {
      toast.info('Guardando contacto en el servidor…');
      return;
    }
    navigate(contactDetailHref(contact));
  }

  function openContactPreview(contact: Contact) {
    setPreviewContact(contact);
  }

  function openContactEdit(contact: Contact) {
    if (isPendingContactId(contact.id)) {
      toast.info('Guardando contacto en el servidor…');
      return;
    }
    if (!isLikelyContactCuid(contact.id)) {
      toast.error('Solo se pueden editar contactos guardados en el servidor');
      return;
    }
    setEditContact(contact);
  }

  async function handleSaveContactFromList(payload: ContactEditSavePayload) {
    if (!editContact) return;
    try {
      await api<ApiContactDetail>(`/contacts/${editContact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          cargo: payload.cargo || null,
          telefono: payload.telefono,
          correo: payload.correo,
          fuente: payload.fuente,
          estimatedValue: payload.estimatedValue,
        }),
      });
      await loadApiContacts();
      toast.success('Contacto actualizado correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      throw e;
    }
  }
  const startIndex = totalContacts === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, totalContacts);

  const hasActiveFilters = etapaFilter !== 'todos' || sourceFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todos');
    setSourceFilter('todos');
    setAdvisorFilter('todos');
    setPage(1);
  }

  function toggleSelectAll() {
    if (selectedContacts.length === displayedContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(displayedContacts.map((l) => l.id));
    }
  }

  function toggleSelectContact(id: string) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  async function handleDelete() {
    if (!contactToDelete) return;
    if (isPendingContactId(contactToDelete)) {
      toast.error('Espera a que termine de guardarse el contacto');
      setContactToDelete(null);
      return;
    }
    if (!isLikelyContactCuid(contactToDelete)) {
      toast.error('Solo se pueden eliminar contactos guardados en el servidor');
      setContactToDelete(null);
      return;
    }
    try {
      await api(`/contacts/${contactToDelete}`, { method: 'DELETE' });
      await loadApiContacts();
      toast.success('Contacto eliminado correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar en el servidor');
    }
    setContactToDelete(null);
  }

  async function onSubmitNewContact(data: NewContactData) {
    if (!data.phone?.trim()) {
      toast.error('El teléfono es obligatorio');
      return;
    }
    if (!data.email?.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }
    if (data.estimatedValue <= 0) {
      toast.error('El valor estimado debe ser mayor que 0');
      return;
    }
    if (data.newCompanyWizardData) {
      const w = data.newCompanyWizardData;
      const existingCoId = data.newCompanyWizardUpdate?.companyId;

      if (existingCoId) {
        if (!w.origenLead) {
          toast.error('Selecciona la fuente del lead en el wizard de empresa');
          return;
        }
        try {
          await api(`/companies/${existingCoId}`, {
            method: 'PATCH',
            body: JSON.stringify(newCompanyDataToPatchBody(w)),
          });
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo actualizar la empresa',
          );
          return;
        }

        const body: Record<string, unknown> = {
          name: data.name.trim(),
          telefono: data.phone.trim(),
          correo: data.email.trim(),
          fuente: data.source,
          etapa: data.etapaCiclo,
          estimatedValue: data.estimatedValue,
          cargo: data.cargo?.trim() || undefined,
          docType: data.docType || undefined,
          docNumber: data.docNumber?.trim() || undefined,
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

        const optId = generateOptimisticId('c');
        addPendingContact(
          buildOptimisticContact(optId, data, {
            companyDisplayName: w.nombreComercial.trim(),
          }),
        );

        try {
          await api<ApiContactDetail>('/contacts', {
            method: 'POST',
            body: JSON.stringify(body),
          });
        } catch (e) {
          removePendingContact(optId);
          toast.error(
            e instanceof Error ? e.message : 'No se pudo crear el contacto en el servidor',
          );
          return;
        }

        removePendingContact(optId);
        await loadApiContacts();
        toast.success(
          `Contacto "${data.name}" creado · empresa "${w.nombreComercial.trim()}" actualizada`,
        );
        setNewContactOpen(false);
        return;
      }

      const factEmpresa = (() => {
        const f = Number(w.facturacion);
        if (Number.isFinite(f) && f > 0) return f;
        return data.estimatedValue > 0 ? data.estimatedValue : 0;
      })();
      if (factEmpresa <= 0) {
        toast.error('Indica facturación estimada en el paso de oportunidad o un valor estimado del contacto mayor que 0');
        return;
      }
      if (!w.origenLead) {
        toast.error('Selecciona la fuente del lead en el wizard de empresa');
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
        correo: w.correo.trim() || undefined,
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
        estimatedValue: data.estimatedValue,
        cargo: data.cargo?.trim() || undefined,
        docType: data.docType || undefined,
        docNumber: data.docNumber?.trim() || undefined,
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

      const optId = generateOptimisticId('c');
      addPendingContact(
        buildOptimisticContact(optId, data, {
          companyDisplayName: w.nombreComercial.trim(),
        }),
      );

      let contactId: string;
      let companyId: string | undefined;
      try {
        const created = await api<ApiContactDetail>('/contacts', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        contactId = created.id;
        companyId = primaryCompanyIdFromApiContact(created);
      } catch (e) {
        removePendingContact(optId);
        toast.error(
          e instanceof Error ? e.message : 'No se pudo crear el contacto en el servidor',
        );
        return;
      }

      if (!companyId) {
        removePendingContact(optId);
        toast.error('No se pudo obtener la empresa vinculada al contacto creado');
        return;
      }

      if (w.nombreNegocio.trim()) {
        const monto = factEmpresa;
        const oppBody: Record<string, unknown> = {
          title: w.nombreNegocio.trim(),
          amount: monto,
          etapa: w.etapa,
          fuente: w.origenLead,
          status: 'abierta',
          priority: 'media',
          expectedCloseDate:
            w.fechaCierre.trim() ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          contactId,
          companyId,
        };
        if (w.propietario && isLikelyOpportunityCuid(w.propietario)) {
          oppBody.assignedTo = w.propietario;
        }
        try {
          await api('/opportunities', {
            method: 'POST',
            body: JSON.stringify(oppBody),
          });
        } catch (e) {
          toast.error(
            e instanceof Error
              ? `${e.message} (contacto y empresa ya creados)`
              : 'No se pudo crear la oportunidad; el contacto y la empresa ya están registrados',
          );
        }
      }

      removePendingContact(optId);
      await loadApiContacts();
      const msgParts = [`Contacto "${data.name}"`, `empresa "${w.nombreComercial.trim()}"`];
      if (w.nombreNegocio.trim()) msgParts.push('oportunidad vinculada');
      toast.success(`${msgParts.join(' · ')} — creados correctamente`);
      setNewContactOpen(false);
      return;
    }

    let companyId: string | undefined;
    let newCompany: Record<string, unknown> | undefined;
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
          newCompany = {
            name: data.company.trim(),
            facturacionEstimada: data.estimatedValue,
            fuente: data.source,
            etapa: data.etapaCiclo,
            ...(data.assignedTo && isLikelyContactCuid(data.assignedTo)
              ? { assignedTo: data.assignedTo }
              : {}),
          };
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'No se pudo resolver la empresa en el servidor',
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
      estimatedValue: data.estimatedValue,
      cargo: data.cargo?.trim() || undefined,
      docType: data.docType || undefined,
      docNumber: data.docNumber?.trim() || undefined,
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
    if (newCompany) {
      body.newCompany = newCompany;
    }

    const optIdSimple = generateOptimisticId('c');
    addPendingContact(
      buildOptimisticContact(optIdSimple, data, {
        companyDisplayName: data.company.trim() || undefined,
      }),
    );

    try {
      await api('/contacts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (e) {
      removePendingContact(optIdSimple);
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear el contacto en el servidor',
      );
      return;
    }

    removePendingContact(optIdSimple);
    await loadApiContacts();
    toast.success(`Contacto "${data.name}" creado exitosamente`);
    setNewContactOpen(false);
  }

  async function handleContactTemplate() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('contacts', 'template');
      toast.success('Plantilla descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar la plantilla');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleContactExport() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('contacts', 'export');
      toast.success('Exportación descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportBusy(false);
    }
  }

  function openContactImport() {
    importInputRef.current?.click();
  }

  async function onContactImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
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
        err instanceof Error ? err.message : 'Error al generar vista previa',
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
    setImportCommitRowHint(
      `Se enviarán ${preview.okCount} fila(s) válida(s). Las consultas externas pueden alargar el proceso.`,
    );
    setImportCommitInProgress(true);
    setImportBusy(true);
    try {
      const r = await uploadImportCsv('contacts', file);
      const errMsg =
        r.errors.length > 0
          ? r.errors
              .slice(0, 5)
              .map((x) => `Fila ${x.row}: ${x.message}`)
              .join('\n') + (r.errors.length > 5 ? `\n…y ${r.errors.length - 5} más` : '')
          : undefined;
      if (r.created === 0 && r.errors.length > 0) {
        toast.error('No se crearon contactos', { description: errMsg });
      } else {
        toast.success(
          `Importación: ${r.created} contacto(s) creado(s)${
            r.skipped ? ` · ${r.skipped} fila(s) vacía(s) omitidas` : ''
          }`,
          errMsg ? { description: errMsg } : undefined,
        );
      }
      await loadApiContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImportCommitInProgress(false);
      setImportCommitRowHint(undefined);
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ImportInProgressDialog
        open={importPreviewInProgress}
        title="Generando vista previa"
        description="El servidor está leyendo el CSV y validando filas contra la base de datos. Las consultas externas solo ocurren al confirmar la importación."
        rowHint="Puede tardar unos segundos si el archivo tiene muchas filas."
      />
      <ImportInProgressDialog
        open={importCommitInProgress}
        title="Importando contactos"
        description="El servidor está validando filas, creando contactos y puede consultar RENIEC u otras fuentes según los datos del CSV."
        rowHint={importCommitRowHint}
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
                    {importPreviewData.okCount} fila(s) lista(s) ·{' '}
                    {importPreviewData.errorCount} con error
                    {importPreviewData.skipped
                      ? ` · ${importPreviewData.skipped} vacía(s) omitida(s)`
                      : ''}
                    . Teléfono, correo y fuente pueden ir en blanco. En Empresa se muestra el RUC si viene en el archivo; si no, el nombre.
                  </span>
                  {importPreviewData.errorCount > 0 ? (
                    <span className="mt-2 block text-destructive">
                      Corrige o elimina las filas con error en el CSV y vuelve a elegir el archivo. No se importará nada
                      hasta que no queden errores en la vista previa.
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
                  <TableHeader>
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
                          className="min-w-[10rem] max-w-[16rem] align-bottom"
                        >
                          {key}
                        </TableHead>
                      ))}
                      <TableHead className="min-w-[12rem] max-w-[24rem] align-bottom">
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
                          {contactImportPreviewCsvKeys.map((key) => (
                            <TableCell
                              key={`${row.row}-${key}`}
                              className="max-w-[16rem] break-words align-top text-xs"
                            >
                              {importPreviewCell(row.csvColumns?.[key])}
                            </TableCell>
                          ))}
                          <TableCell className="max-w-[24rem] break-words align-top text-muted-foreground">
                            {row.ok
                              ? importPreviewCell(undefined)
                              : importPreviewCell(row.error)}
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
              onClick={() => void confirmContactImport()}
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
        onChange={onContactImportChange}
      />
      <PageHeader title="Contactos" description="Gestiona y da seguimiento a tus prospectos de venta">
        {(totalContacts > 0 || pendingContacts.length > 0) && (
          <Badge variant="secondary" className="mr-2 font-normal">
            <Users className="size-3.5" />{' '}
            {totalContacts > 0 ? `${totalContacts} contactos` : `${pendingContacts.length} nuevos`}
            {pendingContacts.length > 0 && totalContacts > 0 && (
              <span className="ml-1 opacity-80">· {pendingContacts.length} guardándose</span>
            )}
            {pendingContacts.length > 0 && totalContacts === 0 && (
              <span className="ml-1 opacity-80">· sincronizando</span>
            )}
          </Badge>
        )}
        {hasPermission('contactos.exportar') && (
          <Button
            variant="outline"
            size="sm"
            disabled={exportBusy}
            title="CSV sin id: usa empresa_nombre y empresa_ruc para vincular o crear empresa"
            onClick={() => void handleContactTemplate()}
          >
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{' '}
            Plantilla
          </Button>
        )}
        {hasPermission('contactos.crear') && (
          <Button
            variant="outline"
            size="sm"
            disabled={importBusy}
            title="Obligatorio: valor_estimado (>0). Nombre o DNI (8 dígitos en doc_numero) para RENIEC vía Factiliza. Si indicas nombre en el CSV, prevalece sobre el de la API. doc_tipo vacío o DNI."
            onClick={openContactImport}
          >
            {importBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{' '}
            Importar
          </Button>
        )}
        {hasPermission('contactos.exportar') && (
          <Button
            variant="outline"
            size="sm"
            disabled={exportBusy}
            onClick={() => void handleContactExport()}
          >
            {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{' '}
            Exportar
          </Button>
        )}
        <Button onClick={() => setNewContactOpen(true)}>
          <Plus /> Nuevo Contacto
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={etapaFilter === 'todos' ? 'secondary' : 'outline'}
          className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          onClick={() => { setEtapaFilter('todos'); setPage(1); }}
        >
          <Users className="size-3.5" /> Total: {totalContacts}
        </Badge>
        {visibleEtapaTabs.map((tab) => (
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

      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa, email o teléfono..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

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
            Cargando contactos...
          </div>
        ) : totalContacts === 0 && apiRows.length === 0 && pendingContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron contactos"
            description="Intenta ajustar los filtros o crea un nuevo contacto."
            actionLabel="Nuevo Contacto"
            onAction={() => setNewContactOpen(true)}
          />
        ) : viewMode === 'table' ? (
          <ContactsTable
            contacts={displayedContacts}
            selectedContacts={selectedContacts}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelectContact}
            allSelected={
              selectedContacts.length === displayedContacts.length && displayedContacts.length > 0
            }
            isPendingContactId={isPendingContactId}
            onView={openContactDetail}
            onPreview={openContactPreview}
            onEdit={openContactEdit}
            onDelete={(id) => { setContactToDelete(id); setDeleteDialogOpen(true); }}
          />
        ) : (
          <ContactsGrid
            contacts={displayedContacts}
            isPendingContactId={isPendingContactId}
            onView={openContactDetail}
            onPreview={openContactPreview}
            onEdit={openContactEdit}
            onDelete={(id) => { setContactToDelete(id); setDeleteDialogOpen(true); }}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && (totalContacts > 0 || pendingContacts.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {totalContacts > 0 ? (
              <>
                Mostrando {startIndex}-{endIndex} de {totalContacts} contactos
                {pendingContacts.length > 0 && (
                  <span className="ml-1">· {pendingContacts.length} guardándose</span>
                )}
              </>
            ) : (
              <>Contactos nuevos aparecerán aquí al sincronizar con el servidor.</>
            )}
          </p>
          {totalContacts > 0 && (
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
          )}
        </div>
      )}

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
      />
    </div>
  );
}

/* ─── Table View ─── */

interface ContactsTableProps {
  contacts: Contact[];
  selectedContacts: string[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  isPendingContactId: (id: string) => boolean;
  onView: (contact: Contact) => void;
  onPreview: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

function ContactsTable({
  contacts: data,
  selectedContacts,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  isPendingContactId,
  onView,
  onPreview,
  onEdit,
  onDelete,
}: ContactsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>
              <button className="flex items-center gap-1 font-medium">
                Nombre <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead className="hidden md:table-cell">Empresa</TableHead>
            <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="hidden xl:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">Fuente</TableHead>
            <TableHead className="hidden lg:table-cell">Cliente Recuperado</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="hidden xl:table-cell">Asesor</TableHead>
            <TableHead className="hidden md:table-cell">
              <button className="flex items-center gap-1 font-medium">
                Fecha <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((contact) => {
            const pending = isPendingContactId(contact.id);
            return (
            <TableRow
              key={contact.id}
              className={pending ? 'bg-muted/40' : 'cursor-pointer'}
              onClick={() => onView(contact)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={() => onToggleSelect(contact.id)}
                />
              </TableCell>
              <TableCell>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {pending && (
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Loader2 className="size-3 animate-spin" />
                        Guardando…
                      </Badge>
                    )}
                  </div>
                  {contact.cargo && <p className="text-xs text-muted-foreground">{contact.cargo}</p>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{getPrimaryCompany(contact)?.name ?? '—'}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{contact.telefono}</TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{contact.correo}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="outline" className="text-xs">{contactSourceLabels[contact.fuente]}</Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {contact.clienteRecuperado === 'si' ? 'Sí' : contact.clienteRecuperado === 'no' ? 'No' : '—'}
              </TableCell>
              <TableCell><StatusBadge status={contact.etapa} /></TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{contact.assignedToName}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {new Date(contact.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onPreview(contact)}>
                      <Eye /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(contact)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(contact.id)}>
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
  );
}

/* ─── Card View ─── */

interface ContactsGridProps {
  contacts: Contact[];
  isPendingContactId: (id: string) => boolean;
  onView: (contact: Contact) => void;
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
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((contact) => {
        const pending = isPendingContactId(contact.id);
        const tel = contact.telefono?.trim() ?? '';
        const mail = contact.correo?.trim() ?? '';
        const showTel = !!tel && tel !== '-';
        const showMail = !!mail;
        return (
        <Card
          key={contact.id}
          className={
            pending
              ? 'gap-0 border-dashed bg-muted/30 py-0'
              : 'cursor-pointer gap-0 py-0 transition-shadow hover:shadow-md'
          }
          onClick={() => onView(contact)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold truncate">{contact.name}</h3>
                  {pending && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px] font-normal">
                      <Loader2 className="size-3 animate-spin" />
                      Guardando…
                    </Badge>
                  )}
                </div>
                {contact.cargo && <p className="text-xs text-muted-foreground truncate">{contact.cargo}</p>}
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <Building2 className="size-3 shrink-0" /> {getPrimaryCompany(contact)?.name ?? '—'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPreview(contact)}>
                    <Eye /> Ver
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(contact)}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(contact.id)}>
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={contact.etapa} />
              {contact.clienteRecuperado === 'si' && (
                <Badge variant="secondary" className="text-xs">Cliente Recuperado</Badge>
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

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <DollarSign className="size-3.5" />
                {formatCurrency(contact.estimatedValue)}
              </span>
              <span className="text-xs text-muted-foreground">{contact.assignedToName}</span>
            </div>
          </CardContent>
        </Card>
      );
      })}
    </div>
  );
}
