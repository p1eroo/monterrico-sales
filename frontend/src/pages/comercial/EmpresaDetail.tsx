import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { navigateOnClick } from '@/lib/navigateOnClick';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Building2, Users, DollarSign,
  FileArchive, Loader2,
  MapPin, Linkedin, ChevronLeft, ChevronRight,
  FileText, Hash, RefreshCw,
} from 'lucide-react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { LetterSvgIcon } from '@/components/icons/LetterSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { MapArrowSquareSvgIcon } from '@/components/icons/MapArrowSquareSvgIcon';
import { SuitcaseSvgIcon } from '@/components/icons/SuitcaseSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { canPickOtherCommercialAdvisor } from '@/data/rbac';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompaniesStore } from '@/store/companiesStore';
import {
  companyTipoLabels, etapaLabels, contactSourceLabels, activities,
} from '@/data/mock';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useUsers } from '@/hooks/useUsers';
import { useActivitiesStore } from '@/store/activitiesStore';
import { useEntityActivityList } from '@/hooks/useEntityActivityList';
import type { Etapa, CompanyRubro, CompanyTipo, ContactSource, TimelineEvent, Contact, Activity } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { EntityNotesTab } from '@/components/shared/EntityNotesTab';
import { QuickActionsWithDialogs, type QuickActivityDraft } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  linkOpportunityExtraContacts,
  opportunityContactIdsFromForm,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { CompanyEditDialog, type CompanyEditSavePayload, type CompanyEditSummaryRow } from '@/components/shared/CompanyEditDialog';
import { EntityFilesTab } from '@/components/files';
import { CompanyHeader } from '@/components/company-detail/CompanyHeader';
import { toast } from '@/lib/notify';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate, completedAtNowIso } from '@/lib/formatters';
import { mergeCompaniesForTaskPicker, taskAssociationsFromActivity } from '@/lib/taskAssociationsFromActivity';
import { ENTITY_DETAIL_SECTION_TAB_OPTIONS } from '@/lib/entityDetailSectionTabs';
import { api } from '@/lib/api';
import { APP_PATHS, companyDetailHref, companyDetailPath, contactDetailHref, isEntityDetailApiParam } from '@/lib/detailRoutes';
import { type ApiCompanyRecord, isLikelyCompanyCuid } from '@/lib/companyApi';
import {
  type ApiContactListRow,
  apiContactDetailToListRow,
  contactAddCompany,
  contactCreate,
  contactRemoveCompany,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactListAll,
  contactListPaginated,
} from '@/lib/contactApi';
import {
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
  opportunityListPaginated,
  opportunityUnlinkCompany,
} from '@/lib/opportunityApi';
import {
  usePaginatedOpportunityPicker,
  type OpportunityPickerExcludeFilter,
} from '@/hooks/usePaginatedOpportunityPicker';
import {
  usePaginatedContactPicker,
  type PaginatedContactPickerOptions,
} from '@/hooks/usePaginatedContactPicker';
import { buildOptimisticContact } from '@/lib/optimisticEntities';
import { generateOptimisticId, useOptimisticCrmStore } from '@/store/optimisticCrmStore';
import { useStageBadgeTone } from '@/hooks/useStageBadgeTone';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog, getRubroLabelFromCatalog } from '@/store/crmConfigStore';
import { getHighestPriorityOpportunityEtapa } from '@/lib/opportunityUtils';

const TIMELINE_PAGE_SIZE = 8;

