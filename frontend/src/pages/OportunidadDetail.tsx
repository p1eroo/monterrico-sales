import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Briefcase, DollarSign, Target, CalendarDays, User, Building2,
  Users, Plus, FileArchive, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { etapaLabels, companyRubroLabels, activities } from '@/data/mock';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useActivities } from '@/hooks/useActivities';
import { useUsers } from '@/hooks/useUsers';
import { getPrimaryCompany } from '@/lib/utils';
import type { CompanyRubro, Etapa, OpportunityStatus, TimelineEvent } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs, type QuickActivityDraft } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { EntityFilesTab } from '@/components/files';
import { OpportunityHeader } from '@/components/opportunity-detail/OpportunityHeader';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { type ApiCompanyRecord } from '@/lib/companyApi';
import { isEntityDetailApiParam } from '@/lib/detailRoutes';
import {
  type ApiOpportunityDetail,
  isLikelyOpportunityCuid,
  mapApiContactToContact,
  mapApiOpportunityToOpportunity,
} from '@/lib/opportunityApi';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  contactAddCompany,
  contactListAll,
  contactRemoveCompany,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  mapApiCompanyInContactToLinkedCompany,
} from '@/lib/contactApi';
import { useStageBadgeTone } from '@/hooks/useStageBadgeTone';
import { useCrmConfigStore, getStageLabelFromCatalog } from '@/store/crmConfigStore';

const TIMELINE_PAGE_SIZE = 6;

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

