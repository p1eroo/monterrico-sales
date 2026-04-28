import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Building2, Users, DollarSign, Globe, Briefcase,
  Phone, Plus, FileArchive, Loader2,
  MapPin, Mail, Linkedin, ChevronLeft, ChevronRight,
  FileText, Hash, Tag,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { useCompaniesStore } from '@/store/companiesStore';
import {
  companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels, activities,
} from '@/data/mock';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import { getPrimaryCompany } from '@/lib/utils';
import type { Etapa, CompanyRubro, CompanyTipo, ContactSource, TimelineEvent, Contact } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs, type QuickActivityDraft } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { EntityFilesTab } from '@/components/files';
import { CompanyHeader } from '@/components/company-detail/CompanyHeader';
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
import { companyDetailHref, contactDetailHref, isEntityDetailApiParam } from '@/lib/detailRoutes';
import { type ApiCompanyRecord, isLikelyCompanyCuid } from '@/lib/companyApi';
import {
  type ApiContactListRow,
  apiContactDetailToListRow,
  contactCreate,
  contactRemoveCompany,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactListAll,
} from '@/lib/contactApi';
import {
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import { buildOptimisticContact } from '@/lib/optimisticEntities';
import { generateOptimisticId, useOptimisticCrmStore } from '@/store/optimisticCrmStore';
import { useStageBadgeTone } from '@/hooks/useStageBadgeTone';
import { useCrmConfigStore, getStageLabelFromCatalog } from '@/store/crmConfigStore';

const TIMELINE_PAGE_SIZE = 6;

function parseRubroField(s: string | null | undefined): CompanyRubro | undefined {
  if (!s) return undefined;
  return s in companyRubroLabels ? (s as CompanyRubro) : undefined;
}

function parseTipoField(s: string | null | undefined): CompanyTipo | undefined {
  if (!s) return undefined;
  return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
}

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { contacts: storeContacts, opportunities: storeOpportunities } = useCRMStore();
  const { getCompanyByName, updateCompany } = useCompaniesStore();

  const routeId = id ? decodeURIComponent(id) : '';
  const fromApiById = isEntityDetailApiParam(routeId);
  const [apiRecord, setApiRecord] = useState<ApiCompanyRecord | null>(null);
  const [apiContactRows, setApiContactRows] = useState<ApiContactListRow[]>([]);
  const [apiOpportunityRows, setApiOpportunityRows] = useState<ApiOpportunityListRow[]>([]);
  const [apiLoading, setApiLoading] = useState(fromApiById);
  const { users, activeAdvisors } = useUsers();
  const crmBundle = useCrmConfigStore((s) => s.bundle);
  const currentUserRole = useAppStore((s) => s.currentUser.role ?? '');
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);
  const [apiError, setApiError] = useState<string | null>(null);

  const pendingContacts = useOptimisticCrmStore((s) => s.pendingContacts);
  const addPendingContact = useOptimisticCrmStore((s) => s.addPendingContact);
  const removePendingContact = useOptimisticCrmStore((s) => s.removePendingContact);
  const isPendingContactId = useOptimisticCrmStore((s) => s.isPendingContactId);

  const loadApiContacts = useCallback(async () => {
    try {
      const list = await contactListAll();
      setApiContactRows(list);
    } catch {
      setApiContactRows([]);
    }
  }, []);

  const loadApiOpportunities = useCallback(async () => {
    try {
      const list = await opportunityListAll();
      setApiOpportunityRows(Array.isArray(list) ? list : []);
    } catch {
      setApiOpportunityRows([]);
    }
  }, []);

  useEffect(() => {
    if (!fromApiById || !routeId) {
      setApiLoading(false);
      setApiRecord(null);
      setApiError(null);
      return;
    }
    let cancelled = false;
    setApiLoading(true);
    setApiError(null);
    api<ApiCompanyRecord>(`/companies/${routeId}`)
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
  }, [fromApiById, routeId]);

  useEffect(() => {
    void loadApiContacts();
    void loadApiOpportunities();
  }, [loadApiContacts, loadApiOpportunities]);

  const companyName =
    fromApiById && apiRecord
      ? apiRecord.name
      : fromApiById
        ? ''
        : routeId;

  const contacts = useMemo(() => {
    const fromApi = apiContactRows.map(mapApiContactRowToContact);
    const pendingForCompany = pendingContacts.filter((c) =>
      c.companies?.some((comp) => {
        if (fromApiById && apiRecord) {
          return (
            comp.id === apiRecord.id ||
            comp.name?.trim().toLowerCase() === companyName.trim().toLowerCase()
          );
        }
        return comp.name?.trim().toLowerCase() === companyName.trim().toLowerCase();
      }),
    );
    const apiIds = new Set(fromApi.map((c) => c.id));
    const pendingExtra = pendingForCompany.filter((p) => !apiIds.has(p.id));

    if (fromApiById) {
      return [...pendingExtra, ...fromApi];
    }
    const fromStore = storeContacts.filter((c) => !apiIds.has(c.id));
    return [...pendingExtra, ...fromApi, ...fromStore];
  }, [apiContactRows, storeContacts, fromApiById, pendingContacts, apiRecord, companyName]);

  const companyContacts = useMemo(() => {
    if (!companyName) return [];
    if (fromApiById && apiRecord) {
      return contacts.filter((c) =>
        c.companies?.some((comp) => comp.id === apiRecord.id || comp.name?.trim().toLowerCase() === companyName.trim().toLowerCase()),
      );
    }
    return contacts.filter((l) =>
      l.companies?.some((c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase()),
    );
  }, [contacts, companyName, fromApiById, apiRecord]);

  /** companyId cuando viene de API (por cuid) o cuando lo resolvemos por slug desde contactos */
  const resolvedCompanyId: string | undefined =
    (fromApiById ? apiRecord?.id : undefined) ??
    companyContacts[0]?.companies?.find((c) =>
      c.name?.trim().toLowerCase() === companyName.trim().toLowerCase(),
    )?.id;

  const standaloneCompany = useMemo(
    () => (companyContacts.length === 0 ? getCompanyByName(companyName) : undefined),
    [companyContacts.length, companyName, getCompanyByName],
  );

  const firstContact = companyContacts[0];
  const showAdvisorInCompanyEdit = fromApiById || companyContacts.length > 0;
  const companyDataFromContact = firstContact?.companies?.find(
    (c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase(),
  );
  const companyDataFromApi =
    fromApiById && apiRecord
      ? {
          name: apiRecord.name,
          domain: apiRecord.domain ?? undefined,
          telefono: apiRecord.telefono ?? undefined,
          rubro: parseRubroField(apiRecord.rubro),
          tipo: parseTipoField(apiRecord.tipo),
        }
      : undefined;
  const companyData =
    companyDataFromContact ??
    (standaloneCompany
      ? {
          name: standaloneCompany.name,
          domain: standaloneCompany.domain,
          rubro: standaloneCompany.rubro,
          tipo: standaloneCompany.tipo,
        }
      : undefined) ??
    companyDataFromApi;
  const displayEtapaKey =
    fromApiById && apiRecord?.etapa
      ? apiRecord.etapa
      : firstContact?.etapa;
  const displayEtapaLabel = displayEtapaKey
    ? getStageLabelFromCatalog(displayEtapaKey, crmBundle, etapaLabels as Record<string, string>)
    : '—';
  const displayFuenteLabel =
    fromApiById && apiRecord?.fuente
      ? (contactSourceLabels[apiRecord.fuente as ContactSource] ??
        apiRecord.fuente)
      : firstContact?.fuente
        ? (contactSourceLabels[firstContact.fuente] ?? firstContact.fuente)
        : '—';

  const stageTone = useStageBadgeTone(displayEtapaKey);

  const opportunities = useMemo(() => {
    const fromApi = apiOpportunityRows.map(mapApiOpportunityToOpportunity);
    if (fromApiById) {
      return fromApi;
    }
    const apiIds = new Set(apiOpportunityRows.map((r) => r.id));
    const fromStore = storeOpportunities.filter((o) => !apiIds.has(o.id));
    return [...fromApi, ...fromStore];
  }, [apiOpportunityRows, storeOpportunities, fromApiById]);

  const companyOpportunities = useMemo(() => {
    const contactIds = new Set(companyContacts.map((l) => l.id));
    const companyId = resolvedCompanyId;
    return opportunities.filter((o) => {
      const viaContact = !!(o.contactId && contactIds.has(o.contactId));
      const viaCompany = !!(
        companyId &&
        (o.clientId === companyId ||
          (o.linkedCompanyIds?.includes(companyId) ?? false))
      );
      return viaContact || viaCompany;
    });
  }, [companyContacts, opportunities, resolvedCompanyId]);

  const opportunitiesAmountSum = useMemo(
    () => companyOpportunities.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    [companyOpportunities],
  );
  const displayFacturacion =
    fromApiById && apiRecord && typeof apiRecord.facturacionEstimada === 'number'
      ? apiRecord.facturacionEstimada
      : opportunitiesAmountSum;

  const initialCompanyActivities = useMemo(() => {
    const contactIds = new Set(companyContacts.map((l) => l.id));
    return activities.filter((a) => a.contactId && contactIds.has(a.contactId));
  }, [companyContacts]);
  const [companyActivities, setCompanyActivities] = useState(initialCompanyActivities);

  const linkedCompanies = useMemo(() => {
    const seen = new Set<string>();
    const result: import('@/types').LinkedCompany[] = [];
    for (const contact of companyContacts) {
      for (const comp of contact.companies ?? []) {
        const key = comp.name.trim().toLowerCase();
        if (key === companyName.trim().toLowerCase() || seen.has(key)) continue;
        seen.add(key);
        result.push({ name: comp.name, domain: comp.domain, rubro: comp.rubro, tipo: comp.tipo, id: comp.id });
      }
    }
    return result;
  }, [companyContacts, companyName]);

  const {
    activities: activitiesFromStore,
    createActivity,
  } = useActivities();
  const companyContactIds = useMemo(
    () => companyContacts.map((c) => c.id),
    [companyContacts],
  );
  const persistedCompanyActivities = useMemo(() => activitiesFromStore.filter((activity) => {
    if (activity.type === 'tarea') return false;
    if (resolvedCompanyId && activity.companyId === resolvedCompanyId) return true;
    return !!activity.contactId && companyContactIds.includes(activity.contactId);
  }), [activitiesFromStore, resolvedCompanyId, companyContactIds]);
  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newOppOpen, setNewOppOpen] = useState(false);

  const [addExistingOppOpen, setAddExistingOppOpen] = useState(false);
  const [linkOppIds, setLinkOppIds] = useState<string[]>([]);
  const [linkOppSearch, setLinkOppSearch] = useState('');

  const [newContactOpen, setNewContactOpen] = useState(false);

  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

  const [noteText, setNoteText] = useState('');

  const { addOpportunity, updateOpportunity, addContact, updateContact } = useCRMStore();

  // --- Edit / Etapa / Asignar dialogs ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (fromApiById) {
      setCompanyActivities(persistedCompanyActivities);
      return;
    }
    setCompanyActivities(initialCompanyActivities);
  }, [fromApiById, initialCompanyActivities, persistedCompanyActivities]);

  const noteActivities = useMemo(
    () => companyActivities.filter((activity) => activity.type === 'nota'),
    [companyActivities],
  );

  const handleQuickActivityCreated = useCallback((draft: QuickActivityDraft) => {
    const assignedTo =
      (fromApiById ? apiRecord?.assignedTo : undefined) ||
      firstContact?.assignedTo ||
      activeAdvisors[0]?.id;

    if (!assignedTo) {
      toast.error('No hay usuario interno para asignar la actividad');
      throw new Error('missing_assignee');
    }

    const persistedContactId =
      firstContact?.id && isLikelyContactCuid(firstContact.id) ? firstContact.id : undefined;
    const persistedCompanyId =
      resolvedCompanyId && /^c[a-z0-9]+$/i.test(resolvedCompanyId) ? resolvedCompanyId : undefined;

    if (!persistedContactId && !persistedCompanyId) {
      const fallbackAssigneeName =
        users.find((user) => user.id === assignedTo)?.name ??
        firstContact?.assignedToName ??
        'Sin asignar';
      setCompanyActivities((prev) => [
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
          contactId: firstContact?.id,
        },
        ...prev,
      ]);
      toast.info('Actividad guardada solo localmente porque esta empresa no existe en la API');
      return;
    }

    const assignedToName =
      users.find((user) => user.id === assignedTo)?.name ??
      firstContact?.assignedToName ??
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
        contactId: persistedContactId ?? firstContact?.id,
        companyId: persistedCompanyId,
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
        setCompanyActivities((prev) => [
          saved,
          ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
        ]);
      })
      .catch((error) => {
        setCompanyActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar la actividad');
      });
  }, [fromApiById, apiRecord?.assignedTo, firstContact, activeAdvisors, resolvedCompanyId, users, createActivity]);

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
  const [editForm, setEditForm] = useState({
    name: '', domain: '', telefono: '', rubro: '' as CompanyRubro | '', tipo: '' as CompanyTipo | '', assignedTo: '',
  });


  const [companyTimelineEvents, setCompanyTimelineEvents] = useState<TimelineEvent[]>([]);
  const [companyTimelineLoading, setCompanyTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  useEffect(() => {
    if (!fromApiById || !resolvedCompanyId) {
      setCompanyTimelineEvents([]);
      setCompanyTimelineLoading(false);
      return;
    }
    let cancelled = false;
    setCompanyTimelineLoading(true);
    fetchActivityLogs({
      entityType: 'Empresa',
      entityId: resolvedCompanyId,
      page: 1,
      limit: 80,
    })
      .then((r) => {
        if (!cancelled) {
          setCompanyTimelineEvents(r.data.map(activityLogToTimelineEvent));
        }
      })
      .catch(() => {
        if (!cancelled) setCompanyTimelineEvents([]);
      })
      .finally(() => {
        if (!cancelled) setCompanyTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromApiById, resolvedCompanyId]);

  const totalTimelinePages = useMemo(
    () => Math.max(1, Math.ceil(companyTimelineEvents.length / TIMELINE_PAGE_SIZE)),
    [companyTimelineEvents.length],
  );

  const paginatedTimelineEvents = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return companyTimelineEvents.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [companyTimelineEvents, timelinePage]);

  useEffect(() => {
    setTimelinePage(1);
  }, [resolvedCompanyId, companyTimelineEvents.length]);

  useEffect(() => {
    if (timelinePage > totalTimelinePages) {
      setTimelinePage(totalTimelinePages);
    }
  }, [timelinePage, totalTimelinePages]);

  function handleOpenEditDialog() {
    const tel = (fromApiById && apiRecord?.telefono) ? (apiRecord.telefono ?? '') : '';
    const assignedToInit =
      (fromApiById ? (apiRecord?.assignedTo ?? '') : (firstContact?.assignedTo ?? '')) ||
      activeAdvisors[0]?.id ||
      '';
    setEditForm({
      name: companyData?.name ?? companyName,
      domain: companyData?.domain ?? '',
      telefono: tel,
      rubro: companyData?.rubro ?? '',
      tipo: companyData?.tipo ?? '',
      assignedTo: assignedToInit,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (fromApiById && apiRecord) {
      void (async () => {
        try {
          const body: Record<string, unknown> = {
            name: editForm.name.trim(),
            domain: editForm.domain?.trim() || undefined,
            telefono: editForm.telefono?.trim() || undefined,
            rubro: editForm.rubro || undefined,
            tipo: editForm.tipo || undefined,
          };
          if (canEditAssignee && showAdvisorInCompanyEdit && editForm.assignedTo) {
            if (!isLikelyContactCuid(editForm.assignedTo)) {
              toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
              return;
            }
            body.assignedTo = editForm.assignedTo;
          }
          await api<ApiCompanyRecord>(`/companies/${apiRecord.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          });
          const row = await api<ApiCompanyRecord>(`/companies/${apiRecord.id}`);
          setApiRecord(row);
          const nextPath = companyDetailHref(row);
          if (nextPath.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) {
            navigate(nextPath, { replace: true });
          }
          toast.success('Empresa actualizada en el servidor');
          setEditDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Error al guardar');
        }
      })();
      return;
    }
    if (isStandalone && standaloneCompany) {
      updateCompany(standaloneCompany.id, {
        name: editForm.name,
        domain: editForm.domain || undefined,
        rubro: (editForm.rubro || undefined) as CompanyRubro | undefined,
        tipo: (editForm.tipo || undefined) as CompanyTipo | undefined,
      });
    } else {
      for (const contact of companyContacts) {
        const updatedCompanies = (contact.companies ?? []).map((c) => {
          if (c.name.trim().toLowerCase() === companyName.trim().toLowerCase()) {
            return { ...c, name: editForm.name, domain: editForm.domain || undefined, rubro: (editForm.rubro || undefined) as CompanyRubro | undefined, tipo: (editForm.tipo || undefined) as CompanyTipo | undefined };
          }
          return c;
        });
        const assignPatch =
          canEditAssignee && showAdvisorInCompanyEdit && editForm.assignedTo
            ? {
                assignedTo: editForm.assignedTo,
                assignedToName:
                  users.find((u) => u.id === editForm.assignedTo)?.name ?? 'Sin asignar',
              }
            : {};
        updateContact(contact.id, { companies: updatedCompanies, ...assignPatch });
      }
    }
    toast.success('Empresa actualizada correctamente');
    setEditDialogOpen(false);
    if (editForm.name !== companyName) {
      navigate(`/empresas/${encodeURIComponent(editForm.name)}`, { replace: true });
    }
  }

  function handleEtapaChange(newEtapa: string) {
    if (fromApiById && apiRecord) {
      void (async () => {
        try {
          await api(`/companies/${apiRecord.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ etapa: newEtapa }),
          });
          const row = await api<ApiCompanyRecord>(`/companies/${apiRecord.id}`);
          setApiRecord(row);
          await loadApiContacts();
          toast.success('Etapa actualizada correctamente');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Error al actualizar etapa');
        }
      })();
      return;
    }
    for (const contact of companyContacts) {
      updateContact(contact.id, { etapa: newEtapa as Etapa });
    }
    toast.success('Etapa actualizada correctamente');
  }

  // --- Handlers ---
  async function handleCreateOpportunity(data: NewOpportunityFormValues) {
    const companyIdStr = typeof resolvedCompanyId === 'string' ? resolvedCompanyId : '';

    if (
      fromApiById &&
      companyIdStr &&
      isLikelyCompanyCuid(companyIdStr) &&
      !firstContact
    ) {
      try {
        const merged: NewOpportunityFormValues = {
          ...data,
          companyId: companyIdStr,
          contactId: '',
        };
        const body = buildOpportunityCreateBody(merged);
        await api('/opportunities', { method: 'POST', body: JSON.stringify(body) });
        await loadApiOpportunities();
        toast.success(`Oportunidad "${data.title.trim()}" creada`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        throw e;
      }
      return;
    }

    if (!firstContact) {
      toast.error('Añade al menos un contacto vinculado a la empresa.');
      throw new Error('no contact');
    }
    const merged: NewOpportunityFormValues = {
      ...data,
      contactId: firstContact.id,
      companyId: companyIdStr || data.companyId,
    };
    if (resolvedCompanyId && isLikelyContactCuid(firstContact.id)) {
      try {
        const body = buildOpportunityCreateBody(merged);
        await api('/opportunities', { method: 'POST', body: JSON.stringify(body) });
        await loadApiOpportunities();
        toast.success(`Oportunidad "${data.title.trim()}" creada`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        throw e;
      }
      return;
    }
    addOpportunity({
      title: data.title.trim(),
      contactId: firstContact.id,
      contactName: firstContact.name,
      clientId: companyIdStr || data.companyId?.trim(),
      clientName: companyData?.name,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      priority: data.priority,
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo ?? '',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast.success(`Oportunidad "${data.title.trim()}" creada`);
  }

  function handleLinkOpportunities() {
    if (linkOppIds.length === 0 || !firstContact) return;
    for (const oppId of linkOppIds) {
      updateOpportunity(oppId, { contactId: firstContact.id, contactName: firstContact.name });
    }
    toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
    setLinkOppIds([]);
    setLinkOppSearch('');
    setAddExistingOppOpen(false);
  }

async function handleCreateNewContact(data: NewContactData) {
  const defaultAssignedTo = firstContact?.assignedTo ?? activeAdvisors[0]?.id ?? '';
  const opportunityIdsToLink = data.selectedOpportunityIds ?? [];

  if (resolvedCompanyId) {
    const optId = generateOptimisticId('c');
    const baseOpt = buildOptimisticContact(optId, data, {
      companyDisplayName: companyData?.name ?? companyName,
    });
    const optimisticContact: Contact = {
      ...baseOpt,
      etapa: 'lead',
      companies: [{ name: companyData?.name ?? companyName, id: resolvedCompanyId, isPrimary: true }],
    };

    const body: Record<string, unknown> = {
      name: data.name.trim(),
      telefono: (data.phone || '').trim() || '000000000',
      correo: (data.email || '').trim() || `noreply-${Date.now()}@temp.local`,
      fuente: data.source,
      etapa: 'lead',
      estimatedValue: 0,
      companyId: resolvedCompanyId,
      cargo: data.cargo?.trim() || undefined,
      docType: data.docType || undefined,
      docNumber: data.docNumber?.trim() || undefined,
      clienteRecuperado: data.clienteRecuperado,
      departamento: data.departamento?.trim() || undefined,
      provincia: data.provincia?.trim() || undefined,
      distrito: data.distrito?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
    };
    if ((data.assignedTo || defaultAssignedTo) && isLikelyContactCuid(data.assignedTo || defaultAssignedTo)) {
      body.assignedTo = data.assignedTo || defaultAssignedTo;
    }

    addPendingContact(optimisticContact);
    setNewContactOpen(false);

    void (async () => {
      try {
        const created = await contactCreate(body);
        /** Quitar optimista antes de mezclar con API: evita dos filas del mismo contacto. */
        removePendingContact(optId);
        /** Fila real al instante: no esperar `contactListAll` (puede ser lenta). La recarga sigue en segundo plano. */
        const createdListRow = apiContactDetailToListRow(created);
        setApiContactRows((prev) => {
          const without = prev.filter((r) => r.id !== createdListRow.id);
          return [createdListRow, ...without];
        });

        const oppCuids = opportunityIdsToLink.filter((id) => isLikelyOpportunityCuid(id));
        let nFail = 0;
        if (oppCuids.length > 0) {
          const settled = await Promise.allSettled(
            oppCuids.map((oppId) =>
              api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify({ contactId: created.id }),
              }),
            ),
          );
          nFail = settled.filter((r) => r.status === 'rejected').length;
        }
        for (const oppId of opportunityIdsToLink) {
          if (!isLikelyOpportunityCuid(oppId)) {
            updateOpportunity(oppId, { contactId: created.id, contactName: created.name });
          }
        }
        if (opportunityIdsToLink.length > 0) {
          if (nFail > 0) {
            toast.error(
              `Contacto creado. ${nFail} oportunidad(es) no se pudieron vincular en el servidor.`,
            );
          } else {
            toast.success(
              `Contacto creado y vinculado a ${opportunityIdsToLink.length} oportunidad${opportunityIdsToLink.length > 1 ? 'es' : ''}`,
            );
          }
        } else {
          toast.success('Contacto creado y vinculado a la empresa');
        }
        void Promise.all([loadApiContacts(), loadApiOpportunities()]).catch(() => {
          /* reconciliar con servidor; fallo silencioso para no duplicar toasts de éxito */
        });
      } catch (e) {
        removePendingContact(optId);
        toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto');
      }
    })();
    return;
  }
  addContact({
    name: data.name,
    cargo: data.cargo,
    docType: data.docType,
    docNumber: data.docNumber,
    companies: [{ name: companyName, rubro: companyData?.rubro, tipo: companyData?.tipo }],
    telefono: data.phone || '',
    correo: data.email || '',
    fuente: data.source,
    assignedTo: data.assignedTo || defaultAssignedTo,
    estimatedValue: 0,
    clienteRecuperado: data.clienteRecuperado,
    departamento: data.departamento,
    provincia: data.provincia,
    distrito: data.distrito,
    direccion: data.direccion,
  });
  
  if (opportunityIdsToLink.length > 0) {
    const newContactId = `temp-${Date.now()}`;
    for (const oppId of opportunityIdsToLink) {
      updateOpportunity(oppId, { contactId: newContactId, contactName: data.name });
    }
    toast.success(`Contacto creado y vinculado a ${opportunityIdsToLink.length} oportunidad${opportunityIdsToLink.length > 1 ? 'es' : ''}`);
  } else {
    toast.success('Contacto creado y vinculado a la empresa');
  }
  setNewContactOpen(false);
}

  function handleLinkContacts() {
    if (linkContactIds.length === 0) return;
    for (const contactId of linkContactIds) {
      const contact = contacts.find((l) => l.id === contactId);
      if (!contact) continue;
      const alreadyHas = contact.companies?.some((c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase());
      if (!alreadyHas) {
        const companies = [...(contact.companies ?? []), { name: companyName, rubro: companyData?.rubro, tipo: companyData?.tipo, isPrimary: false }];
        updateContact(contactId, { companies });
      }
    }
    toast.success(linkContactIds.length === 1 ? 'Contacto vinculado' : `${linkContactIds.length} contactos vinculados`);
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddExistingContactOpen(false);
  }

  async function handleRemoveOpportunity(opp: import('@/types').Opportunity) {
    if (fromApiById && isLikelyOpportunityCuid(opp.id)) {
      try {
        await api(`/opportunities/${opp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        toast.success('Oportunidad desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(opp.id, { contactId: '', contactName: '' });
    toast.success('Oportunidad desvinculada');
  }

  async function handleRemoveContact(contact: { id: string }) {
    if (isPendingContactId(contact.id)) {
      toast.info('Espera a que termine de guardarse el contacto');
      return;
    }
    const c = companyContacts.find((l) => l.id === contact.id);
    if (!c) return;
    if (fromApiById && routeId && isLikelyContactCuid(contact.id)) {
      try {
        const companyKey = apiRecord?.id ?? routeId;
        await contactRemoveCompany(contact.id, companyKey);
        const filtered = (c.companies ?? []).filter(
          (co) => co.name.trim().toLowerCase() !== companyName.trim().toLowerCase(),
        );
        updateContact(contact.id, { companies: filtered });
        toast.success('Contacto desvinculado de la empresa');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    const filtered = (c.companies ?? []).filter(
      (co) => co.name.trim().toLowerCase() !== companyName.trim().toLowerCase(),
    );
    updateContact(contact.id, { companies: filtered });
    toast.success('Contacto desvinculado de la empresa');
  }

  // --- Link items ---
  const contactIds = new Set(companyContacts.map((l) => l.id));
  const availableOpps = opportunities.filter((o) => {
    if (
      resolvedCompanyId &&
      (o.clientId === resolvedCompanyId ||
        (o.linkedCompanyIds?.includes(resolvedCompanyId) ?? false))
    ) {
      return false;
    }
    if (o.contactId && contactIds.has(o.contactId)) return false;
    return true;
  });
  const oppLinkItems: LinkExistingItem[] = availableOpps.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: `${formatCurrency(o.amount)} · ${etapaLabels[o.etapa]}`,
    status: o.status,
    icon: <DollarSign className="size-4" />,
  }));

  const availableContacts = contacts.filter((l) => !contactIds.has(l.id));
  const contactLinkItems: LinkExistingItem[] = availableContacts.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.telefono,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  const hasCompany =
    companyContacts.length > 0 ||
    !!standaloneCompany ||
    (fromApiById && !!apiRecord);

  if (fromApiById && apiLoading) {
    return <EntityDetailPageSkeleton ariaLabel="Cargando empresa" />;
  }

  if (
    (!fromApiById && !companyName) ||
    (fromApiById && !apiLoading && (!apiRecord || apiError)) ||
    (!fromApiById && !hasCompany)
  ) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/empresas')}>
          <Building2 className="size-4" /> Volver a Empresas
        </Button>
        <EmptyState
          icon={Building2}
          title="Empresa no encontrada"
          description={apiError ?? 'La empresa que buscas no existe.'}
          actionLabel="Volver a Empresas"
          onAction={() => navigate('/empresas')}
        />
      </div>
    );
  }

  const isStandalone =
    companyContacts.length === 0 &&
    (!!standaloneCompany || (fromApiById && !!apiRecord));

  const subtitle = [
    companyData?.domain,
    companyData?.rubro ? companyRubroLabels[companyData.rubro] : null,
    companyData?.tipo ? `Tipo ${companyData.tipo}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
    <DetailLayout
      backPath="/empresas"
      title={companyData?.name ?? companyName}
      subtitle={subtitle || undefined}
      header={(
        <CompanyHeader
          backPath="/empresas"
          name={companyData?.name ?? companyName}
          subtitle={subtitle || undefined}
          stageLabel={displayEtapaLabel}
          stageClassName={stageTone.className}
          stageStyle={stageTone.style}
          currentEtapaSlug={
            (fromApiById && apiRecord?.etapa) ? apiRecord.etapa : (firstContact?.etapa ?? '')
          }
          onEtapaChange={!isStandalone ? handleEtapaChange : undefined}
          estimatedValueLabel={formatCurrency(displayFacturacion)}
          quickActions={(
            <QuickActionsWithDialogs
              entityName={companyName}
              contacts={companyContacts}
              companies={linkedCompanies}
              opportunities={companyOpportunities}
              contactId={firstContact?.id}
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
              {
                icon: Building2,
                value: companyData?.name ?? companyName,
                truncate: true,
              },
              ...(fromApiById && apiRecord?.razonSocial?.trim()
                ? [
                    {
                      icon: FileText as typeof Building2,
                      value: apiRecord.razonSocial.trim(),
                      truncate: true,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.ruc?.trim()
                ? [
                    {
                      icon: Hash as typeof Building2,
                      value: apiRecord.ruc.trim(),
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.telefono
                ? [
                    {
                      icon: Phone as typeof Building2,
                      value: apiRecord.telefono,
                      href: `tel:${apiRecord.telefono}`,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.correo?.trim()
                ? [
                    {
                      icon: Mail as typeof Building2,
                      value: apiRecord.correo.trim(),
                      href: `mailto:${apiRecord.correo.trim()}`,
                    },
                  ]
                : []),
              ...(companyData?.domain
                ? [
                    {
                      icon: Globe as typeof Building2,
                      value: companyData.domain,
                      href: companyData.domain.startsWith('http')
                        ? companyData.domain
                        : `https://${companyData.domain}`,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.linkedin?.trim()
                ? [
                    {
                      icon: Linkedin as typeof Building2,
                      value: apiRecord.linkedin.trim(),
                      href: apiRecord.linkedin.trim().startsWith('http')
                        ? apiRecord.linkedin.trim()
                        : `https://${apiRecord.linkedin.trim()}`,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.direccion?.trim()
                ? [{ icon: MapPin, value: apiRecord.direccion.trim(), truncate: true }]
                : []),
              ...(companyData?.rubro
                ? [
                    {
                      icon: Briefcase as typeof Building2,
                      value: companyRubroLabels[companyData.rubro],
                    },
                  ]
                : []),
              ...(companyData?.tipo ? [{ label: 'Tipo:', value: companyData.tipo }] : []),
              ...(fromApiById && apiRecord?.fuente
                ? [
                    {
                      icon: Tag as typeof Building2,
                      value: displayFuenteLabel,
                    },
                  ]
                : []),
            ]}
          />
      }
      sidebar={
        <>
          {(fromApiById || !isStandalone) && (
            <>
              <LinkedOpportunitiesCard
                opportunities={companyOpportunities}
                onCreate={() => setNewOppOpen(true)}
                onAddExisting={() => setAddExistingOppOpen(true)}
                onRemove={handleRemoveOpportunity}
              />
            </>
          )}

          <LinkedContactsCard
            contacts={companyContacts}
            title="Contactos"
            maxItems={5}
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
            onRemove={handleRemoveContact}
            onContactNavigate={(c) => {
              if (isPendingContactId(c.id)) {
                toast.info('El contacto se está guardando; en unos segundos podrás abrir el detalle.');
                return;
              }
              navigate(contactDetailHref(c));
            }}
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
              {companyTimelineLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : companyTimelineEvents.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Sin actividad registrada"
                  description={
                    fromApiById
                      ? 'Los cambios sobre esta empresa aparecerán aquí.'
                      : 'El historial detallado está disponible en empresas cargadas desde el servidor (API).'
                  }
                />
              ) : (
                <div className="space-y-4">
                  <TimelinePanel events={paginatedTimelineEvents} />
                  <div className="-mx-4 flex flex-col gap-3 border-t border-border/60 px-4 pt-4 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {Math.min((timelinePage - 1) * TIMELINE_PAGE_SIZE + 1, companyTimelineEvents.length)}
                      {' '}a {Math.min(timelinePage * TIMELINE_PAGE_SIZE, companyTimelineEvents.length)} de {companyTimelineEvents.length} eventos
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
          <ActivityPanel activities={companyActivities} />
        </TabsContent>

        <TabsContent value="archivos" className="mt-4">
          <EntityFilesTab
            entityType="company"
            entityId={resolvedCompanyId ?? ''}
            entityName={companyName}
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
            contacts={companyContacts}
            companies={(companyData ? [{ name: companyData.name, id: fromApiById && apiRecord ? apiRecord.id : undefined }] : []).concat(linkedCompanies.map((c) => ({ name: c.name, id: c.id })))}
            opportunities={companyOpportunities}
            defaultAssigneeId={firstContact?.assignedTo}
            onActivityCreated={(activity) => setCompanyActivities((prev) => [activity as any, ...prev])}
            contactId={firstContact?.id}
            companyId={resolvedCompanyId}
          />
        </TabsContent>
      </Tabs>
    </DetailLayout>

    <NewOpportunityFormDialog
      open={newOppOpen}
      onOpenChange={setNewOppOpen}
      title="Nueva Oportunidad"
      description={`Registra una oportunidad para ${companyName}.`}
      defaultContactId={firstContact?.id ?? ''}
      defaultCompanyId={typeof resolvedCompanyId === 'string' ? resolvedCompanyId : ''}
      lockContactSelection={!!firstContact}
      lockCompanySelection={!!resolvedCompanyId}
      onCreate={handleCreateOpportunity}
    />

    {/* Vincular oportunidad existente */}
    <LinkExistingDialog
      open={addExistingOppOpen}
      onOpenChange={(open) => { setAddExistingOppOpen(open); if (!open) { setLinkOppIds([]); setLinkOppSearch(''); } }}
      title="Vincular Oportunidad Existente"
      searchPlaceholder="Buscar oportunidades..."
      contactName={companyName}
      items={oppLinkItems}
      selectedIds={linkOppIds}
      onSelectionChange={setLinkOppIds}
      onConfirm={handleLinkOpportunities}
      searchValue={linkOppSearch}
      onSearchChange={setLinkOppSearch}
      emptyMessage="No hay oportunidades disponibles para vincular."
    />

{/* Crear nuevo contacto */}
<NewContactWizard
  open={newContactOpen}
  onOpenChange={setNewContactOpen}
  onSubmit={handleCreateNewContact}
  title="Crear nuevo contacto"
  description={`Crea un nuevo contacto vinculado a ${companyName}.`}
  submitLabel="Crear y vincular"
  lockCompanySelection
  defaultCompanyId={resolvedCompanyId}
  defaultOpportunityIds={companyOpportunities
    .filter(o => !o.contactId)
    .map(o => o.id)}
  defaultValues={{
    company: companyName,
    companyId: resolvedCompanyId,
    etapaCiclo: 'lead',
  }}
/>

    {/* Vincular contacto existente */}
    <LinkExistingDialog
      open={addExistingContactOpen}
      onOpenChange={(open) => { setAddExistingContactOpen(open); if (!open) { setLinkContactIds([]); setLinkContactSearch(''); } }}
      title="Vincular Contacto Existente"
      searchPlaceholder="Buscar contactos..."
      contactName={companyName}
      items={contactLinkItems}
      selectedIds={linkContactIds}
      onSelectionChange={setLinkContactIds}
      onConfirm={handleLinkContacts}
      searchValue={linkContactSearch}
      onSearchChange={setLinkContactSearch}
      emptyMessage="No hay contactos disponibles para vincular."
    />

    {/* Editar Empresa */}
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>Modifica los datos de la empresa.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Nombre de la empresa *</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Dominio web</Label>
            <Input placeholder="empresa.com" value={editForm.domain} onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))} />
          </div>
          {fromApiById && (
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input placeholder="+51 999 999 999" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Select value={editForm.rubro} onValueChange={(v) => setEditForm((f) => ({ ...f, rubro: v as CompanyRubro }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyRubroLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v as CompanyTipo }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>Tipo {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showAdvisorInCompanyEdit ? (
            <AssignedAdvisorFormField
              htmlId="company-edit-assigned-to"
              value={editForm.assignedTo}
              onChange={(assignedTo) => setEditForm((f) => ({ ...f, assignedTo }))}
              disabled={!canEditAssignee}
              fallbackName={
                users.find((u) => u.id === editForm.assignedTo)?.name ??
                apiRecord?.user?.name ??
                firstContact?.assignedToName
              }
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={!editForm.name.trim()}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  );
}