function parseRubroField(s: string | null | undefined): CompanyRubro | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  return t;
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
  const { hasPermission } = usePermissions();
  const canEditAssignee = canPickOtherCommercialAdvisor(hasPermission);
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

  const loadLinkedCompanyContacts = useCallback(async () => {
    if (!fromApiById) return;
    const companyId =
      apiRecord?.id ?? (routeId && isLikelyCompanyCuid(routeId) ? routeId : '');
    if (!companyId || !isLikelyCompanyCuid(companyId)) {
      setApiContactRows([]);
      return;
    }
    try {
      const res = await contactListPaginated({
        linkedToCompanyId: companyId,
        limit: 200,
        page: 1,
      });
      setApiContactRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setApiContactRows([]);
    }
  }, [fromApiById, apiRecord?.id, routeId]);

  const reloadContactsData = useCallback(async () => {
    if (fromApiById) await loadLinkedCompanyContacts();
    else await loadApiContacts();
  }, [fromApiById, loadLinkedCompanyContacts, loadApiContacts]);

  const loadApiOpportunities = useCallback(async () => {
    try {
      const list = await opportunityListAll();
      setApiOpportunityRows(Array.isArray(list) ? list : []);
    } catch {
      setApiOpportunityRows([]);
    }
  }, []);

  const loadLinkedCompanyOpportunities = useCallback(async () => {
    if (!fromApiById) return;
    const companyId =
      apiRecord?.id ?? (routeId && isLikelyCompanyCuid(routeId) ? routeId : '');
    if (!companyId || !isLikelyCompanyCuid(companyId)) {
      setApiOpportunityRows([]);
      return;
    }
    try {
      const res = await opportunityListPaginated({
        linkedToCompanyId: companyId,
        limit: 200,
        page: 1,
      });
      setApiOpportunityRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setApiOpportunityRows([]);
    }
  }, [fromApiById, apiRecord?.id, routeId]);

  const reloadOpportunityLists = useCallback(async () => {
    if (fromApiById) await loadLinkedCompanyOpportunities();
    else await loadApiOpportunities();
  }, [fromApiById, loadLinkedCompanyOpportunities, loadApiOpportunities]);

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
    if (fromApiById) void loadLinkedCompanyContacts();
    else void loadApiContacts();
  }, [fromApiById, loadLinkedCompanyContacts, loadApiContacts]);

  useEffect(() => {
    if (fromApiById) void loadLinkedCompanyOpportunities();
    else void loadApiOpportunities();
  }, [fromApiById, loadLinkedCompanyOpportunities, loadApiOpportunities]);

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
    companyDataFromApi ??
    companyDataFromContact ??
    (standaloneCompany
      ? {
          name: standaloneCompany.name,
          domain: standaloneCompany.domain,
          rubro: standaloneCompany.rubro,
          tipo: standaloneCompany.tipo,
        }
      : undefined);
  const displayFuenteLabel =
    fromApiById && apiRecord?.fuente
      ? getSourceLabelFromCatalog(apiRecord.fuente, crmBundle, contactSourceLabels)
      : firstContact?.fuente
        ? getSourceLabelFromCatalog(firstContact.fuente, crmBundle, contactSourceLabels)
        : '—';

  const displayAssignedToName = fromApiById && apiRecord?.user?.name
    ? apiRecord.user.name
    : firstContact?.assignedToName;
  const displayClienteRecuperado = fromApiById && apiRecord?.clienteRecuperado
    ? apiRecord.clienteRecuperado
    : firstContact?.clienteRecuperado;
  const displayCreatedAt = fromApiById && apiRecord?.createdAt
    ? apiRecord.createdAt
    : firstContact?.createdAt;

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
      /** En API solo listamos vínculo `CompanyOpportunity`; si no, al desvincular empresa la fila seguiría por contacto compartido y el DELETE fallaría en el segundo intento. */
      if (fromApiById) {
        return viaCompany;
      }
      return viaContact || viaCompany;
    });
  }, [companyContacts, opportunities, resolvedCompanyId, fromApiById]);

  const displayEtapaKey = useMemo(() => {
    const fromOpp = getHighestPriorityOpportunityEtapa(companyOpportunities);
    if (fromOpp) return fromOpp;
    if (fromApiById && apiRecord?.etapa) return apiRecord.etapa;
    return firstContact?.etapa;
  }, [companyOpportunities, fromApiById, apiRecord?.etapa, firstContact?.etapa]);
  const displayEtapaLabel = displayEtapaKey
    ? getStageLabelFromCatalog(displayEtapaKey, crmBundle, etapaLabels as Record<string, string>)
    : '—';
  const stageTone = useStageBadgeTone(displayEtapaKey);

  const opportunitiesAmountSum = useMemo(
    () => companyOpportunities.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    [companyOpportunities],
  );
  const displayFacturacion =
    fromApiById && apiRecord && typeof apiRecord.facturacionEstimada === 'number'
      ? apiRecord.facturacionEstimada
      : opportunitiesAmountSum;

  const initialCompanyActivities = useMemo(() => {
    if (fromApiById) return [];
    const contactIds = new Set(companyContacts.map((l) => l.id));
    return activities.filter((a) => a.contactId && contactIds.has(a.contactId));
  }, [fromApiById, companyContacts]);
  const [mockActivities, setMockActivities] = useState(initialCompanyActivities);

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

  const createActivity = useActivitiesStore((s) => s.createActivity);
  const updateActivity = useActivitiesStore((s) => s.updateActivity);
  const deleteActivity = useActivitiesStore((s) => s.deleteActivity);
  const {
    activities: apiActivities,
    setActivities: setApiActivities,
    wrapUpdate,
    wrapDelete,
  } = useEntityActivityList(
    fromApiById && apiRecord?.id
      ? { linkedToCompanyId: apiRecord.id, excludeType: 'tarea' }
      : null,
  );
  const companyActivities = fromApiById ? apiActivities : mockActivities;
  const setCompanyActivities = fromApiById ? setApiActivities : setMockActivities;
  const updateEntityActivity = useMemo(
    () => wrapUpdate(updateActivity),
    [wrapUpdate, updateActivity],
  );
  const deleteEntityActivity = useMemo(
    () => wrapDelete(deleteActivity),
    [wrapDelete, deleteActivity],
  );
  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newOppOpen, setNewOppOpen] = useState(false);

  const [addExistingOppOpen, setAddExistingOppOpen] = useState(false);
  const [linkOppIds, setLinkOppIds] = useState<string[]>([]);
  const [linkOppSearch, setLinkOppSearch] = useState('');

  const oppLinkPickerFilter = useMemo((): OpportunityPickerExcludeFilter | null => {
    if (
      fromApiById &&
      resolvedCompanyId &&
      isLikelyCompanyCuid(resolvedCompanyId)
    ) {
      return { excludeCompanyLinkId: resolvedCompanyId };
    }
    return null;
  }, [fromApiById, resolvedCompanyId]);

  const {
    items: linkPickerApiRows,
    loading: linkOppPickerLoading,
    loadingMore: linkOppPickerLoadingMore,
    hasMore: linkOppPickerHasMore,
    loadMore: linkOppPickerLoadMore,
  } = usePaginatedOpportunityPicker(
    addExistingOppOpen,
    linkOppSearch,
    oppLinkPickerFilter,
    25,
  );

  const [newContactOpen, setNewContactOpen] = useState(false);

  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

  const contactLinkPickerOptions = useMemo((): PaginatedContactPickerOptions | null => {
    if (
      fromApiById &&
      resolvedCompanyId &&
      isLikelyCompanyCuid(resolvedCompanyId)
    ) {
      return { excludeCompanyLinkId: resolvedCompanyId, pageSize: 25 };
    }
    return null;
  }, [fromApiById, resolvedCompanyId]);

  const {
    items: linkContactPickerApiRows,
    loading: linkContactPickerLoading,
    loadingMore: linkContactPickerLoadingMore,
    hasMore: linkContactPickerHasMore,
    loadMore: linkContactPickerLoadMore,
  } = usePaginatedContactPicker(
    addExistingContactOpen,
    linkContactSearch,
    contactLinkPickerOptions,
  );

  const [noteText, setNoteText] = useState('');
  const [detailSectionTab, setDetailSectionTab] = useState<string>('historial');

  useEffect(() => {
    setDetailSectionTab('historial');
  }, [routeId]);

  const { addOpportunity, updateOpportunity, addContact, updateContact } = useCRMStore();

  // --- Edit / Etapa / Asignar dialogs ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!fromApiById) setMockActivities(initialCompanyActivities);
  }, [fromApiById, initialCompanyActivities]);

  const noteActivities = useMemo(
    () => companyActivities.filter((activity) => activity.type === 'nota'),
    [companyActivities],
  );

  const [companyTimelineEvents, setCompanyTimelineEvents] = useState<TimelineEvent[]>([]);
  const [companyTimelineLoading, setCompanyTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  const handleQuickActivityCreated = useCallback(async (draft: QuickActivityDraft) => {
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
        completedAt: completedAtNowIso(),
        createdAt: new Date().toISOString().slice(0, 10),
        contactId: persistedContactId ?? firstContact?.id,
        companyId: persistedCompanyId,
      },
      ...prev,
    ]);

    try {
      const saved = await createActivity({
        type: draft.type,
        title: draft.title,
        description: draft.description,
        assignedTo,
        status: 'completada',
        dueDate: draft.dueDate,
        startDate: draft.startDate,
        startTime: draft.startTime,
        completedAt: completedAtNowIso(),
        contactId: persistedContactId,
        companyId: persistedCompanyId,
      });
      setCompanyActivities((prev) => [
        saved,
        ...prev.filter((activity) => activity.id !== optimisticId && activity.id !== saved.id),
      ]);
      if (fromApiById && resolvedCompanyId) {
        void fetchActivityLogs({
          entityType: 'Empresa',
          entityId: resolvedCompanyId,
          page: 1,
          limit: 80,
        })
          .then((r) => setCompanyTimelineEvents(r.data.map(activityLogToTimelineEvent)))
          .catch(() => undefined);
      }
      return saved.callGoal ? { callGoal: saved.callGoal } : undefined;
    } catch (error) {
      setCompanyActivities((prev) => prev.filter((activity) => activity.id !== optimisticId));
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la actividad');
      throw error;
    }
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
  const companyEditRow = useMemo((): CompanyEditSummaryRow | null => {
    if (!editDialogOpen) return null;
    if (fromApiById && apiRecord) {
      return {
        id: apiRecord.id,
        name: apiRecord.name,
        rubro: apiRecord.rubro,
        tipo: apiRecord.tipo,
        fuente: apiRecord.fuente,
      };
    }
    if (standaloneCompany) {
      return {
        id: standaloneCompany.id,
        name: standaloneCompany.name,
        isLocalOnly: true,
        rubro: standaloneCompany.rubro,
        tipo: standaloneCompany.tipo,
      };
    }
    if (companyName) {
      return {
        id: typeof resolvedCompanyId === 'string' ? resolvedCompanyId : companyName,
        name: companyName,
        rubro: companyData?.rubro,
        tipo: companyData?.tipo,
        fuente: firstContact?.fuente,
      };
    }
    return null;
  }, [
    editDialogOpen,
    fromApiById,
    apiRecord?.id,
    apiRecord?.name,
    apiRecord?.rubro,
    apiRecord?.tipo,
    apiRecord?.fuente,
    standaloneCompany?.id,
    standaloneCompany?.name,
    standaloneCompany?.rubro,
    standaloneCompany?.tipo,
    companyName,
    resolvedCompanyId,
    companyData?.name,
    companyData?.rubro,
    companyData?.tipo,
    firstContact?.fuente,
  ]);


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
    setEditDialogOpen(true);
  }

  function handleSaveCompanyEdit(payload: CompanyEditSavePayload) {
    if (fromApiById && apiRecord) {
      void (async () => {
        toast.loading('Guardando cambios…', { id: `edit-company-${apiRecord.id}` });
        try {
          const body: Record<string, unknown> = {
            name: payload.name.trim(),
            domain: payload.domain?.trim() || undefined,
            telefono: payload.telefono?.trim() || undefined,
            rubro: payload.rubro || undefined,
            tipo: payload.tipo || undefined,
            ruc: payload.ruc?.trim() || undefined,
            razonSocial: payload.razonSocial?.trim() || undefined,
            fuente: payload.fuente || undefined,
          };
          if (canEditAssignee && showAdvisorInCompanyEdit && payload.assignedTo) {
            if (!isLikelyContactCuid(payload.assignedTo)) {
              toast.error('El asesor seleccionado no es válido.', { id: `edit-company-${apiRecord.id}` });
              return;
            }
            body.assignedTo = payload.assignedTo;
          }
          const row = await api<ApiCompanyRecord>(`/companies/${apiRecord.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          });
          setApiRecord(row);
          const nextPath = companyDetailHref(row);
          if (nextPath.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) {
            navigate(nextPath, { replace: true });
          }
          toast.success('Empresa actualizada', { id: `edit-company-${apiRecord.id}` });
        } catch (e) {
          const freshRow = await api<ApiCompanyRecord>(`/companies/${apiRecord.id}`).catch(() => apiRecord);
          setApiRecord(freshRow);
          toast.error(e instanceof Error ? e.message : 'Error al guardar', { id: `edit-company-${apiRecord.id}` });
        }
      })();
      return;
    }
    if (isStandalone && standaloneCompany) {
      updateCompany(standaloneCompany.id, {
        name: payload.name,
        domain: payload.domain || undefined,
        rubro: (payload.rubro || undefined) as CompanyRubro | undefined,
        tipo: (payload.tipo || undefined) as CompanyTipo | undefined,
      });
    } else {
      for (const contact of companyContacts) {
        const updatedCompanies = (contact.companies ?? []).map((c) => {
          if (c.name.trim().toLowerCase() === companyName.trim().toLowerCase()) {
            return {
              ...c,
              name: payload.name,
              domain: payload.domain || undefined,
              rubro: (payload.rubro || undefined) as CompanyRubro | undefined,
              tipo: (payload.tipo || undefined) as CompanyTipo | undefined,
            };
          }
          return c;
        });
        const assignPatch =
          canEditAssignee && showAdvisorInCompanyEdit && payload.assignedTo
            ? {
                assignedTo: payload.assignedTo,
                assignedToName:
                  users.find((u) => u.id === payload.assignedTo)?.name ?? 'Sin asignar',
              }
            : {};
        updateContact(contact.id, { companies: updatedCompanies, ...assignPatch });
      }
    }
    toast.success('Empresa actualizada correctamente');
    if (payload.name !== companyName) {
      navigate(companyDetailPath({ name: payload.name }), { replace: true });
    }
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
        toast.loading('Guardando…', { id: 'create-opp-empresa' });
        const contactIds = opportunityContactIdsFromForm(data);
        const merged: NewOpportunityFormValues = {
          ...data,
          companyId: companyIdStr,
          contactId: contactIds[0] ?? '',
          contactIds,
        };
        const body = buildOpportunityCreateBody(merged);
        const created = await api<{ id: string }>('/opportunities', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await linkOpportunityExtraContacts(created.id, contactIds);
        await reloadOpportunityLists();
        toast.success(`Oportunidad "${data.title.trim()}" creada`, { id: 'create-opp-empresa' });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad', { id: 'create-opp-empresa' });
        throw e;
      }
      return;
    }

    const contactIds = opportunityContactIdsFromForm(data);
    const ensuredIds =
      contactIds.length > 0
        ? contactIds
        : firstContact
          ? [firstContact.id]
          : [];
    if (ensuredIds.length === 0) {
      toast.error('Añade al menos un contacto vinculado a la empresa.');
      throw new Error('no contact');
    }
    const primaryContact =
      (firstContact && ensuredIds.includes(firstContact.id) ? firstContact : null)
      ?? firstContact;
    const merged: NewOpportunityFormValues = {
      ...data,
      contactId: ensuredIds[0],
      contactIds: ensuredIds,
      companyId: companyIdStr || data.companyId,
    };
    if (resolvedCompanyId && isLikelyContactCuid(ensuredIds[0])) {
      try {
        const body = buildOpportunityCreateBody(merged);
        const created = await api<{ id: string }>('/opportunities', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await linkOpportunityExtraContacts(created.id, ensuredIds);
        await reloadOpportunityLists();
        toast.success(`Oportunidad "${data.title.trim()}" creada`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        throw e;
      }
      return;
    }
    addOpportunity({
      title: data.title.trim(),
      contactId: ensuredIds[0],
      contactName: primaryContact?.name ?? '',
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
    if (linkOppIds.length === 0) return;

    if (fromApiById) {
      const companyKey = apiRecord?.id ?? routeId;
      if (!companyKey || !isLikelyCompanyCuid(companyKey)) {
        toast.error('Empresa no disponible');
        return;
      }
      const ids = linkOppIds.filter((oppId) => isLikelyOpportunityCuid(oppId));
      if (ids.length === 0) {
        toast.error('No hay oportunidades válidas para vincular');
        return;
      }

      void (async () => {
        try {
          toast.loading('Vinculando…', { id: 'link-opp-empresa' });
          const body: Record<string, unknown> = { companyId: companyKey };
          if (firstContact?.id && isLikelyContactCuid(firstContact.id)) {
            body.contactId = firstContact.id;
          }
          await Promise.all(
            ids.map((oppId) =>
              api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
              }),
            ),
          );
          await reloadOpportunityLists();
          setLinkOppIds([]);
          setLinkOppSearch('');
          setAddExistingOppOpen(false);
          toast.success(
            ids.length === 1
              ? 'Oportunidad vinculada'
              : `${ids.length} oportunidades vinculadas`,
            { id: 'link-opp-empresa' },
          );
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo vincular',
            { id: 'link-opp-empresa' },
          );
          await reloadOpportunityLists();
        }
      })();
      return;
    }

    if (!firstContact) return;
    for (const oppId of linkOppIds) {
      updateOpportunity(oppId, { contactId: firstContact.id, contactName: firstContact.name });
    }
    toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
    setLinkOppIds([]);
    setLinkOppSearch('');
    setAddExistingOppOpen(false);
  }

async function handleCreateNewContact(data: NewContactData) {
  setNewContactOpen(false);
  const LOADING_ID = 'create-contact-empresa';
  toast.loading('Guardando…', { id: LOADING_ID });
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
              `Contacto creado. ${nFail} oportunidad(es) no se pudieron vincular.`,
            );
          } else {
            toast.success(
              `Contacto creado y vinculado a ${opportunityIdsToLink.length} oportunidad${opportunityIdsToLink.length > 1 ? 'es' : ''}`,
              { id: LOADING_ID },
            );
          }
        } else {
          toast.success('Contacto creado y vinculado a la empresa', { id: LOADING_ID });
        }
        void Promise.all([reloadContactsData(), reloadOpportunityLists()]).catch(() => {
          /* reconciliar con servidor; fallo silencioso para no duplicar toasts de éxito */
        });
      } catch (e) {
        removePendingContact(optId);
        toast.error(e instanceof Error ? e.message : 'No se pudo crear el contacto', { id: LOADING_ID });
      }
    })();
    return;
  }
  addContact({
    name: data.name,
    cargo: data.cargo,
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

  async function handleLinkContacts() {
    if (linkContactIds.length === 0) return;

    if (
      fromApiById &&
      resolvedCompanyId &&
      isLikelyCompanyCuid(resolvedCompanyId)
    ) {
      const companyKey = resolvedCompanyId;
      const ids = linkContactIds.filter((id) => isLikelyContactCuid(id));
      if (ids.length === 0) {
        toast.error('No hay contactos válidos para vincular');
        return;
      }
      try {
        toast.loading('Vinculando…', { id: 'link-contact-empresa' });
        await Promise.all(
          ids.map((contactId) =>
            contactAddCompany(contactId, companyKey, false),
          ),
        );
        await reloadContactsData();
        toast.success(
          ids.length === 1
            ? 'Contacto vinculado'
            : `${ids.length} contactos vinculados`,
          { id: 'link-contact-empresa' },
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo vincular', { id: 'link-contact-empresa' });
        await reloadContactsData();
      }
      setLinkContactIds([]);
      setLinkContactSearch('');
      setAddExistingContactOpen(false);
      return;
    }

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

  function handleRemoveOpportunity(opp: import('@/types').Opportunity) {
    if (fromApiById && isLikelyOpportunityCuid(opp.id)) {
      const companyKey = apiRecord?.id ?? routeId;
      if (!companyKey) {
        toast.error('Empresa no disponible');
        return;
      }
      const oppId = opp.id;
      setApiOpportunityRows((prev) =>
        prev.map((row) => {
          if (row.id !== oppId) return row;
          const existing = row.companies ?? [];
          const next = existing.filter((c) => c.company?.id !== companyKey);
          if (next.length === existing.length) return row;
          return {
            ...row,
            companies: next,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      toast.success('Oportunidad desvinculada de la empresa');

      void (async () => {
        try {
          await opportunityUnlinkCompany(oppId, companyKey);
          void reloadOpportunityLists();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
          await reloadOpportunityLists();
        }
      })();
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
        await reloadContactsData();
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
  const companyOppIdSet = new Set(companyOpportunities.map((o) => o.id));
  const availableOpps = opportunities.filter((o) => {
    if (companyOppIdSet.has(o.id)) return false;
    if (
      resolvedCompanyId &&
      (o.clientId === resolvedCompanyId ||
        (o.linkedCompanyIds?.includes(resolvedCompanyId) ?? false))
    ) {
      return false;
    }
    /**
     * Mock: evitar duplicar la misma relación contacto–empresa en el store local.
     * API: no aplicar — el vínculo empresa–oportunidad es `CompanyOpportunity`; un
     * contacto de la empresa puede ser el principal de la opp y aun así hay que
     * poder volver a vincular tras desvincular solo la empresa.
     */
    if (!fromApiById && o.contactId && contactIds.has(o.contactId)) return false;
    return true;
  });
  const oppStatusLabels: Record<string, string> = {
    abierta: 'Abierta',
    ganada: 'Ganada',
    perdida: 'Perdida',
    suspendida: 'Suspendida',
  };

  const oppLinkItemsFromApiPicker: LinkExistingItem[] = [];
  for (const row of linkPickerApiRows) {
    const o = mapApiOpportunityToOpportunity(row);
    if (companyOppIdSet.has(o.id)) continue;
    if (
      resolvedCompanyId &&
      (o.clientId === resolvedCompanyId ||
        (o.linkedCompanyIds?.includes(resolvedCompanyId) ?? false))
    ) {
      continue;
    }
    if (!fromApiById && o.contactId && contactIds.has(o.contactId)) continue;
    oppLinkItemsFromApiPicker.push({
      id: o.id,
      title: o.title,
      subtitle: `${formatCurrency(o.amount)} · ${oppStatusLabels[o.status] ?? o.status}`,
      status: getStageLabelFromCatalog(o.etapa, crmBundle, etapaLabels as Record<string, string>),
      icon: <DollarSign className="size-4" />,
    });
  }

  const oppLinkItems: LinkExistingItem[] = fromApiById
    ? oppLinkItemsFromApiPicker
    : availableOpps.map((o) => ({
        id: o.id,
        title: o.title,
        subtitle: `${formatCurrency(o.amount)} · ${oppStatusLabels[o.status] ?? o.status}`,
        status: getStageLabelFromCatalog(o.etapa, crmBundle, etapaLabels as Record<string, string>),
        icon: <DollarSign className="size-4" />,
      }));

  const availableContacts = contacts.filter((l) => !contactIds.has(l.id));
  const contactLinkItemsFromApiPicker: LinkExistingItem[] = linkContactPickerApiRows.map(
    (row) => {
      const c = mapApiContactRowToContact(row);
      return {
        id: c.id,
        title: c.name,
        subtitle: c.cargo?.trim() || undefined,
        status: getStageLabelFromCatalog(c.etapa, crmBundle, etapaLabels as Record<string, string>),
        icon: <Users className="size-4" />,
      };
    },
  );
  const contactLinkItems: LinkExistingItem[] =
    fromApiById && contactLinkPickerOptions
      ? contactLinkItemsFromApiPicker
      : availableContacts.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: c.cargo?.trim() || undefined,
          status: getStageLabelFromCatalog(c.etapa, crmBundle, etapaLabels as Record<string, string>),
          icon: <Users className="size-4" />,
        }));

  const followUpAssociations = useMemo(() => {
    const contactId =
      firstContact?.id && isLikelyContactCuid(firstContact.id) ? firstContact.id : undefined;
    return taskAssociationsFromActivity({
      contactId,
      contactName: firstContact?.name,
      companyId: resolvedCompanyId,
      companyName: companyData?.name ?? companyName,
      opportunityId: companyOpportunities[0]?.id,
      opportunityTitle: companyOpportunities[0]?.title,
    } as Activity);
  }, [firstContact, resolvedCompanyId, companyData, companyName, companyOpportunities]);

  const companiesForTaskForm = useMemo(() => {
    const primary: { name: string; id?: string }[] =
      companyData?.name || companyName
        ? [{
            name: companyData?.name ?? companyName,
            id: (fromApiById && apiRecord?.id) || resolvedCompanyId,
          }]
        : [];
    return mergeCompaniesForTaskPicker(
      [...primary, ...linkedCompanies.map((c) => ({ name: c.name, id: c.id }))],
      followUpAssociations,
    );
  }, [
    companyData,
    companyName,
    fromApiById,
    apiRecord?.id,
    resolvedCompanyId,
    linkedCompanies,
    followUpAssociations,
  ]);

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
        <Button variant="ghost" onClick={() => navigate(APP_PATHS.companies)}>
          <Building2 className="size-4" /> Volver a Empresas
        </Button>
        <EmptyState
          icon={Building2}
          title="Empresa no encontrada"
          description={apiError ?? 'La empresa que buscas no existe.'}
          actionLabel="Volver a Empresas"
          onAction={() => navigate(APP_PATHS.companies)}
        />
      </div>
    );
  }

  const isStandalone =
    companyContacts.length === 0 &&
    (!!standaloneCompany || (fromApiById && !!apiRecord));

const subtitle = [
  companyData?.domain,
  companyData?.rubro ? getRubroLabelFromCatalog(companyData.rubro, crmBundle) : null,
  companyData?.tipo ? `Tipo ${companyData.tipo}` : null,
].filter(Boolean).join(' · ');

const displayLastInteraction = companyTimelineEvents[0]?.date
  ?? companyActivities[0]?.createdAt
  ?? companyActivities[0]?.dueDate
  ?? null;

return (
    <>
    <DetailLayout
      backPath={APP_PATHS.companies}
      title={companyData?.name ?? companyName}
      subtitle={subtitle || undefined}
      header={(
        <CompanyHeader
          backPath={APP_PATHS.companies}
          name={companyData?.name ?? companyName}
          subtitle={subtitle || undefined}
          stageLabel={displayEtapaLabel}
          stageClassName={stageTone.className}
          stageStyle={stageTone.style}
          currentEtapaSlug={displayEtapaKey ?? ''}
          onEtapaChange={undefined}
          estimatedValueLabel={formatCurrency(displayFacturacion)}
          quickActions={(
            <QuickActionsWithDialogs
              entityName={companyName}
              contacts={companyContacts}
              companies={companiesForTaskForm}
              opportunities={companyOpportunities}
              contactId={firstContact?.id}
              followUpAssociations={followUpAssociations}
              onActivityCreated={handleQuickActivityCreated}
              onTaskCreated={() => { void tasksTabRef.current?.reload(); }}
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
                icon: Buildings2SvgIcon,
                value: companyData?.name ?? companyName,
                truncate: true,
              },
              ...(fromApiById && apiRecord?.razonSocial?.trim()
                ? [
                    {
                      icon: FileText,
                      value: apiRecord.razonSocial.trim(),
                      truncate: true,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.ruc?.trim()
                ? [
                    {
                      icon: Hash,
                      value: apiRecord.ruc.trim(),
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.telefono
                ? [
                    {
                      icon: LlamadaSvgIcon,
                      value: apiRecord.telefono,
                      href: `tel:${apiRecord.telefono}`,
                    },
                  ]
                : []),
              ...(fromApiById && apiRecord?.correo?.trim()
                ? [
                    {
                      icon: LetterSvgIcon,
                      value: apiRecord.correo.trim(),
                      href: `mailto:${apiRecord.correo.trim()}`,
                    },
                  ]
                : []),
              ...(companyData?.domain
                ? [
                    {
                      icon: MapArrowSquareSvgIcon,
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
                      icon: Linkedin,
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
                      icon: SuitcaseSvgIcon,
                      value: getRubroLabelFromCatalog(companyData.rubro, crmBundle),
                    },
                  ]
                : []),
              ...(companyData?.tipo ? [{ label: 'Tipo:', value: companyData.tipo }] : []),
              ...(displayAssignedToName
                ? [{ icon: UsersGroupTwoRoundedSvgIcon, value: displayAssignedToName }]
                : []),
              ...(displayClienteRecuperado
                ? [{
                    icon: RefreshCw,
                    value: displayClienteRecuperado === 'si' ? 'Sí' : 'No',
                    label: 'Cliente recuperado:',
                  }]
                : []),
              ...(displayCreatedAt
                ? [{ icon: CalendarSvgIcon, value: `Creado: ${formatDate(displayCreatedAt)}` }]
                : []),
              ...(displayLastInteraction
                ? [{
                    icon: CalendarSvgIcon,
                    value: `Última interacción: ${formatDate(displayLastInteraction)}`,
                    label: '',
                  }]
                : []),
              ...(fromApiById && apiRecord?.fuente
                ? [
                    {
                      icon: MapArrowSquareSvgIcon,
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
            onContactNavigate={(c, e) => {
              if (isPendingContactId(c.id)) {
                toast.info('El contacto se está guardando; en unos segundos podrás abrir el detalle.');
                return;
              }
              navigateOnClick(e, contactDetailHref(c), navigate);
            }}
          />
        </>
      }
    >
      <Tabs value={detailSectionTab} onValueChange={setDetailSectionTab}>
        <div className="md:hidden space-y-1.5">
          <label htmlFor="empresa-detail-section" className="text-xs font-medium text-muted-foreground">
            Sección
          </label>
          <select
            id="empresa-detail-section"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={detailSectionTab}
            onChange={(e) => setDetailSectionTab(e.target.value)}
          >
            {ENTITY_DETAIL_SECTION_TAB_OPTIONS.map((opt) => (
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
          <TabsTrigger value="historial" className="text-xs px-2 sm:text-sm sm:px-4">Historial</TabsTrigger>
          <TabsTrigger value="actividades" className="text-xs px-2 sm:text-sm sm:px-4">Actividades</TabsTrigger>
          <TabsTrigger value="tareas" className="text-xs px-2 sm:text-sm sm:px-4">Tareas</TabsTrigger>
          <TabsTrigger value="notas" className="text-xs px-2 sm:text-sm sm:px-4">Notas</TabsTrigger>
          <TabsTrigger value="archivos" className="gap-1.5 text-xs px-2 sm:text-sm sm:px-4">
            <FileArchive className="size-3.5" />
            Archivos
          </TabsTrigger>
        </TabsList>

<TabsContent value="historial" className="mt-4">
  <Card>
    <CardContent className="p-3 sm:p-5">
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
          <ActivityPanel activities={companyActivities} onUpdateActivity={updateEntityActivity} onDeleteActivity={deleteEntityActivity} />
        </TabsContent>

        <TabsContent value="archivos" className="mt-4">
          <EntityFilesTab
            entityType="company"
            entityId={resolvedCompanyId ?? ''}
            entityName={companyName}
          />
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          <EntityNotesTab
            notes={noteActivities}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            onAddNote={handleAddNote}
            onUpdateActivity={updateEntityActivity}
            onDeleteActivity={deleteEntityActivity}
          />
        </TabsContent>

        <TabsContent value="tareas" className="mt-4">
          <TasksTab
            ref={tasksTabRef}
            contacts={companyContacts}
            companies={companiesForTaskForm}
            opportunities={companyOpportunities}
            defaultAssigneeId={firstContact?.assignedTo}
            onActivityCreated={(activity) => {
              setCompanyActivities((prev) => [activity as Activity, ...prev.filter((row) => row.id !== activity.id)]);
              if (fromApiById && resolvedCompanyId) {
                void fetchActivityLogs({
                  entityType: 'Empresa',
                  entityId: resolvedCompanyId,
                  page: 1,
                  limit: 80,
                })
                  .then((r) => setCompanyTimelineEvents(r.data.map(activityLogToTimelineEvent)))
                  .catch(() => undefined);
              }
            }}
            contactId={firstContact?.id}
            companyId={resolvedCompanyId}
          />
        </TabsContent>
      </Tabs>
    </DetailLayout>

    <NewOpportunityFormDialog
      open={newOppOpen}
      onOpenChange={setNewOppOpen}
      title="Crear nueva oportunidad"
      defaultContactId={firstContact?.id ?? ''}
      defaultContactName={firstContact?.name ?? ''}
      defaultCompanyId={typeof resolvedCompanyId === 'string' ? resolvedCompanyId : ''}
      defaultCompanyName={companyName}
      defaultCompanyFuente={
        (fromApiById && apiRecord?.fuente) || firstContact?.fuente || ''
      }
      lockContactSelection={!!firstContact}
      lockCompanySelection={!!resolvedCompanyId}
      onCreate={handleCreateOpportunity}
    />

    {/* Vincular oportunidad existente */}
    <LinkExistingDialog
      open={addExistingOppOpen}
      onOpenChange={(open) => { setAddExistingOppOpen(open); if (!open) { setLinkOppIds([]); setLinkOppSearch(''); } }}
      title="Vincular oportunidad"
      searchPlaceholder="Buscar por título…"
      itemKind="oportunidad"
      contactName={companyName}
      items={oppLinkItems}
      selectedIds={linkOppIds}
      onSelectionChange={setLinkOppIds}
      onConfirm={handleLinkOpportunities}
      searchValue={linkOppSearch}
      onSearchChange={setLinkOppSearch}
      emptyMessage="No hay oportunidades disponibles para vincular. Prueba a buscar por título."
      serverFilteredList={fromApiById}
      listLoading={fromApiById && !!oppLinkPickerFilter && linkOppPickerLoading}
      listLoadingMore={fromApiById && !!oppLinkPickerFilter && linkOppPickerLoadingMore}
      hasMore={fromApiById && !!oppLinkPickerFilter && linkOppPickerHasMore}
      onLoadMore={fromApiById && oppLinkPickerFilter ? linkOppPickerLoadMore : undefined}
    />

{/* Crear nuevo contacto */}
<NewContactWizard
  open={newContactOpen}
  onOpenChange={setNewContactOpen}
  onSubmit={handleCreateNewContact}
  title="Crear nuevo contacto"
  submitLabel="Crear y vincular"
  singlePage
  lockCompanySelection
  defaultCompanyId={resolvedCompanyId}
  defaultOpportunityIds={companyOpportunities.map((o) => o.id)}
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
      title="Vincular contacto"
      searchPlaceholder="Buscar por nombre, correo, cargo…"
      itemKind="contacto"
      contactName={companyName}
      items={contactLinkItems}
      selectedIds={linkContactIds}
      onSelectionChange={setLinkContactIds}
      onConfirm={() => void handleLinkContacts()}
      searchValue={linkContactSearch}
      onSearchChange={setLinkContactSearch}
      emptyMessage="No hay contactos disponibles para vincular. Prueba a buscar."
      serverFilteredList={fromApiById && !!contactLinkPickerOptions}
      listLoading={fromApiById && !!contactLinkPickerOptions && linkContactPickerLoading}
      listLoadingMore={fromApiById && !!contactLinkPickerOptions && linkContactPickerLoadingMore}
      hasMore={fromApiById && !!contactLinkPickerOptions && linkContactPickerHasMore}
      onLoadMore={fromApiById && contactLinkPickerOptions ? linkContactPickerLoadMore : undefined}
    />

    <CompanyEditDialog
      row={companyEditRow}
      initialRecord={editDialogOpen && fromApiById ? apiRecord : null}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      onSave={handleSaveCompanyEdit}
    />

    </>
  );
}