export default function OportunidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeId = id ? decodeURIComponent(id) : '';
  const fromApi = isEntityDetailApiParam(routeId);
  const { opportunities, contacts, updateOpportunity, updateContact, addContact } = useCRMStore();

  const [apiRecord, setApiRecord] = useState<ApiOpportunityDetail | null>(null);
  const [apiLoading, setApiLoading] = useState(fromApi);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiContactsList, setApiContactsList] = useState<ApiContactListRow[]>([]);

  useEffect(() => {
    if (!fromApi || !routeId) {
      setApiLoading(false);
      setApiRecord(null);
      setApiError(null);
      setApiContactsList([]);
      return;
    }
    let cancelled = false;
    setApiLoading(true);
    setApiError(null);
    Promise.all([
      api<ApiOpportunityDetail>(`/opportunities/${routeId}`),
      contactListAll(),
    ])
      .then(([oppRow, contactsList]) => {
        if (!cancelled) {
          setApiRecord(oppRow);
          setApiContactsList(contactsList);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setApiRecord(null);
          setApiError(e.message);
          setApiContactsList([]);
        }
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi, routeId]);

  const { users, activeAdvisors } = useUsers();
  const crmBundle = useCrmConfigStore((s) => s.bundle);
  const currentUserRole = useAppStore((s) => s.currentUser.role ?? '');
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);
  const { activities: activitiesFromStore, createActivity } = useActivities();
  const storeOpp = opportunities.find((o) => o.id === routeId);

  const opp = useMemo(() => {
    if (fromApi) {
      if (!apiRecord) return undefined;
      return mapApiOpportunityToOpportunity(apiRecord);
    }
    return storeOpp;
  }, [fromApi, apiRecord, storeOpp]);

  const oppStageTone = useStageBadgeTone(opp?.etapa);

  const linkedContact = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.contacts?.[0]?.contact) {
      return mapApiContactToContact(apiRecord.contacts[0].contact);
    }
    return opp.contactId ? contacts.find((l) => l.id === opp.contactId) ?? null : null;
  }, [fromApi, apiRecord, opp, contacts]);

  const primaryCompany = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.companies?.[0]?.company) {
      return mapApiCompanyInContactToLinkedCompany(apiRecord.companies[0].company);
    }
    return linkedContact ? getPrimaryCompany(linkedContact) : null;
  }, [fromApi, apiRecord, opp, linkedContact]);

  const initialOppActivities = useMemo(() => {
    if (!opp?.contactId) return [];
    return activities.filter((a) => a.contactId === opp.contactId);
  }, [opp]);
  const [oppActivities, setOppActivities] = useState(initialOppActivities);
  const persistedOppActivities = useMemo(() => activitiesFromStore.filter((activity) => {
    if (activity.type === 'tarea') return false;
    if (opp?.id && activity.opportunityId === opp.id) return true;
    return !!opp?.contactId && activity.contactId === opp.contactId;
  }), [activitiesFromStore, opp?.id, opp?.contactId]);
  const noteActivities = useMemo(
    () => oppActivities.filter((activity) => activity.type === 'nota'),
    [oppActivities],
  );

  useEffect(() => {
    if (fromApi) {
      setOppActivities(persistedOppActivities);
      return;
    }
    setOppActivities(initialOppActivities);
  }, [fromApi, initialOppActivities, persistedOppActivities]);

  const handleQuickActivityCreated = useCallback((draft: QuickActivityDraft) => {
    if (!opp) return;

    const assignedTo = opp.assignedTo || activeAdvisors[0]?.id;
    if (!assignedTo) {
      toast.error('No hay usuario interno para asignar la actividad');
      throw new Error('missing_assignee');
    }

    const persistedContactId =
      linkedContact?.id && isLikelyContactCuid(linkedContact.id) ? linkedContact.id : undefined;
    const persistedOpportunityId =
      isLikelyOpportunityCuid(opp.id) ? opp.id : undefined;
    const persistedCompanyId =
      primaryCompany?.id && /^c[a-z0-9]+$/i.test(primaryCompany.id) ? primaryCompany.id : undefined;

    if (!persistedContactId && !persistedOpportunityId && !persistedCompanyId) {
      const fallbackAssigneeName =
        users.find((user) => user.id === assignedTo)?.name ??
        opp.assignedToName ??
        'Sin asignar';
      setOppActivities((prev) => [
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
          contactId: linkedContact?.id ?? opp.contactId,
          opportunityId: opp.id,
          opportunityTitle: opp.title,
        },
        ...prev,
      ]);
      toast.info('Actividad guardada solo localmente porque esta oportunidad no existe en la API');
      return;
    }

    const assignedToName =
      users.find((user) => user.id === assignedTo)?.name ??
      opp.assignedToName ??
      'Sin asignar';
    const optimisticId = `temp-activity-${Date.now()}`;

    setOppActivities((prev) => [
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
        contactId: persistedContactId ?? linkedContact?.id ?? opp.contactId,
        companyId: persistedCompanyId,
        opportunityId: persistedOpportunityId ?? opp.id,
        opportunityTitle: opp.title,
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
      opportunityId: persistedOpportunityId,
    })
      .then((saved) => {
        setOppActivities((prev) => [
          saved,
          ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
        ]);
      })
      .catch((error) => {
        setOppActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar la actividad');
      });
  }, [opp, linkedContact, primaryCompany, activeAdvisors, users, createActivity]);

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

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');


  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);

  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');

  const [noteText, setNoteText] = useState('');

  // --- Edit / Etapa / Asignar dialogs ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    amount: 0,
    expectedCloseDate: '',
    status: '' as OpportunityStatus | '',
    assignedTo: '',
  });


  const [oppTimelineEvents, setOppTimelineEvents] = useState<TimelineEvent[]>([]);
  const [oppTimelineLoading, setOppTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  useEffect(() => {
    if (!fromApi || !opp?.id) {
      setOppTimelineEvents([]);
      setOppTimelineLoading(false);
      return;
    }
    let cancelled = false;
    setOppTimelineLoading(true);
    fetchActivityLogs({
      entityType: 'Oportunidad',
      entityId: opp.id,
      page: 1,
      limit: 80,
    })
      .then((r) => {
        if (!cancelled) {
          setOppTimelineEvents(r.data.map(activityLogToTimelineEvent));
        }
      })
      .catch(() => {
        if (!cancelled) setOppTimelineEvents([]);
      })
      .finally(() => {
        if (!cancelled) setOppTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApi, opp?.id]);

  const totalTimelinePages = useMemo(
    () => Math.max(1, Math.ceil(oppTimelineEvents.length / TIMELINE_PAGE_SIZE)),
    [oppTimelineEvents.length],
  );

  const paginatedTimelineEvents = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return oppTimelineEvents.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [oppTimelineEvents, timelinePage]);

  useEffect(() => {
    setTimelinePage(1);
  }, [opp?.id, oppTimelineEvents.length]);

  useEffect(() => {
    if (timelinePage > totalTimelinePages) {
      setTimelinePage(totalTimelinePages);
    }
  }, [timelinePage, totalTimelinePages]);

  function handleOpenEditDialog() {
    if (!opp) return;
    setEditForm({
      title: opp.title,
      amount: opp.amount,
      expectedCloseDate: opp.expectedCloseDate
        ? opp.expectedCloseDate.slice(0, 10)
        : '',
      status: opp.status,
      assignedTo: opp.assignedTo || activeAdvisors[0]?.id || '',
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!opp) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const body: Record<string, unknown> = {
            title: editForm.title.trim(),
            amount: editForm.amount,
            expectedCloseDate: editForm.expectedCloseDate || null,
            status: editForm.status || undefined,
          };
          if (canEditAssignee && editForm.assignedTo) {
            if (!isLikelyContactCuid(editForm.assignedTo)) {
              toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
              return;
            }
            body.assignedTo = editForm.assignedTo;
          }
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          });
          setApiRecord(updated);
          toast.success('Oportunidad actualizada correctamente');
          setEditDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        }
      })();
      return;
    }
    const assignPatch =
      canEditAssignee && editForm.assignedTo
        ? {
            assignedTo: editForm.assignedTo,
            assignedToName:
              users.find((u) => u.id === editForm.assignedTo)?.name ?? opp.assignedToName ?? 'Sin asignar',
          }
        : {};
    updateOpportunity(opp.id, {
      title: editForm.title,
      amount: editForm.amount,
      expectedCloseDate: editForm.expectedCloseDate,
      status: (editForm.status || undefined) as OpportunityStatus | undefined,
      ...assignPatch,
    });
    toast.success('Oportunidad actualizada correctamente');
    setEditDialogOpen(false);
  }

  function handleEtapaChange(newEtapa: string) {
    if (!opp) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ etapa: newEtapa }),
          });
          setApiRecord(updated);
          toast.success('Etapa actualizada correctamente');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la etapa');
        }
      })();
      return;
    }
    updateOpportunity(opp.id, { etapa: newEtapa as Etapa });
    toast.success('Etapa actualizada correctamente');
  }

