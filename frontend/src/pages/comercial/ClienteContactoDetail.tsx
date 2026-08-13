import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  UserPlus, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { LetterSvgIcon } from '@/components/icons/LetterSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { MapArrowSquareSvgIcon } from '@/components/icons/MapArrowSquareSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import type { Activity, Contact, TimelineEvent } from '@/types';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { LinkExistingDialog } from '@/components/shared/LinkExistingDialog';
import { ContactHeader } from '@/components/contact-detail/ContactHeader';
import { LinkedClienteEmpresasCard } from '@/components/cliente-cartera/LinkedClienteEmpresasCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { EntityNotesTab } from '@/components/shared/EntityNotesTab';
import {
  QuickActionsWithDialogs,
  type QuickActivityDraft,
} from '@/components/shared/QuickActionsWithDialogs';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ContactEditDialog, type ContactEditSavePayload } from '@/components/shared/ContactEditDialog';
import { WhatsappContactDrawer } from '@/components/shared/WhatsappContactDrawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, completedAtNowIso } from '@/lib/formatters';
import { toast } from '@/lib/notify';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useActivities } from '@/hooks/useActivities';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { canPickOtherCommercialAdvisor } from '@/data/rbac';
import { usePermissions } from '@/hooks/usePermissions';
import { useStageBadgeTone } from '@/hooks/useStageBadgeTone';
import { getSourceLabelFromCatalog, getStageLabelFromCatalog, useCrmConfigStore } from '@/store/crmConfigStore';
import {
  activityMatchesEntityFilter,
} from '@/lib/activityEntityLinks';
import {
  fetchClienteEmpresas,
  fetchContactoClienteById,
  linkContactoToClienteEmpresa,
  unlinkContactoFromClienteEmpresa,
  updateContactoCliente,
  type ContactoClienteRow,
} from '@/lib/clienteCarteraApi';
import {
  contactEditPayloadToClienteUpdate,
  contactoClienteRowToContact,
} from '@/lib/clienteContactoFormUtils';
import { APP_PATHS } from '@/lib/detailRoutes';

const TIMELINE_PAGE_SIZE = 8;

const CLIENTE_DETAIL_TABS = [
  { value: 'historial', label: 'Historial' },
  { value: 'actividades', label: 'Actividades' },
  { value: 'tareas', label: 'Tareas' },
  { value: 'notas', label: 'Notas' },
] as const;

function primaryEmpresaFromContact(contact: ContactoClienteRow | null) {
  if (!contact?.empresas.length) return null;
  return contact.empresas.find((e) => e.isPrimary) ?? contact.empresas[0];
}

