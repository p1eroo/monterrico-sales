import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Phone, Mail, User, Hash, CalendarDays, Briefcase, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Activity, TimelineEvent } from '@/types';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import type { LinkedContact } from '@/components/shared/LinkedContactsCard';
import { LinkExistingDialog } from '@/components/shared/LinkExistingDialog';
import {
  NewContactWizard,
  type NewContactData,
} from '@/components/shared/NewContactWizard';
import { CompanyHeader } from '@/components/company-detail/CompanyHeader';
import { ClienteEmpresaMetricsCard } from '@/components/cliente-cartera/ClienteEmpresaMetricsCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { EntityNotesTab } from '@/components/shared/EntityNotesTab';
import {
  QuickActionsWithDialogs,
  type QuickActivityDraft,
} from '@/components/shared/QuickActionsWithDialogs';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/formatters';
import { toast } from '@/lib/notify';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useActivities } from '@/hooks/useActivities';
import { useUsers } from '@/hooks/useUsers';
import {
  createContactoCliente,
  fetchClienteEmpresaById,
  fetchContactosCliente,
  linkContactoToClienteEmpresa,
  unlinkContactoFromClienteEmpresa,
  type ClienteEmpresaDetail,
  type ClienteEmpresaLinkedContacto,
  type ContactoClienteRow,
} from '@/lib/clienteCarteraApi';
import { newContactDataToClienteBody } from '@/lib/clienteContactoFormUtils';
import { APP_PATHS, clienteEmpresaDetailHref } from '@/lib/detailRoutes';

const TIMELINE_PAGE_SIZE = 8;

const CLIENTE_DETAIL_TABS = [
  { value: 'historial', label: 'Historial' },
  { value: 'actividades', label: 'Actividades' },
  { value: 'tareas', label: 'Tareas' },
  { value: 'notas', label: 'Notas' },
] as const;

function getDomainFromEmail(email?: string): string | null {
  if (!email) return null;
  const match = email.match(/@([\w.-]+\.[a-z]{2,})/i);
  return match ? match[1] : null;
}

function mapToLinkedContact(contact: ClienteEmpresaLinkedContacto): LinkedContact {
  return {
    id: contact.id,
    name: contact.nombre,
    cargo: contact.cargo,
    etapa: 'cliente',
    telefono: contact.telefono,
    correo: contact.email,
  };
}

