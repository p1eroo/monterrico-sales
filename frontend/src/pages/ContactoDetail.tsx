import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone, Mail, Users,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  FileArchive, Loader2, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Contact, Etapa, CompanyRubro, CompanyTipo, TimelineEvent } from '@/types';
import {
  contactSourceLabels, etapaLabels,
  companyRubroLabels,
  activities,
} from '@/data/mock';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useActivities } from '@/hooks/useActivities';
import { useUsers } from '@/hooks/useUsers';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { getPrimaryCompany } from '@/lib/utils';

import { EmptyState } from '@/components/shared/EmptyState';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { QuickActionsWithDialogs, type QuickActivityDraft } from '@/components/shared/QuickActionsWithDialogs';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { WhatsappContactDrawer } from '@/components/shared/WhatsappContactDrawer';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ContactEditDialog, type ContactEditSavePayload } from '@/components/shared/ContactEditDialog';
import { EntityFilesTab } from '@/components/files';
import { ContactHeader } from '@/components/contact-detail/ContactHeader';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { isEntityDetailApiParam } from '@/lib/detailRoutes';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  contactAddCompany,
  contactRemoveCompany,
  isLikelyContactCuid,
  mapApiContactDetailToContact,
  mapApiContactRowToContact,
  opportunitiesFromApiContactDetail,
  contactListAll,
} from '@/lib/contactApi';
import {
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import { type ApiCompanyRecord, companyListAll } from '@/lib/companyApi';
import { useStageBadgeTone } from '@/hooks/useStageBadgeTone';
import { useCrmConfigStore, getStageLabelFromCatalog } from '@/store/crmConfigStore';

const TIMELINE_PAGE_SIZE = 6;

function ContactoSidebar({ contact, contactOpportunities, onOpenConvertDialog, onAddExistingOpportunity, onRemoveOpportunity, onAddCompany, onAddExistingCompany, onRemoveCompany }: {
  contact: Contact;
  contactOpportunities: import('@/types').Opportunity[];
  onOpenConvertDialog: () => void;
  onAddExistingOpportunity: () => void;
  onRemoveOpportunity?: (opp: import('@/types').Opportunity) => void;
  onAddCompany: () => void;
  onAddExistingCompany: () => void;
  onRemoveCompany?: (company: import('@/types').LinkedCompany) => void;
}) {
  return (
    <>
      <EntityInfoCard
        title="Información"
        collapsible
        fields={[
          { icon: Phone, value: contact.telefono, href: `tel:${contact.telefono}` },
          { icon: Mail, value: contact.correo, href: `mailto:${contact.correo}` },
          {
            icon: Building2,
            value: getPrimaryCompany(contact)?.name ?? '—',
            truncate: true,
          },
          { icon: Globe, value: contactSourceLabels[contact.fuente] },
          { icon: CalendarDays, value: `Fecha de creación: ${formatDate(contact.createdAt)}` },
          ...(contact.direccion?.trim()
            ? [
                {
                  icon: MapPin as typeof Phone,
                  value: contact.direccion.trim(),
                  truncate: true,
                },
              ]
            : []),
        ]}
      />

      <LinkedOpportunitiesCard
        opportunities={contactOpportunities}
        onCreate={onOpenConvertDialog}
        onAddExisting={onAddExistingOpportunity}
        onRemove={onRemoveOpportunity}
      />

      <LinkedCompaniesCard
        companies={contact.companies ?? []}
        onCreate={onAddCompany}
        onAddExisting={onAddExistingCompany}
        onRemove={onRemoveCompany}
        etapa={contact.etapa}
      />
    </>
  );
}

export default function ContactoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeId = id ? decodeURIComponent(id) : '';
  const fromApi = isEntityDetailApiParam(routeId);
  const { contacts, opportunities, getOpportunitiesByContactId, addOpportunity, updateOpportunity, updateContact } = useCRMStore();
  const { users, activeAdvisors } = useUsers();
  const crmBundle = useCrmConfigStore((s) => s.bundle);
  const { activities: activitiesFromStore, createActivity } = useActivities();

  const [apiRecord, setApiRecord] = useState<ApiContactDetail | null>(null);
  const [apiLoading, setApiLoading] = useState(fromApi);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiContactsList, setApiContactsList] = useState<ApiContactListRow[]>([]);
  const [apiCompaniesList, setApiCompaniesList] = useState<ApiCompanyRecord[]>([]);
  const [apiOpportunitiesList, setApiOpportunitiesList] = useState<ApiOpportunityListRow[]>([]);

  const refreshApiContact = useCallback(async () => {
    if (!fromApi || !routeId) return;
    try {
      const row = await api<ApiContactDetail>(`/contacts/${routeId}`);
      setApiRecord(row);
    } catch {
      /* noop */
    }
  }, [fromApi, routeId]);

  useEffect(() => {
    if (!fromApi || !routeId) {
      setApiLoading(false);
      setApiRecord(null);
      setApiError(null);
      return;
    }
    let cancelled = false;
    setApiLoading(true);
    setApiError(null);
    api<ApiContactDetail>(`/contacts/${routeId}`)
      .then((row) => {
        if (!cancelled) setApiRecord(row);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setApiRecord(null);
          setApiError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi, routeId]);

  useEffect(() => {
    if (!fromApi) {
      setApiContactsList([]);
      setApiCompaniesList([]);
      setApiOpportunitiesList([]);
      return;
    }
    let cancelled = false;
    Promise.all([contactListAll(), companyListAll(), opportunityListAll()])
      .then(([contactsList, companiesList, oppsList]) => {
        if (!cancelled) {
          setApiContactsList(contactsList);
          setApiCompaniesList(companiesList);
          setApiOpportunitiesList(oppsList);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiContactsList([]);
          setApiCompaniesList([]);
          setApiOpportunitiesList([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi]);

  const storeContact = contacts.find((l) => l.id === routeId);

  const contact = useMemo(() => {
    if (fromApi) {
      if (!apiRecord) return undefined;
      return mapApiContactDetailToContact(apiRecord);
    }
    return storeContact;
  }, [fromApi, apiRecord, storeContact]);

  const mergedContacts = useMemo(() => {
    if (fromApi) {
      return apiContactsList.map(mapApiContactRowToContact);
    }
    const byId = new Map<string, Contact>();
    for (const r of apiContactsList) {
      byId.set(r.id, mapApiContactRowToContact(r));
    }
    for (const c of contacts) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    return Array.from(byId.values());
  }, [fromApi, apiContactsList, contacts]);

  const initialActivities = useMemo(
    () => activities.filter((a) => a.contactId === routeId),
    [routeId],
  );

  const persistedContactActivities = useMemo(() => activitiesFromStore.filter((activity) => {
    if (activity.type === 'tarea') return false;
    if (contact?.id && activity.contactId === contact.id) return true;
    const primaryCompanyId = contact ? getPrimaryCompany(contact)?.id : undefined;
    return !!primaryCompanyId && activity.companyId === primaryCompanyId;
  }), [activitiesFromStore, contact]);

  const contactOpportunities = useMemo(() => {
    if (fromApi && apiRecord?.opportunities?.length) {
      return opportunitiesFromApiContactDetail(apiRecord);
    }
    return routeId ? getOpportunitiesByContactId(routeId) : [];
  }, [fromApi, apiRecord, routeId, getOpportunitiesByContactId]);

  const defaultContactIdForNewOpp = useMemo(
    () => contact?.id ?? '',
    [contact?.id],
  );

  const defaultCompanyIdForNewOpp = useMemo(() => {
    if (!contact) return '';
    const pc = getPrimaryCompany(contact);
    return pc?.id ?? '';
  }, [contact]);

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [contactActivities, setContactActivities] = useState(initialActivities);
  const currentUserRole = useAppStore((s) => s.currentUser.role ?? '');
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addExistingOpportunityOpen, setAddExistingOpportunityOpen] = useState(false);
  const [linkOpportunityIds, setLinkOpportunityIds] = useState<string[]>([]);
  const [linkOpportunitySearch, setLinkOpportunitySearch] = useState('');
  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (fromApi) {
      setContactActivities(persistedContactActivities);
      return;
    }
    setContactActivities(initialActivities);
  }, [fromApi, initialActivities, persistedContactActivities]);

  const handleQuickActivityCreated = useCallback((draft: QuickActivityDraft) => {
    if (!contact) return;

    const assignedTo = contact.assignedTo || activeAdvisors[0]?.id;
    if (!assignedTo) {
      toast.error('No hay usuario interno para asignar la actividad');
      throw new Error('missing_assignee');
    }

    const companyId = getPrimaryCompany(contact)?.id;
    const persistedContactId = isLikelyContactCuid(contact.id) ? contact.id : undefined;
    const persistedCompanyId = companyId && /^c[a-z0-9]+$/i.test(companyId) ? companyId : undefined;

    if (!persistedContactId && !persistedCompanyId) {
      const fallbackAssigneeName = users.find((user) => user.id === assignedTo)?.name ?? contact.assignedToName ?? 'Sin asignar';
      setContactActivities((prev) => [
        {
          id: `act-${Date.now()}`,
          type: draft.type,
          title: draft.title,
          description: draft.description,
          assignedTo,
          assignedToName: fallbackAssigneeName,
          status: 'completada',
          dueDate: draft.dueDate,
          startDate: draft.startDate,
          startTime: draft.startTime,
          createdAt: new Date().toISOString().slice(0, 10),
          contactId: contact.id,
        },
        ...prev,
      ]);
      toast.info('Actividad guardada solo localmente porque este contacto no existe en la API');
      return;
    }

    const assignedToName = users.find((user) => user.id === assignedTo)?.name ?? contact.assignedToName ?? 'Sin asignar';
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
        completedAt: draft.dueDate,
        createdAt: new Date().toISOString().slice(0, 10),
        contactId: persistedContactId ?? contact.id,
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
      contactId: persistedContactId,
      companyId: persistedCompanyId,
    })
      .then((saved) => {
        setContactActivities((prev) => [
          saved,
          ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
        ]);
      })
      .catch((error) => {
        setContactActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar la actividad');
      });
  }, [contact, activeAdvisors, users, createActivity]);

  const noteActivities = useMemo(
    () => contactActivities.filter((activity) => activity.type === 'nota'),
    [contactActivities],
  );

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
      /* handleQuickActivityCreated ya notifica el error */
    }
  }

  const [contactTimelineEvents, setContactTimelineEvents] = useState<TimelineEvent[]>([]);
  const [contactTimelineLoading, setContactTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  const totalTimelinePages = useMemo(
    () => Math.max(1, Math.ceil(contactTimelineEvents.length / TIMELINE_PAGE_SIZE)),
    [contactTimelineEvents.length],
  );

  const paginatedTimelineEvents = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return contactTimelineEvents.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [contactTimelineEvents, timelinePage]);

  useEffect(() => {
    if (!fromApi || !contact?.id) {
      setContactTimelineEvents([]);
      setContactTimelineLoading(false);
      return;
    }
    let cancelled = false;
    setContactTimelineLoading(true);
    fetchActivityLogs({
      entityType: 'Contacto',
      entityId: contact.id,
      page: 1,
      limit: 80,
    })
      .then((r) => {
        if (!cancelled) {
          setContactTimelineEvents(r.data.map(activityLogToTimelineEvent));
        }
      })
      .catch(() => {
        if (!cancelled) setContactTimelineEvents([]);
      })
      .finally(() => {
        if (!cancelled) setContactTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi, contact?.id]);

  useEffect(() => {
    setTimelinePage(1);
  }, [contact?.id, contactTimelineEvents.length]);

  useEffect(() => {
    if (timelinePage > totalTimelinePages) {
      setTimelinePage(totalTimelinePages);
    }
  }, [timelinePage, totalTimelinePages]);

  const contactStageTone = useStageBadgeTone(contact?.etapa);

  // Los returns condicionales van después de todos los hooks
  if (fromApi && apiLoading) {
    return <EntityDetailPageSkeleton ariaLabel="Cargando contacto" />;
  }

  if (fromApi && (apiError || !apiRecord)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/contactos')}>
          <ArrowLeft /> Volver a Contactos
        </Button>
        <EmptyState
          icon={Users}
          title="Contacto no encontrado"
          description={apiError ?? 'El contacto no existe en el servidor.'}
          actionLabel="Volver a Contactos"
          onAction={() => navigate('/contactos')}
        />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/contactos')}>
          <ArrowLeft /> Volver a Contactos
        </Button>
        <EmptyState
          icon={Users}
          title="Contacto no encontrado"
          description="El contacto que buscas no existe o fue eliminado."
          actionLabel="Volver a Contactos"
          onAction={() => navigate('/contactos')}
        />
      </div>
    );
  }

  function handleOpenEditDialog() {
    setEditDialogOpen(true);
  }

  async function handlePersistContactEdit(payload: ContactEditSavePayload) {
    if (!contact) return;
    if (fromApi && routeId) {
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
            toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
            throw new Error('invalid_assignee');
          }
          body.assignedTo = payload.assignedTo;
        }
        const updated = await api<ApiContactDetail>(`/contacts/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setApiRecord(updated);
        toast.success('Contacto actualizado correctamente');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        throw e;
      }
      return;
    }
    const patch: Partial<Contact> = {
      name: payload.name,
      cargo: payload.cargo || undefined,
      telefono: payload.telefono,
      correo: payload.correo,
      fuente: payload.fuente,
    };
    if (payload.assignedTo !== undefined && canEditAssignee) {
      const user = users.find((u) => u.id === payload.assignedTo);
      patch.assignedTo = payload.assignedTo;
      patch.assignedToName = user?.name ?? contact.assignedToName ?? 'Sin asignar';
    }
    updateContact(contact.id, patch);
    toast.success('Contacto actualizado correctamente');
  }


  async function handleConvertToOpportunity(data: NewOpportunityFormValues) {
    if (!contact) {
      toast.error('No hay contacto');
      throw new Error('no contact');
    }
    const contactId = contact.id;
    const merged: NewOpportunityFormValues = {
      ...data,
      contactId,
      companyId: defaultCompanyIdForNewOpp || data.companyId,
    };
    if (fromApi) {
      try {
        const body = buildOpportunityCreateBody(merged);
        await api('/opportunities', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await refreshApiContact();
        toast.success(`Oportunidad "${data.title.trim()}" creada correctamente`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        throw e;
      }
      return;
    }
    addOpportunity({
      title: data.title.trim(),
      contactId,
      contactName: contact.name,
      clientId: merged.companyId?.trim(),
      clientName: getPrimaryCompany(contact)?.name,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      priority: data.priority,
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo ?? '',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast.success(`Oportunidad "${data.title.trim()}" creada correctamente`);
  }

  function handleEtapaChange(newEtapa: string) {
    if (!contact) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const history = contact.etapaHistory ?? [];
          const newHistory = [...history, { etapa: newEtapa as Etapa, fecha: today }];
          const updated = await api<ApiContactDetail>(`/contacts/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ etapa: newEtapa, etapaHistory: newHistory }),
          });
          setApiRecord(updated);
          toast.success('Etapa actualizada correctamente');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la etapa');
        }
      })();
      return;
    }
    updateContact(contact.id, { etapa: newEtapa as Contact['etapa'] });
    toast.success('Etapa actualizada correctamente');
  }

  async function handleAddCompany(
    data: NewCompanyData,
    meta?: NewCompanyWizardSubmitMeta,
  ) {
    if (!contact) return;
    if (fromApi && routeId) {
      try {
        if (meta?.mode === 'update' && meta.existingCompanyId) {
          await api(`/companies/${meta.existingCompanyId}`, {
            method: 'PATCH',
            body: JSON.stringify(newCompanyDataToPatchBody(data)),
          });
          const isPrimary = !(apiRecord?.companies?.length);
          const updated = await contactAddCompany(
            routeId,
            meta.existingCompanyId,
            isPrimary,
          );
          setApiRecord(updated);
          setAddCompanyOpen(false);
          toast.success('Empresa actualizada y vinculada correctamente');
          return;
        }

        const created = await api<ApiCompanyRecord>('/companies', {
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
            facturacionEstimada: (() => {
              const f = Number(data.facturacion);
              if (Number.isFinite(f) && f > 0) return f;
              return 1;
            })(),
            fuente: data.origenLead || contact.fuente,
            etapa: data.etapa || contact.etapa,
            clienteRecuperado: data.clienteRecuperado,
          }),
        });
        const isPrimary = !(apiRecord?.companies?.length);
        const updated = await contactAddCompany(routeId, created.id, isPrimary);
        setApiRecord(updated);
        setAddCompanyOpen(false);
        toast.success('Empresa creada y vinculada correctamente');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear la empresa';
        toast.error(msg);
        throw e instanceof Error ? e : new Error(msg);
      }
      return;
    }
    const rubro = data.rubro || undefined;
    const tipo = data.tipoEmpresa || undefined;
    const companies = [...(contact.companies ?? []), {
      name: data.nombreComercial,
      rubro,
      tipo,
      domain: data.dominio || undefined,
      isPrimary: contact.companies?.length === 0,
    }];
    updateContact(contact.id, { companies });
    toast.success('Empresa agregada');
  }

  function handleLinkOpportunities() {
    if (linkOpportunityIds.length === 0 || !contact) return;
    if (fromApi) {
      void (async () => {
        try {
          for (const oppId of linkOpportunityIds) {
            if (isLikelyOpportunityCuid(oppId)) {
              await api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify({ contactId: contact.id }),
              });
            } else {
              updateOpportunity(oppId, { contactId: contact.id, contactName: contact.name });
            }
          }
          await refreshApiContact();
          toast.success(linkOpportunityIds.length === 1 ? 'Oportunidad vinculada' : `${linkOpportunityIds.length} oportunidades vinculadas`);
          setLinkOpportunityIds([]);
          setLinkOpportunitySearch('');
          setAddExistingOpportunityOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
        }
      })();
      return;
    }
    for (const oppId of linkOpportunityIds) {
      updateOpportunity(oppId, { contactId: contact.id, contactName: contact.name });
    }
    toast.success(linkOpportunityIds.length === 1 ? 'Oportunidad vinculada' : `${linkOpportunityIds.length} oportunidades vinculadas`);
    setLinkOpportunityIds([]);
    setLinkOpportunitySearch('');
    setAddExistingOpportunityOpen(false);
  }

  async function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !contact) return;
    if (fromApi && routeId) {
      try {
        const linkedCount = apiRecord?.companies?.length ?? 0;
        for (let i = 0; i < linkCompanyNames.length; i++) {
          const companyId = linkCompanyNames[i];
          const isPrimary = linkedCount === 0 && i === 0;
          await contactAddCompany(routeId, companyId, isPrimary);
        }
        const updated = await api<ApiContactDetail>(`/contacts/${routeId}`);
        setApiRecord(updated);
        const n = linkCompanyNames.length;
        toast.success(n === 1 ? 'Empresa vinculada' : `${n} empresas vinculadas`);
        setLinkCompanyNames([]);
        setLinkCompanySearch('');
        setAddExistingCompanyOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
      }
      return;
    }
    const currentNames = new Set(contact.companies?.map((c) => c.name) ?? []);
    let companies = [...(contact.companies ?? [])];
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceContact = contacts.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceContact?.companies?.find((c) => c.name === name);
      companies.push({
        name,
        rubro: sourceCompany?.rubro,
        tipo: sourceCompany?.tipo,
        isPrimary: companies.length === 0,
      });
      currentNames.add(name);
    }
    if (companies.length > (contact.companies?.length ?? 0)) {
      updateContact(contact.id, { companies });
      toast.success(companies.length - (contact.companies?.length ?? 0) === 1 ? 'Empresa vinculada' : `${companies.length - (contact.companies?.length ?? 0)} empresas vinculadas`);
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  async function handleRemoveOpportunity(opp: import('@/types').Opportunity) {
    if (!contact) return;
    if (fromApi && isLikelyOpportunityCuid(opp.id)) {
      try {
        await api(`/opportunities/${opp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        await refreshApiContact();
        toast.success('Oportunidad desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(opp.id, { contactId: '', contactName: '' });
    toast.success('Oportunidad desvinculada');
  }

  async function handleRemoveCompany(company: import('@/types').LinkedCompany) {
    if (!contact) return;
    if (fromApi && routeId && company.id) {
      try {
        const updated = await contactRemoveCompany(routeId, company.id);
        setApiRecord(updated);
        toast.success('Empresa desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    const filtered = (contact.companies ?? []).filter((c) => c.name !== company.name);
    updateContact(contact.id, { companies: filtered });
    toast.success('Empresa desvinculada');
  }

  const availableOpportunitiesToLink = (() => {
    if (!id) return [];
    if (fromApi) {
      return apiOpportunitiesList
        .map(mapApiOpportunityToOpportunity)
        .filter((o) => o.contactId !== id);
    }
    return opportunities.filter((o) => o.contactId !== id);
  })();

  function parseRubroFromApi(s: string | null | undefined): CompanyRubro | undefined {
    if (!s) return undefined;
    return s in companyRubroLabels ? (s as CompanyRubro) : undefined;
  }
  function parseTipoFromApi(s: string | null | undefined): CompanyTipo | undefined {
    if (!s) return undefined;
    return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
  }

  const availableCompaniesToLink = (() => {
    if (fromApi && apiRecord) {
      const linkedIds = new Set((apiRecord.companies ?? []).map((x) => x.company.id));
      return apiCompaniesList
        .filter((c) => !linkedIds.has(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          rubro: parseRubroFromApi(c.rubro),
          tipo: parseTipoFromApi(c.tipo),
        }));
    }
    if (!contact?.companies) return [];
    const currentNames = new Set(contact.companies.map((c) => c.name));
    const seen = new Set<string>();
    const result: { id: string; name: string; rubro?: CompanyRubro; tipo?: CompanyTipo; contactName?: string; contactPhone?: string }[] = [];
    for (const l of mergedContacts) {
      for (const c of l.companies ?? []) {
        if (!currentNames.has(c.name) && !seen.has(c.name)) {
          seen.add(c.name);
          result.push({
            id: c.name,
            name: c.name,
            rubro: c.rubro,
            tipo: c.tipo,
            contactName: l.name,
            contactPhone: l.telefono,
          });
        }
      }
    }
    return result;
  })();

  const opportunityStatusLabels: Record<string, string> = {
    abierta: 'Abierta',
    ganada: 'Ganada',
    perdida: 'Perdida',
    suspendida: 'Suspendida',
  };
  const opportunityLinkItems: LinkExistingItem[] = availableOpportunitiesToLink.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: `${formatCurrency(o.amount)} · ${etapaLabels[o.etapa]}`,
    status: opportunityStatusLabels[o.status] ?? o.status,
    icon: <DollarSign className="size-4" />,
  }));

  const companyLinkItems: LinkExistingItem[] = availableCompaniesToLink.map((c) => {
    const contactInfo = 'contactName' in c && c.contactName && c.contactPhone
      ? `${c.contactName} · ${c.contactPhone}`
      : undefined;
    const fallback = 'contactName' in c && typeof c.contactName === 'string'
      ? c.contactName
      : (c.rubro ? companyRubroLabels[c.rubro] : undefined);
    const subtitle: string | undefined = contactInfo ?? fallback;
    return {
      id: c.id,
      title: c.name,
      subtitle,
      status: 'Activo',
      icon: <Building2 className="size-4" />,
    };
  });

  return (
    <>
    <DetailLayout
      backPath="/contactos"
      title={contact.name}
      subtitle={contact.cargo}
      header={(
        <ContactHeader
          backPath="/contactos"
          name={contact.name}
          subtitle={contact.cargo}
          stageLabel={getStageLabelFromCatalog(contact.etapa, crmBundle, etapaLabels as Record<string, string>)}
          stageClassName={contactStageTone.className}
          stageStyle={contactStageTone.style}
          currentEtapaSlug={contact.etapa}
          onEtapaChange={handleEtapaChange}
          quickActions={(
            <QuickActionsWithDialogs
              entityName={contact.name}
              contacts={mergedContacts.filter((l) => l.id !== contact.id)}
              companies={contact.companies ?? []}
              opportunities={contactOpportunities}
              contactId={contact.id}
              onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
              onActivityCreated={handleQuickActivityCreated}
              excludeActions={['archivo']}
              inline
            />
          )}
          onEdit={handleOpenEditDialog}
          onOpenWhatsapp={() => setWhatsappDrawerOpen(true)}
        />
      )}
      sidebar={(
        <ContactoSidebar
          contact={contact}
          contactOpportunities={contactOpportunities}
          onOpenConvertDialog={() => setConvertDialogOpen(true)}
          onAddExistingOpportunity={() => setAddExistingOpportunityOpen(true)}
          onRemoveOpportunity={handleRemoveOpportunity}
          onAddCompany={() => setAddCompanyOpen(true)}
          onAddExistingCompany={() => setAddExistingCompanyOpen(true)}
          onRemoveCompany={handleRemoveCompany}
        />
      )}
    >
        <Tabs defaultValue="historial">
          <TabsList variant="line" className="max-w-full justify-start">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="actividades">Actividades</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="archivos" className="gap-1.5">
              <FileArchive className="size-3.5" />
              Archivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actividades" className="mt-4">
            <ActivityPanel activities={contactActivities} onRegisterActivity={() => toast.info('Usa las acciones rápidas para registrar una actividad')} />
          </TabsContent>

          {/* Archivos Tab */}
          <TabsContent value="archivos" className="mt-4">
            <EntityFilesTab
              entityType="contact"
              entityId={contact.id}
              entityName={contact.name}
            />
          </TabsContent>

          {/* Tareas Tab */}
          <TabsContent value="tareas" className="mt-4">
            <TasksTab
              ref={tasksTabRef}
              contacts={mergedContacts.filter((l) => l.id !== contact?.id)}
              companies={contact?.companies ?? []}
              opportunities={contactOpportunities}
              defaultAssigneeId={contact?.assignedTo}
              onActivityCreated={(activity) => setContactActivities((prev) => [activity as any, ...prev])}
              contactId={contact.id}
            />
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escribe una nota..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>
                    <Plus className="size-4" /> Agregar nota
                  </Button>
                </div>
                <div className="space-y-3">
                  {noteActivities.map((note) => (
                    <div key={note.id} className="rounded-lg border p-4">
                      <p className="text-sm">{note.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{note.assignedToName}</span>
                        <span>•</span>
                        <span>{formatDate(note.createdAt || note.dueDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial Tab */}
          <TabsContent value="historial" className="mt-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                {contactTimelineLoading ? (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : contactTimelineEvents.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Sin actividad registrada"
                    description={
                      fromApi
                        ? 'Los cambios y acciones sobre este contacto aparecerán aquí.'
                        : 'El historial detallado está disponible cuando abres un contacto desde el servidor (vista API).'
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    <TimelinePanel events={paginatedTimelineEvents} />
                    <div className="-mx-4 flex flex-col gap-3 border-t border-border/60 px-4 pt-4 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-xs text-muted-foreground">
                        Mostrando {Math.min((timelinePage - 1) * TIMELINE_PAGE_SIZE + 1, contactTimelineEvents.length)}
                        {' '}a {Math.min(timelinePage * TIMELINE_PAGE_SIZE, contactTimelineEvents.length)} de {contactTimelineEvents.length} eventos
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
        </Tabs>



    </DetailLayout>

      <ContactEditDialog
        contact={contact}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handlePersistContactEdit}
        canEditAssignee={canEditAssignee}
      />

      <NewCompanyWizard
        open={addCompanyOpen}
        onOpenChange={setAddCompanyOpen}
        onSubmit={handleAddCompany}
        title="Agregar empresa"
        description={`Vincula una nueva empresa a ${contact.name}.`}
      />

      {/* Vincular oportunidad existente Dialog */}
      <LinkExistingDialog
        open={addExistingOpportunityOpen}
        onOpenChange={(open) => {
          setAddExistingOpportunityOpen(open);
          if (!open) {
            setLinkOpportunityIds([]);
            setLinkOpportunitySearch('');
          }
        }}
        title="Vincular Oportunidad Existente"
        searchPlaceholder="Buscar oportunidades..."
        contactName={contact.name}
        items={opportunityLinkItems}
        selectedIds={linkOpportunityIds}
        onSelectionChange={setLinkOpportunityIds}
        onConfirm={handleLinkOpportunities}
        searchValue={linkOpportunitySearch}
        onSearchChange={setLinkOpportunitySearch}
        emptyMessage="No hay oportunidades disponibles para vincular."
      />

      <NewOpportunityFormDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        title="Nueva oportunidad"
        description={`Registra una oportunidad para ${contact.name}.`}
        defaultContactId={defaultContactIdForNewOpp}
        defaultCompanyId={defaultCompanyIdForNewOpp}
        lockContactSelection={!!defaultContactIdForNewOpp}
        lockCompanySelection={!!defaultCompanyIdForNewOpp}
        onCreate={handleConvertToOpportunity}
      />

      {/* Vincular empresa existente Dialog */}
      <LinkExistingDialog
        open={addExistingCompanyOpen}
        onOpenChange={(open) => {
          setAddExistingCompanyOpen(open);
          if (!open) {
            setLinkCompanyNames([]);
            setLinkCompanySearch('');
          }
        }}
        title="Vincular Empresa Existente"
        searchPlaceholder="Buscar empresas..."
        contactName={contact.name}
        items={companyLinkItems}
        selectedIds={linkCompanyNames}
        onSelectionChange={setLinkCompanyNames}
        onConfirm={handleLinkCompanies}
        searchValue={linkCompanySearch}
        onSearchChange={setLinkCompanySearch}
        emptyMessage="No hay empresas disponibles para vincular."
      />

      <WhatsappContactDrawer
        contact={contact}
        open={whatsappDrawerOpen}
        onOpenChange={setWhatsappDrawerOpen}
      />
    </>
  );
}