export default function ClienteContactoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const crmBundle = useCrmConfigStore((s) => s.bundle);
  const { hasPermission } = usePermissions();
  const canEditAssignee = canPickOtherCommercialAdvisor(hasPermission);
  const { users, activeAdvisors } = useUsers();
  const {
    activities: activitiesFromStore,
    createActivity,
    updateActivity,
    deleteActivity,
  } = useActivities();

  const [contact, setContact] = useState<ContactoClienteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailSectionTab, setDetailSectionTab] = useState<string>('historial');
  const [contactActivities, setContactActivities] = useState<Activity[]>([]);
  const [noteText, setNoteText] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [allEmpresas, setAllEmpresas] = useState<{ id: string; empresa: string }[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);

  const tasksTabRef = useRef<TasksTabHandle>(null);

  const loadContact = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContactoClienteById(id);
      setContact(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar el contacto';
      setError(msg);
      setContact(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadContact();
  }, [loadContact]);

  const primaryEmpresa = useMemo(
    () => primaryEmpresaFromContact(contact),
    [contact],
  );

  const etapaSlug = contact?.etapa?.trim() || 'cliente';
  const stageTone = useStageBadgeTone(etapaSlug);
  const stageLabel =
    getStageLabelFromCatalog(etapaSlug, crmBundle, etapaLabels) ??
    etapaLabels[etapaSlug as keyof typeof etapaLabels] ??
    etapaSlug;

  const contactAsUi = useMemo(
    () => (contact ? contactoClienteRowToContact(contact) : null),
    [contact],
  );

  useEffect(() => {
    if (!contact?.id) {
      setTimelineEvents([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    const empresaFetches = (contact.empresas ?? []).map((e) =>
      fetchActivityLogs({
        entityType: 'ClienteEmpresa',
        entityId: e.id,
        page: 1,
        limit: 40,
      }).catch(() => ({ data: [] as Awaited<ReturnType<typeof fetchActivityLogs>>['data'] })),
    );
    Promise.all([
      fetchActivityLogs({
        entityType: 'ContactoCliente',
        entityId: contact.id,
        page: 1,
        limit: 80,
      }).catch(() => ({ data: [] as Awaited<ReturnType<typeof fetchActivityLogs>>['data'] })),
      ...empresaFetches,
    ])
      .then((results) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged = results
          .flatMap((r) => r.data)
          .map(activityLogToTimelineEvent)
          .filter((event) => {
            if (seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        setTimelineEvents(merged);
      })
      .catch(() => {
        if (!cancelled) setTimelineEvents([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => { cancelled = true; };
  }, [contact?.id, contact?.empresas]);

  const persistedActivities = useMemo(() => {
    if (!contact?.id) return [];
    return activitiesFromStore.filter((activity) => {
      if (activity.type === 'tarea') return false;
      return activityMatchesEntityFilter(activity, {
        contactoClienteId: contact.id,
        clienteEmpresaId: primaryEmpresa?.id,
      });
    });
  }, [activitiesFromStore, contact?.id, primaryEmpresa?.id]);

  useEffect(() => {
    setContactActivities(persistedActivities);
  }, [persistedActivities]);

  const noteActivities = useMemo(
    () => contactActivities.filter((activity) => activity.type === 'nota'),
    [contactActivities],
  );

  const followUpAssociations = useMemo(() => {
    const out: import('@/types').TaskAssociation[] = [];
    if (primaryEmpresa) {
      out.push({
        type: 'cliente_empresa',
        id: primaryEmpresa.id,
        name: primaryEmpresa.empresa,
      });
    }
    if (contact) {
      out.push({
        type: 'cliente_contacto',
        id: contact.id,
        name: contact.nombre,
      });
    }
    return out;
  }, [primaryEmpresa, contact]);

  const refreshTimeline = useCallback(async () => {
    if (!contact?.id) return;
    const empresaFetches = (contact.empresas ?? []).map((e) =>
      fetchActivityLogs({
        entityType: 'ClienteEmpresa',
        entityId: e.id,
        page: 1,
        limit: 40,
      }).catch(() => ({ data: [] as Awaited<ReturnType<typeof fetchActivityLogs>>['data'] })),
    );
    const results = await Promise.all([
      fetchActivityLogs({
        entityType: 'ContactoCliente',
        entityId: contact.id,
        page: 1,
        limit: 80,
      }).catch(() => ({ data: [] as Awaited<ReturnType<typeof fetchActivityLogs>>['data'] })),
      ...empresaFetches,
    ]);
    const seen = new Set<string>();
    const merged = results
      .flatMap((r) => r.data)
      .map(activityLogToTimelineEvent)
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    setTimelineEvents(merged);
  }, [contact?.id, contact?.empresas]);

  const handleQuickActivityCreated = useCallback((draft: QuickActivityDraft) => {
    if (!contact) {
      toast.error('Contacto no disponible');
      throw new Error('missing_contact');
    }
    if (!primaryEmpresa) {
      toast.error('Vincula una empresa cliente para registrar actividades');
      throw new Error('missing_empresa');
    }

    const assignedTo = contact.assignedTo || activeAdvisors[0]?.id;
    if (!assignedTo) {
      toast.error('No hay usuario interno para asignar la actividad');
      throw new Error('missing_assignee');
    }

    const assignedToName =
      users.find((user) => user.id === assignedTo)?.name ??
      contact.assignedToName ??
      'Sin asignar';
    const optimisticId = `temp-activity-${Date.now()}`;

    setContactActivities((prev) => [
      {
        id: optimisticId,
        type: draft.type,
        title: draft.title,
        description: draft.description,
        assignedTo,
        assignedToName,
        status: 'completada',
        dueDate: draft.dueDate,
        startDate: draft.startDate,
        startTime: draft.startTime,
        completedAt: completedAtNowIso(),
        createdAt: new Date().toISOString().slice(0, 10),
        clienteEmpresaId: primaryEmpresa.id,
        clienteEmpresaName: primaryEmpresa.empresa,
        contactoClienteId: contact.id,
        contactoClienteName: contact.nombre,
      },
      ...prev,
    ]);

    void createActivity({
      type: draft.type,
      title: draft.title,
      description: draft.description,
      assignedTo,
      status: 'completada',
      dueDate: draft.dueDate,
      startDate: draft.startDate,
      startTime: draft.startTime,
      completedAt: completedAtNowIso(),
      clienteEmpresaId: primaryEmpresa.id,
      contactoClienteId: contact.id,
      clienteEmpresaIds: [primaryEmpresa.id],
      contactoClienteIds: [contact.id],
    })
      .then((saved) => {
        setContactActivities((prev) => [
          saved,
          ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
        ]);
        void refreshTimeline();
      })
      .catch((err) => {
        setContactActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
        toast.error(err instanceof Error ? err.message : 'No se pudo guardar la actividad');
      });
  }, [contact, primaryEmpresa, activeAdvisors, users, createActivity, refreshTimeline]);

  function handleAddNote() {
    const description = noteText.trim();
    if (!description) return;
    try {
      handleQuickActivityCreated({
        type: 'nota',
        title: 'Nota',
        description,
        dueDate: new Date().toISOString().slice(0, 10),
      });
      setNoteText('');
      toast.success('Nota agregada correctamente');
    } catch {
      /* handleQuickActivityCreated ya notifica */
    }
  }

  async function handleEtapaChange(nextEtapa: string) {
    if (!contact) return;
    try {
      const updated = await updateContactoCliente(contact.id, { etapa: nextEtapa });
      setContact(updated);
      toast.success('Etapa actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la etapa');
    }
  }

  async function handleSaveContact(payload: ContactEditSavePayload) {
    if (!contact) return;
    try {
      const updated = await updateContactoCliente(
        contact.id,
        contactEditPayloadToClienteUpdate(payload),
      );
      setContact(updated);
      setEditDialogOpen(false);
      toast.success('Contacto actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  const loadEmpresasForLink = useCallback(async () => {
    try {
      const rows = await fetchClienteEmpresas();
      setAllEmpresas(rows.map((e) => ({ id: e.id, empresa: e.empresa })));
    } catch {
      setAllEmpresas([]);
    }
  }, []);

  useEffect(() => {
    if (linkDialogOpen) void loadEmpresasForLink();
  }, [linkDialogOpen, loadEmpresasForLink]);

  const linkedEmpresaIdSet = useMemo(
    () => new Set(contact?.empresas.map((e) => e.id) ?? []),
    [contact?.empresas],
  );

  const linkableItems = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return allEmpresas
      .filter((e) => !linkedEmpresaIdSet.has(e.id))
      .filter((e) => !q || e.empresa.toLowerCase().includes(q))
      .map((e) => ({
        id: e.id,
        title: e.empresa,
      }));
  }, [allEmpresas, linkedEmpresaIdSet, linkSearch]);

  async function handleLinkConfirm() {
    if (!contact || selectedLinkIds.length === 0) return;
    setLinking(true);
    try {
      for (const empresaId of selectedLinkIds) {
        await linkContactoToClienteEmpresa(empresaId, contact.id);
      }
      const updated = await fetchContactoClienteById(contact.id);
      setContact(updated);
      setLinkDialogOpen(false);
      setSelectedLinkIds([]);
      setLinkSearch('');
      toast.success('Empresa(s) vinculada(s)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkEmpresa(empresa: { id: string; empresa: string }) {
    if (!contact) return;
    try {
      await unlinkContactoFromClienteEmpresa(empresa.id, contact.id);
      const updated = await fetchContactoClienteById(contact.id);
      setContact(updated);
      toast.success('Empresa desvinculada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
    }
  }

  const totalTimelinePages = useMemo(
    () => Math.max(1, Math.ceil(timelineEvents.length / TIMELINE_PAGE_SIZE)),
    [timelineEvents.length],
  );

  const paginatedTimelineEvents = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return timelineEvents.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [timelineEvents, timelinePage]);

  useEffect(() => {
    setTimelinePage(1);
  }, [timelineEvents.length]);

  if (loading) {
    return <EntityDetailPageSkeleton ariaLabel="Cargando contacto cliente" />;
  }

  if (error || !contact || !contactAsUi) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(APP_PATHS.clientContacts)}>
          <UserPlus className="size-4" /> Volver a Contactos
        </Button>
        <EmptyState
          icon={UserPlus}
          title="Contacto no encontrado"
          description={error ?? 'El contacto que buscas no existe o no tienes acceso.'}
          actionLabel="Volver a Contactos"
          onAction={() => navigate(APP_PATHS.clientContacts)}
        />
      </div>
    );
  }

  const primaryEmpresaName = primaryEmpresa?.empresa;

  return (
    <>
      <DetailLayout
        backPath={APP_PATHS.clientContacts}
        title={contact.nombre}
        subtitle={contact.cargo ?? undefined}
        header={(
          <ContactHeader
            backPath={APP_PATHS.clientContacts}
            name={contact.nombre}
            subtitle={contact.cargo ?? undefined}
            company={primaryEmpresaName}
            assignedToName={contact.assignedToName}
            stageLabel={stageLabel}
            stageClassName={stageTone.className}
            stageStyle={stageTone.style}
            currentEtapaSlug={etapaSlug}
            onEtapaChange={(slug) => void handleEtapaChange(slug)}
            quickActions={primaryEmpresa ? (
              <QuickActionsWithDialogs
                entityName={contact.nombre}
                clienteEmpresaId={primaryEmpresa.id}
                clienteEmpresaName={primaryEmpresa.empresa}
                contactoClienteId={contact.id}
                contactoClienteName={contact.nombre}
                followUpAssociations={followUpAssociations}
                onActivityCreated={handleQuickActivityCreated}
                inline
              />
            ) : undefined}
            onEdit={() => setEditDialogOpen(true)}
            onOpenWhatsapp={() => setWhatsappDrawerOpen(true)}
          />
        )}
        leftAside={(
          <EntityInfoCard
            title="Información"
            collapsible
            fields={[
              ...(contact.assignedToName
                ? [{ icon: UsersGroupTwoRoundedSvgIcon, value: contact.assignedToName }]
                : []),
              ...(contact.telefono?.trim()
                ? [{
                    icon: LlamadaSvgIcon,
                    value: contact.telefono.trim(),
                    href: `tel:${contact.telefono.trim()}`,
                  }]
                : []),
              ...(contact.email?.trim()
                ? [{
                    icon: LetterSvgIcon,
                    value: contact.email.trim(),
                    href: `mailto:${contact.email.trim()}`,
                  }]
                : []),
              ...(primaryEmpresaName
                ? [{
                    icon: Buildings2SvgIcon,
                    value: primaryEmpresaName,
                    truncate: true,
                    label: 'Empresa:',
                  }]
                : []),
              {
                icon: MapArrowSquareSvgIcon,
                value: getSourceLabelFromCatalog(
                  contact.source ?? 'base',
                  crmBundle,
                  contactSourceLabels,
                ),
              },
              {
                icon: CalendarSvgIcon,
                value: `Fecha de creación: ${formatDate(contact.createdAt)}`,
              },
              ...(contact.direccion?.trim()
                ? [{ icon: MapArrowSquareSvgIcon, value: contact.direccion.trim() }]
                : []),
            ]}
          />
        )}
        sidebar={(
          <LinkedClienteEmpresasCard
            empresas={contact.empresas}
            maxItems={5}
            onAddExisting={() => setLinkDialogOpen(true)}
            onRemove={(e) => void handleUnlinkEmpresa(e)}
          />
        )}
      >
        <Tabs value={detailSectionTab} onValueChange={setDetailSectionTab}>
          <div className="md:hidden space-y-1.5">
            <label htmlFor="cliente-contacto-detail-section" className="text-xs font-medium text-muted-foreground">
              Sección
            </label>
            <select
              id="cliente-contacto-detail-section"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={detailSectionTab}
              onChange={(e) => setDetailSectionTab(e.target.value)}
            >
              {CLIENTE_DETAIL_TABS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <TabsList
            variant="line"
            className="hidden max-w-full w-full overflow-x-auto justify-start md:inline-flex"
          >
            {CLIENTE_DETAIL_TABS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="text-xs px-2 sm:text-sm sm:px-4">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="historial" className="mt-4">
            <Card>
              <CardContent className="p-3 sm:p-5">
                {timelineLoading ? (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="Sin actividad registrada"
                    description="Los cambios y actividades sobre las empresas vinculadas aparecerán aquí."
                  />
                ) : (
                  <div className="space-y-4">
                    <TimelinePanel events={paginatedTimelineEvents} />
                    <div className="-mx-4 flex flex-col gap-3 border-t border-border/60 px-4 pt-4 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {Math.min((timelinePage - 1) * TIMELINE_PAGE_SIZE + 1, timelineEvents.length)}
                        {' '}a {Math.min(timelinePage * TIMELINE_PAGE_SIZE, timelineEvents.length)} de {timelineEvents.length} eventos
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimelinePage((page) => Math.max(1, page - 1))}
                          disabled={timelinePage === 1}
                        >
                          <ChevronLeft className="size-4" />
                          Anterior
                        </Button>
                        <span className="min-w-[72px] text-center text-xs text-muted-foreground">
                          {timelinePage} / {totalTimelinePages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimelinePage((page) => Math.min(totalTimelinePages, page + 1))}
                          disabled={timelinePage === totalTimelinePages}
                        >
                          Siguiente
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actividades" className="mt-4">
            {!primaryEmpresa ? (
              <EmptyState
                icon={UserPlus}
                title="Sin empresa vinculada"
                description="Vincula una empresa cliente para registrar actividades."
              />
            ) : (
              <ActivityPanel
                activities={contactActivities}
                onUpdateActivity={updateActivity}
                onDeleteActivity={deleteActivity}
              />
            )}
          </TabsContent>

          <TabsContent value="tareas" className="mt-4">
            {!primaryEmpresa ? (
              <EmptyState
                icon={UserPlus}
                title="Sin empresa vinculada"
                description="Vincula una empresa cliente para gestionar tareas."
              />
            ) : (
              <TasksTab
                ref={tasksTabRef}
                defaultAssigneeId={contact.assignedTo}
                clienteEmpresaId={primaryEmpresa.id}
                clienteEmpresaName={primaryEmpresa.empresa}
                contactoClienteId={contact.id}
                contactoClienteName={contact.nombre}
              />
            )}
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            {!primaryEmpresa ? (
              <EmptyState
                icon={UserPlus}
                title="Sin empresa vinculada"
                description="Vincula una empresa cliente para agregar notas."
              />
            ) : (
              <EntityNotesTab
                notes={noteActivities}
                noteText={noteText}
                onNoteTextChange={setNoteText}
                onAddNote={handleAddNote}
                onUpdateActivity={updateActivity}
                onDeleteActivity={deleteActivity}
              />
            )}
          </TabsContent>
        </Tabs>
      </DetailLayout>

      <LinkExistingDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        title="Vincular empresa"
        searchPlaceholder="Buscar empresa cliente…"
        itemKind="empresa"
        leadName={contact.nombre}
        items={linkableItems}
        selectedIds={selectedLinkIds}
        onSelectionChange={setSelectedLinkIds}
        onConfirm={() => void handleLinkConfirm()}
        searchValue={linkSearch}
        onSearchChange={setLinkSearch}
        confirmLabel={linking ? 'Vinculando…' : 'Vincular'}
      />

      <ContactEditDialog
        contact={contactAsUi}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={(payload) => void handleSaveContact(payload)}
        canEditAssignee={canEditAssignee}
      />

      <WhatsappContactDrawer
        open={whatsappDrawerOpen}
        onOpenChange={setWhatsappDrawerOpen}
        contact={contactAsUi as Contact}
      />
    </>
  );
}