export default function ClienteEmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users, activeAdvisors } = useUsers();
  const {
    activities: activitiesFromStore,
    createActivity,
    updateActivity,
    deleteActivity,
  } = useActivities();

  const [empresa, setEmpresa] = useState<ClienteEmpresaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailSectionTab, setDetailSectionTab] = useState<string>('historial');
  const [companyActivities, setCompanyActivities] = useState<Activity[]>([]);
  const [noteText, setNoteText] = useState('');

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [allContactos, setAllContactos] = useState<ContactoClienteRow[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);

  const tasksTabRef = useRef<TasksTabHandle>(null);

  const loadEmpresa = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClienteEmpresaById(id);
      setEmpresa(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar la empresa';
      setError(msg);
      setEmpresa(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadEmpresa();
  }, [loadEmpresa]);

  useEffect(() => {
    if (!empresa) return;
    const slugPath = clienteEmpresaDetailHref({ empresa: empresa.empresa });
    if (window.location.pathname !== slugPath) {
      navigate(slugPath, { replace: true });
    }
  }, [empresa, navigate]);

  useEffect(() => {
    if (!empresa?.id) {
      setTimelineEvents([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    fetchActivityLogs({
      entityType: 'ClienteEmpresa',
      entityId: empresa.id,
      page: 1,
      limit: 80,
    })
      .then((r) => {
        if (!cancelled) setTimelineEvents(r.data.map(activityLogToTimelineEvent));
      })
      .catch(() => {
        if (!cancelled) setTimelineEvents([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => { cancelled = true; };
  }, [empresa?.id]);

  const persistedActivities = useMemo(() => {
    if (!empresa?.id) return [];
    return activitiesFromStore.filter((activity) => {
      if (activity.type === 'tarea') return false;
      return activity.clienteEmpresaId === empresa.id;
    });
  }, [activitiesFromStore, empresa?.id]);

  useEffect(() => {
    setCompanyActivities(persistedActivities);
  }, [persistedActivities]);

  const noteActivities = useMemo(
    () => companyActivities.filter((activity) => activity.type === 'nota'),
    [companyActivities],
  );

  const linkedContacts = useMemo(
    () => (empresa?.contactos ?? []).map(mapToLinkedContact),
    [empresa?.contactos],
  );

  const primaryContact = empresa?.contactos.find((c) => c.isPrimary) ?? empresa?.contactos[0];

  const followUpAssociations = useMemo(() => {
    if (!empresa) return [];
    return [{ type: 'cliente_empresa' as const, id: empresa.id, name: empresa.empresa }];
  }, [empresa]);

  const handleQuickActivityCreated = useCallback((draft: QuickActivityDraft) => {
    if (!empresa) return;
    const assignedTo =
      empresa.assignedTo ||
      activeAdvisors[0]?.id;

    if (!assignedTo) {
      toast.error('No hay usuario interno para asignar la actividad');
      throw new Error('missing_assignee');
    }

    const assignedToName =
      users.find((user) => user.id === assignedTo)?.name ??
      empresa.assignedToName ??
      'Sin asignar';
    const optimisticId = `temp-activity-${Date.now()}`;

    setCompanyActivities((prev) => [
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
        completedAt: draft.dueDate,
        createdAt: new Date().toISOString().slice(0, 10),
        clienteEmpresaId: empresa.id,
        clienteEmpresaName: empresa.empresa,
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
      completedAt: draft.dueDate,
      clienteEmpresaId: empresa.id,
    })
      .then((saved) => {
        setCompanyActivities((prev) => [
          saved,
          ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
        ]);
        void fetchActivityLogs({
          entityType: 'ClienteEmpresa',
          entityId: empresa.id,
          page: 1,
          limit: 80,
        }).then((r) => setTimelineEvents(r.data.map(activityLogToTimelineEvent)));
      })
      .catch((err) => {
        setCompanyActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
        toast.error(err instanceof Error ? err.message : 'No se pudo guardar la actividad');
      });
  }, [empresa, activeAdvisors, users, createActivity]);

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

  const loadContactosForLink = useCallback(async () => {
    try {
      const rows = await fetchContactosCliente();
      setAllContactos(rows);
    } catch {
      setAllContactos([]);
    }
  }, []);

  useEffect(() => {
    if (linkDialogOpen) void loadContactosForLink();
  }, [linkDialogOpen, loadContactosForLink]);

  const linkedIds = useMemo(
    () => new Set((empresa?.contactos ?? []).map((c) => c.id)),
    [empresa?.contactos],
  );

  const linkableItems = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return allContactos
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return (
          c.nombre.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.telefono ?? '').includes(q) ||
          (c.cargo ?? '').toLowerCase().includes(q)
        );
      })
      .map((c) => ({
        id: c.id,
        title: c.nombre,
        subtitle: [c.cargo, c.email].filter(Boolean).join(' · ') || undefined,
      }));
  }, [allContactos, linkedIds, linkSearch]);

  async function handleLinkConfirm() {
    if (!empresa || selectedLinkIds.length === 0) return;
    setLinking(true);
    try {
      let latest = empresa;
      for (const contactoId of selectedLinkIds) {
        latest = await linkContactoToClienteEmpresa(empresa.id, contactoId);
      }
      setEmpresa(latest);
      setLinkDialogOpen(false);
      setSelectedLinkIds([]);
      setLinkSearch('');
      toast.success('Contacto(s) vinculado(s)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(contact: LinkedContact) {
    if (!empresa) return;
    try {
      const updated = await unlinkContactoFromClienteEmpresa(empresa.id, contact.id);
      setEmpresa(updated);
      toast.success('Contacto desvinculado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
    }
  }

  async function onSubmitNewContact(data: NewContactData) {
    if (!empresa) return;
    try {
      await createContactoCliente(
        newContactDataToClienteBody(data, {
          clienteEmpresaId: empresa.id,
          isPrimary: true,
        }),
      );
      const updated = await fetchClienteEmpresaById(empresa.id);
      setEmpresa(updated);
      setCreateDialogOpen(false);
      toast.success('Contacto creado y vinculado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto');
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
    return <EntityDetailPageSkeleton ariaLabel="Cargando empresa cliente" />;
  }

  if (error || !empresa) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(APP_PATHS.clientCompanies)}>
          <Building2 className="size-4" /> Volver a Clientes
        </Button>
        <EmptyState
          icon={Building2}
          title="Empresa no encontrada"
          description={error ?? 'La empresa que buscas no existe o no tienes acceso.'}
          actionLabel="Volver a Clientes"
          onAction={() => navigate(APP_PATHS.clientCompanies)}
        />
      </div>
    );
  }

  const emailDomain = getDomainFromEmail(empresa.email);
  const subtitle = emailDomain ?? undefined;

  return (
    <>
      <DetailLayout
        backPath={APP_PATHS.clientCompanies}
        title={empresa.empresa}
        subtitle={subtitle}
        header={(
          <CompanyHeader
            backPath={APP_PATHS.clientCompanies}
            name={empresa.empresa}
            subtitle={subtitle}
            stageLabel=""
            currentEtapaSlug=""
            estimatedValueLabel=""
            showStage={false}
            quickActions={(
              <QuickActionsWithDialogs
                entityName={empresa.empresa}
                clienteEmpresaId={empresa.id}
                clienteEmpresaName={empresa.empresa}
                followUpAssociations={followUpAssociations}
                onActivityCreated={handleQuickActivityCreated}
                inline
              />
            )}
          />
        )}
        leftAside={(
          <>
            <EntityInfoCard
              title="Información"
              collapsible
              fields={[
                { icon: Building2, value: empresa.empresa, truncate: true },
                ...(empresa.ruc?.trim() ? [{ icon: Hash, value: empresa.ruc.trim() }] : []),
                ...(empresa.telefono
                  ? [{ icon: Phone, value: empresa.telefono, href: `tel:${empresa.telefono}` }]
                  : []),
                ...(empresa.email?.trim()
                  ? [{ icon: Mail, value: empresa.email.trim(), href: `mailto:${empresa.email.trim()}` }]
                  : []),
                { icon: User, value: empresa.assignedToName },
                { icon: CalendarDays, value: `Alta: ${formatDate(empresa.fechaAlta)}` },
                ...(empresa.servicio ? [{ icon: Briefcase, value: empresa.servicio }] : []),
                ...(empresa.contactoNombre
                  ? [{ icon: User, value: empresa.contactoNombre, label: 'Contacto ref.:' }]
                  : []),
              ]}
            />
            <ClienteEmpresaMetricsCard empresa={empresa} />
          </>
        )}
        sidebar={(
          <LinkedContactsCard
            contacts={linkedContacts}
            title="Contactos"
            maxItems={5}
            onCreate={() => setCreateDialogOpen(true)}
            onAddExisting={() => setLinkDialogOpen(true)}
            onRemove={(c) => void handleUnlink(c)}
            onContactNavigate={() => {
              toast.info('Gestiona este contacto desde Clientes → Contactos.');
            }}
          />
        )}
      >
        <Tabs value={detailSectionTab} onValueChange={setDetailSectionTab}>
          <div className="md:hidden space-y-1.5">
            <label htmlFor="cliente-empresa-detail-section" className="text-xs font-medium text-muted-foreground">
              Sección
            </label>
            <select
              id="cliente-empresa-detail-section"
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
                    icon={Building2}
                    title="Sin actividad registrada"
                    description="Los cambios y actividades sobre esta empresa cliente aparecerán aquí."
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
            <ActivityPanel
              activities={companyActivities}
              onUpdateActivity={updateActivity}
              onDeleteActivity={deleteActivity}
            />
          </TabsContent>

          <TabsContent value="tareas" className="mt-4">
            <TasksTab
              ref={tasksTabRef}
              defaultAssigneeId={empresa.assignedTo}
              clienteEmpresaId={empresa.id}
              contactId={primaryContact?.id}
            />
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <EntityNotesTab
              notes={noteActivities}
              noteText={noteText}
              onNoteTextChange={setNoteText}
              onAddNote={handleAddNote}
              onUpdateActivity={updateActivity}
              onDeleteActivity={deleteActivity}
            />
          </TabsContent>
        </Tabs>
      </DetailLayout>

      <LinkExistingDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        title="Vincular contacto existente"
        searchPlaceholder="Buscar por nombre, email o cargo…"
        leadName={empresa.empresa}
        items={linkableItems}
        selectedIds={selectedLinkIds}
        onSelectionChange={setSelectedLinkIds}
        onConfirm={() => void handleLinkConfirm()}
        searchValue={linkSearch}
        onSearchChange={setLinkSearch}
        confirmLabel={linking ? 'Vinculando…' : 'Vincular'}
      />

      <NewContactWizard
        variant="cliente-cartera"
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={onSubmitNewContact}
        lockCompanySelection
        defaultCompanyId={empresa?.id}
        defaultValues={empresa ? { company: empresa.empresa, companyId: empresa.id } : undefined}
        title="Nuevo contacto"
        description="Registra un nuevo contacto de cartera."
        submitLabel="Crear y vincular"
      />
    </>
  );
}