async function handleCreateNewContact(data: NewContactData) {
  if (!opp) return;
  const opportunityIdsToLink = data.selectedOpportunityIds ?? [];
  const allOppIds = [...new Set([opp.id, ...opportunityIdsToLink])];
  
  if (fromApi && routeId) {
    try {
      const w = data.newCompanyWizardData;
      const today = new Date().toISOString().slice(0, 10);
      const baseBody: Record<string, unknown> = {
        name: data.name.trim(),
        telefono: data.phone?.trim() || '',
        correo: data.email?.trim() || '',
        fuente: data.source,
        cargo: data.cargo?.trim() || undefined,
        etapa: data.etapaCiclo,
        assignedTo: data.assignedTo?.trim() || opp.assignedTo || undefined,
        estimatedValue: data.estimatedValue ?? 0,
        docType: data.docType || undefined,
        docNumber: data.docNumber?.trim() || undefined,
        departamento: data.departamento?.trim() || undefined,
        provincia: data.provincia?.trim() || undefined,
        distrito: data.distrito?.trim() || undefined,
        direccion: data.direccion?.trim() || undefined,
        clienteRecuperado: data.clienteRecuperado || undefined,
        etapaHistory: [{ etapa: data.etapaCiclo, fecha: today }],
      };

      if (w) {
        const coPatchId = data.newCompanyWizardUpdate?.companyId;
        if (coPatchId) {
          if (!w.origenLead) {
            toast.error('Selecciona la fuente del lead en el wizard de empresa');
            return;
          }
          try {
            await api(`/companies/${coPatchId}`, {
              method: 'PATCH',
              body: JSON.stringify(newCompanyDataToPatchBody(w)),
            });
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : 'No se pudo actualizar la empresa',
            );
            return;
          }
          baseBody.companyId = coPatchId;
        } else {
          const factEmpresa = (() => {
            const f = Number(w.facturacion);
            if (Number.isFinite(f) && f > 0) return f;
            return 0;
          })();
          if (factEmpresa <= 0) {
            toast.error(
              'Indica facturación estimada de la empresa en el asistente (paso comercial u oportunidad).',
            );
            return;
          }
          if (!w.origenLead) {
            toast.error('Selecciona la fuente del lead en el wizard de empresa');
            return;
          }
          baseBody.newCompany = {
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
        }
      } else if (data.companyId) {
        baseBody.companyId = data.companyId;
      }

      const createdContact = await api<ApiContactDetail>('/contacts', {
        method: 'POST',
        body: JSON.stringify(baseBody),
      });
      
      for (const oppId of allOppIds) {
        if (isLikelyOpportunityCuid(oppId)) {
          await api(`/opportunities/${oppId}`, {
            method: 'PATCH',
            body: JSON.stringify({ contactId: createdContact.id }),
          });
        }
      }
      
      const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`);
      setApiRecord(updated);
      setNewContactOpen(false);
      toast.success(allOppIds.length > 1 
        ? `Contacto creado y vinculado a ${allOppIds.length} oportunidades`
        : 'Contacto creado y vinculado a la oportunidad');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto');
    }
    return;
  }
  const newContact = addContact({
    name: data.name,
    cargo: data.cargo,
    docType: data.docType,
    docNumber: data.docNumber,
    companies: data.company ? [{ name: data.company }] : [],
    telefono: data.phone || '',
    correo: data.email || '',
    fuente: data.source,
    assignedTo: data.assignedTo || opp.assignedTo,
    estimatedValue: 0,
    clienteRecuperado: data.clienteRecuperado,
  });
  
  for (const oppId of allOppIds) {
    updateOpportunity(oppId, { contactId: newContact.id, contactName: newContact.name });
  }
  
  toast.success(allOppIds.length > 1 
    ? `Contacto creado y vinculado a ${allOppIds.length} oportunidades`
    : 'Contacto creado y vinculado a la oportunidad');
  setNewContactOpen(false);
}

  async function handleLinkContacts() {
    if (linkContactIds.length === 0 || !opp) return;
    if (fromApi && routeId) {
      try {
        const firstContactId = linkContactIds[0];
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: firstContactId }),
        });
        setApiRecord(updated);
        toast.success('Contacto vinculado a la oportunidad');
        setLinkContactIds([]);
        setLinkContactSearch('');
        setAddExistingContactOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
      }
      return;
    }
    const firstContactId = linkContactIds[0];
    updateOpportunity(opp.id, { contactId: firstContactId, contactName: contacts.find((l) => l.id === firstContactId)?.name });
    toast.success('Contacto vinculado a la oportunidad');
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddExistingContactOpen(false);
  }

  async function handleRemoveContact(_contact?: { id: string }) {
    if (!opp || !linkedContact) return;
    if (fromApi && routeId) {
      try {
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        setApiRecord(updated);
        toast.success('Contacto desvinculado de la oportunidad');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(opp.id, { contactId: '', contactName: '' });
    toast.success('Contacto desvinculado de la oportunidad');
  }

  async function handleAddCompany(
    data: NewCompanyData,
    meta?: NewCompanyWizardSubmitMeta,
  ) {
    if (!linkedContact) return;
    if (fromApi && routeId && isLikelyContactCuid(linkedContact.id)) {
      try {
        if (meta?.mode === 'update' && meta.existingCompanyId) {
          await api(`/companies/${meta.existingCompanyId}`, {
            method: 'PATCH',
            body: JSON.stringify(newCompanyDataToPatchBody(data)),
          });
          const isPrimary = !(apiRecord?.companies?.length);
          await contactAddCompany(linkedContact.id, meta.existingCompanyId, isPrimary);
          const updatedOpp = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`);
          setApiRecord(updatedOpp);
          setNewCompanyDialogOpen(false);
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
            fuente: data.origenLead || linkedContact.fuente,
            etapa: data.etapa || linkedContact.etapa,
            clienteRecuperado: data.clienteRecuperado,
          }),
        });
        const isPrimary = !(apiRecord?.companies?.length);
        await contactAddCompany(linkedContact.id, created.id, isPrimary);
        const updatedOpp = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`);
        setApiRecord(updatedOpp);
        setNewCompanyDialogOpen(false);
        toast.success('Empresa creada y vinculada correctamente');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear la empresa';
        toast.error(msg);
        throw e instanceof Error ? e : new Error(msg);
      }
      return;
    }
    const companies = [...(linkedContact.companies ?? []), {
      name: data.nombreComercial,
      rubro: data.rubro || undefined,
      tipo: data.tipoEmpresa || undefined,
      domain: data.dominio || undefined,
      isPrimary: false,
    }];
    updateContact(linkedContact.id, { companies });
    toast.success('Empresa agregada');
  }

  async function handleRemoveCompany(company: import('@/types').LinkedCompany) {
    if (!linkedContact) return;
    if (fromApi && linkedContact.id && company.id && isLikelyContactCuid(linkedContact.id)) {
      try {
        await contactRemoveCompany(linkedContact.id, company.id);
        const filtered = (linkedContact.companies ?? []).filter((c) => c.id !== company.id && c.name !== company.name);
        updateContact(linkedContact.id, { companies: filtered });
        toast.success('Empresa desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    const filtered = (linkedContact.companies ?? []).filter((c) => c.name !== company.name);
    updateContact(linkedContact.id, { companies: filtered });
    toast.success('Empresa desvinculada');
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !linkedContact) return;
    const currentNames = new Set(linkedContact.companies?.map((c) => c.name) ?? []);
    let companies = [...(linkedContact.companies ?? [])];
    const contactsForLinkCompanies = fromApi
      ? apiContactsList.map(mapApiContactRowToContact)
      : contacts;
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceContact = contactsForLinkCompanies.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceContact?.companies?.find((c) => c.name === name);
      companies.push({ name, rubro: sourceCompany?.rubro, tipo: sourceCompany?.tipo, isPrimary: false });
      currentNames.add(name);
    }
    if (companies.length > (linkedContact.companies?.length ?? 0)) {
      updateContact(linkedContact.id, { companies });
      toast.success('Empresa(s) vinculada(s)');
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  const availableContacts = (() => {
    if (fromApi) {
      const linkedId = apiRecord?.contacts?.[0]?.contact?.id;
      return apiContactsList
        .filter((c) => c.id !== linkedId)
        .map((r) => mapApiContactRowToContact(r));
    }
    return linkedContact ? contacts.filter((l) => l.id !== linkedContact.id) : contacts;
  })();
  const contactLinkItems: LinkExistingItem[] = availableContacts.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.telefono,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  const currentCompanyNames = new Set((linkedContact?.companies ?? []).map((c) => c.name.trim().toLowerCase()));
  const availableCompanies = (() => {
    const contactsForCompanies = fromApi
      ? apiContactsList.map(mapApiContactRowToContact)
      : contacts;
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro }[] = [];
    for (const l of contactsForCompanies) {
      for (const c of l.companies ?? []) {
        const key = c.name.trim().toLowerCase();
        if (!currentCompanyNames.has(key) && !seen.has(key)) {
          seen.add(key);
          result.push({ name: c.name, rubro: c.rubro });
        }
      }
    }
    return result;
  })();
  const companyLinkItems: LinkExistingItem[] = availableCompanies.map((c) => ({
    id: c.name,
    title: c.name,
    subtitle: c.rubro ? companyRubroLabels[c.rubro] : undefined,
    status: 'Activo',
    icon: <Building2 className="size-4" />,
  }));

  if (fromApi && apiLoading) {
    return <EntityDetailPageSkeleton ariaLabel="Cargando oportunidad" />;
  }

  if (fromApi && (apiError || !apiRecord)) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Briefcase}
          title="Oportunidad no encontrada"
          description={apiError ?? 'La oportunidad que buscas no existe en el servidor.'}
          actionLabel="Volver a Oportunidades"
          onAction={() => navigate('/opportunities')}
        />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Briefcase}
          title="Oportunidad no encontrada"
          description="La oportunidad que buscas no existe."
          actionLabel="Volver a Oportunidades"
          onAction={() => navigate('/opportunities')}
        />
      </div>
    );
  }

  const headerSubtitle = linkedContact?.name ?? '';

  return (
    <>
    <DetailLayout
      backPath="/opportunities"
      title={opp.title}
      header={(
        <OpportunityHeader
          backPath="/opportunities"
          title={opp.title}
          subtitle={headerSubtitle || undefined}
          stageLabel={getStageLabelFromCatalog(opp.etapa, crmBundle, etapaLabels as Record<string, string>)}
          stageClassName={oppStageTone.className}
          stageStyle={oppStageTone.style}
          currentEtapaSlug={opp.etapa}
          onEtapaChange={handleEtapaChange}
          amountLabel={formatCurrency(opp.amount)}
          quickActions={(
            <QuickActionsWithDialogs
              entityName={opp.title}
              contacts={linkedContact ? [linkedContact] : []}
              companies={linkedContact?.companies ?? []}
              opportunities={[opp]}
              contactId={opp?.contactId}
              onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
              onActivityCreated={handleQuickActivityCreated}
              inline
            />
          )}
          onEdit={handleOpenEditDialog}
        />
      )}
      leftAside={
          <EntityInfoCard
            title="Información"
            collapsible
            fields={[
              { icon: DollarSign, value: formatCurrency(opp.amount) },
              { icon: Target, value: `${opp.probability}% probabilidad` },
              { icon: CalendarDays, value: `Cierre: ${formatDate(opp.expectedCloseDate)}` },
              { icon: User, value: opp.assignedToName },
              { icon: CalendarDays, value: `Creada: ${formatDate(opp.createdAt)}` },
            ]}
          />
      }
      sidebar={
        <>
          <LinkedCompaniesCard
            companies={primaryCompany ? [primaryCompany] : (linkedContact?.companies ?? [])}
            onCreate={() => setNewCompanyDialogOpen(true)}
            onAddExisting={() => setAddExistingCompanyOpen(true)}
            onRemove={linkedContact ? handleRemoveCompany : undefined}
            etapa={primaryCompany ? opp?.etapa : linkedContact?.etapa}
          />

          <LinkedContactsCard
            contacts={linkedContact ? [linkedContact] : []}
            title="Contactos"
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
            onRemove={linkedContact ? handleRemoveContact : undefined}
          />
        </>
      }
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

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              {oppTimelineLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : oppTimelineEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Sin actividad registrada"
                  description={
                    fromApi
                      ? 'Los cambios sobre esta oportunidad aparecerán aquí.'
                      : 'El historial detallado está disponible en oportunidades cargadas desde el servidor (API).'
                  }
                />
              ) : (
                <div className="space-y-4">
                  <TimelinePanel events={paginatedTimelineEvents} />
                  <div className="-mx-4 flex flex-col gap-3 border-t border-border/60 px-4 pt-4 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {Math.min((timelinePage - 1) * TIMELINE_PAGE_SIZE + 1, oppTimelineEvents.length)}
                      {' '}a {Math.min(timelinePage * TIMELINE_PAGE_SIZE, oppTimelineEvents.length)} de {oppTimelineEvents.length} eventos
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
          <ActivityPanel activities={oppActivities} />
        </TabsContent>

        <TabsContent value="archivos" className="mt-4">
          <EntityFilesTab
            entityType="opportunity"
            entityId={opp.id}
            entityName={opp.title}
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
                      <span>·</span>
                      <span>{formatDate(note.createdAt || note.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tareas" className="mt-4">
          <TasksTab
            ref={tasksTabRef}
            contacts={linkedContact ? [linkedContact] : []}
            companies={primaryCompany ? [{ name: primaryCompany.name }] : []}
            opportunities={opp ? [opp] : []}
            defaultAssigneeId={opp?.assignedTo}
            onActivityCreated={(activity) => setOppActivities((prev) => [activity as any, ...prev])}
            contactId={opp?.contactId}
            opportunityId={opp?.id}
          />
        </TabsContent>
      </Tabs>
    </DetailLayout>

{/* Crear nuevo contacto */}
<NewContactWizard
  open={newContactOpen}
  onOpenChange={setNewContactOpen}
  onSubmit={handleCreateNewContact}
  title="Crear nuevo contacto"
  description={`Crea un nuevo contacto vinculado a la oportunidad "${opp.title}".`}
  submitLabel="Crear y vincular"
  defaultCompanyId={opp.clientId}
  defaultOpportunityIds={!opp.contactId ? [opp.id] : []}
/>

    {/* Vincular contacto existente */}
    <LinkExistingDialog
      open={addExistingContactOpen}
      onOpenChange={(open) => { setAddExistingContactOpen(open); if (!open) { setLinkContactIds([]); setLinkContactSearch(''); } }}
      title="Vincular Contacto Existente"
      searchPlaceholder="Buscar contactos..."
      contactName={opp.title}
      items={contactLinkItems}
      selectedIds={linkContactIds}
      onSelectionChange={setLinkContactIds}
      onConfirm={handleLinkContacts}
      searchValue={linkContactSearch}
      onSearchChange={setLinkContactSearch}
      emptyMessage="No hay contactos disponibles para vincular."
    />

    <NewCompanyWizard
      open={newCompanyDialogOpen}
      onOpenChange={setNewCompanyDialogOpen}
      onSubmit={handleAddCompany}
      title="Agregar empresa"
      description={`Vincula una nueva empresa al contacto de esta oportunidad.`}
    />

    {/* Vincular empresa existente */}
    <LinkExistingDialog
      open={addExistingCompanyOpen}
      onOpenChange={(open) => { setAddExistingCompanyOpen(open); if (!open) { setLinkCompanyNames([]); setLinkCompanySearch(''); } }}
      title="Vincular Empresa Existente"
      searchPlaceholder="Buscar empresas..."
      contactName={opp.title}
      items={companyLinkItems}
      selectedIds={linkCompanyNames}
      onSelectionChange={setLinkCompanyNames}
      onConfirm={handleLinkCompanies}
      searchValue={linkCompanySearch}
      onSearchChange={setLinkCompanySearch}
      emptyMessage="No hay empresas disponibles para vincular."
    />

    {/* Editar Oportunidad */}
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Oportunidad</DialogTitle>
          <DialogDescription>Modifica los datos de la oportunidad.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monto (S/)</Label>
              <Input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha estimada de cierre</Label>
              <Input type="date" value={editForm.expectedCloseDate} onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as OpportunityStatus }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AssignedAdvisorFormField
            htmlId="opp-edit-assigned-to"
            value={editForm.assignedTo}
            onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
            disabled={!canEditAssignee}
            fallbackName={
              users.find((u) => u.id === editForm.assignedTo)?.name ?? opp.assignedToName
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={!editForm.title.trim()}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  );
}
