import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw,
  Phone, Mail, Users,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  FileArchive, Loader2, CheckSquare,
} from 'lucide-react';
import type { Contact, Etapa, CompanyRubro, CompanyTipo, TimelineEvent } from '@/types';
import {
  contactSourceLabels, etapaLabels,
  companyRubroLabels,
  activities,
} from '@/data/mock';
import { fetchActivityLogs, activityLogToTimelineEvent } from '@/lib/activityLogsApi';
import { useUsers } from '@/hooks/useUsers';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany } from '@/lib/utils';

import { EmptyState } from '@/components/shared/EmptyState';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
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
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { EntityFilesTab } from '@/components/files';
import { ContactHeader } from '@/components/contact-detail/ContactHeader';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { nextPendingTaskForContact } from '@/lib/nextPendingTask';
import { useActivities } from '@/hooks/useActivities';
import { api } from '@/lib/api';
import { isEntityDetailApiParam } from '@/lib/detailRoutes';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  contactAddCompany,
  contactAddLinkedContact,
  contactRemoveCompany,
  contactRemoveLinkedContact,
  isLikelyContactCuid,
  linkedContactsFromApiDetail,
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
import { etapaColorsWithBorder } from '@/lib/etapaConfig';

function ContactoSidebar({ contact, contactOpportunities, linkedContacts, onOpenConvertDialog, onAddExistingOpportunity, onRemoveOpportunity, onAddCompany, onAddExistingCompany, onRemoveCompany, onNewContact, onAddLinkContact, onRemoveContact }: {
  contact: Contact;
  contactOpportunities: import('@/types').Opportunity[];
  /** Contactos vinculados (API o resueltos desde linkedContactIds en modo mock). */
  linkedContacts: Contact[];
  onOpenConvertDialog: () => void;
  onAddExistingOpportunity: () => void;
  onRemoveOpportunity?: (opp: import('@/types').Opportunity) => void;
  onAddCompany: () => void;
  onAddExistingCompany: () => void;
  onRemoveCompany?: (company: import('@/types').LinkedCompany) => void;
  onNewContact: () => void;
  onAddLinkContact: () => void;
  onRemoveContact?: (c: import('@/components/shared/LinkedContactsCard').LinkedContact) => void;
}) {
  return (
    <>
      <EntityInfoCard
        title="Información de Contacto"
        fields={[
          { icon: Phone, value: contact.telefono, href: `tel:${contact.telefono}` },
          { icon: Mail, value: contact.correo, href: `mailto:${contact.correo}` },
          { icon: Building2, value: getPrimaryCompany(contact)?.name ?? '—' },
          { icon: Globe, value: contactSourceLabels[contact.fuente] },
          { icon: CalendarDays, value: `Fecha de creación: ${formatDate(contact.createdAt)}` },
          ...(contact.departamento ? [{ icon: MapPin as typeof Phone, value: contact.departamento }] : []),
          ...(contact.provincia ? [{ label: 'Provincia:', value: contact.provincia, indent: true }] : []),
          ...(contact.distrito ? [{ label: 'Distrito:', value: contact.distrito, indent: true }] : []),
          ...(contact.direccion ? [{ label: 'Dirección:', value: contact.direccion, indent: true }] : []),
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

      <LinkedContactsCard
        contacts={linkedContacts}
        onCreate={onNewContact}
        onAddExisting={onAddLinkContact}
        onRemove={onRemoveContact}
      />
    </>
  );
}

export default function ContactoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeId = id ? decodeURIComponent(id) : '';
  const fromApi = isEntityDetailApiParam(routeId);
  const { contacts, opportunities, getOpportunitiesByContactId, addOpportunity, updateOpportunity, updateContact, addContact } = useCRMStore();
  const { users } = useUsers();

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

  const { activities: activitiesFromStore } = useActivities();
  const nextPendingSummary = useMemo(
    () => nextPendingTaskForContact(activitiesFromStore, contact?.id),
    [activitiesFromStore, contact?.id],
  );

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

  const contactOpportunities = useMemo(() => {
    if (fromApi && apiRecord?.opportunities?.length) {
      return opportunitiesFromApiContactDetail(apiRecord);
    }
    return routeId ? getOpportunitiesByContactId(routeId) : [];
  }, [fromApi, apiRecord, routeId, getOpportunitiesByContactId]);

  const linkedContactsForSidebar = useMemo(() => {
    if (fromApi && apiRecord) {
      return linkedContactsFromApiDetail(apiRecord);
    }
    if (!contact) return [];
    return (contact.linkedContactIds ?? [])
      .map((cid) => contacts.find((l) => l.id === cid))
      .filter((l): l is Contact => !!l);
  }, [fromApi, apiRecord, contact, contacts]);

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
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addLinkContactOpen, setAddLinkContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');
  const [addExistingOpportunityOpen, setAddExistingOpportunityOpen] = useState(false);
  const [linkOpportunityIds, setLinkOpportunityIds] = useState<string[]>([]);
  const [linkOpportunitySearch, setLinkOpportunitySearch] = useState('');
  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    setContactActivities(initialActivities);
  }, [initialActivities]);

  const [contactTimelineEvents, setContactTimelineEvents] = useState<TimelineEvent[]>([]);
  const [contactTimelineLoading, setContactTimelineLoading] = useState(false);

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

  // Los returns condicionales van después de todos los hooks
  if (fromApi && apiLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span>Cargando contacto…</span>
      </div>
    );
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
        const updated = await api<ApiContactDetail>(`/contacts/${routeId}`, {
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
        setApiRecord(updated);
        toast.success('Contacto actualizado correctamente');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        throw e;
      }
      return;
    }
    updateContact(contact.id, {
      name: payload.name,
      cargo: payload.cargo || undefined,
      telefono: payload.telefono,
      correo: payload.correo,
      fuente: payload.fuente,
      estimatedValue: payload.estimatedValue,
    });
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
      setStatusDialogOpen(false);
      return;
    }
    updateContact(contact.id, { etapa: newEtapa as Contact['etapa'] });
    toast.success('Etapa actualizada correctamente');
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    if (!contact) return;
    if (fromApi && routeId) {
      if (!isLikelyContactCuid(newAssigneeId)) {
        toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
        return;
      }
      void (async () => {
        try {
          const updated = await api<ApiContactDetail>(`/contacts/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ assignedTo: newAssigneeId }),
          });
          setApiRecord(updated);
          toast.success('Asesor asignado correctamente');
          setAssignDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
        }
      })();
      return;
    }
    const user = users.find((u) => u.id === newAssigneeId);
    updateContact(contact.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
    toast.success('Asesor asignado correctamente');
    setAssignDialogOpen(false);
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
              return Math.max(contact.estimatedValue, 1);
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
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la empresa');
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

  async function handleLinkContacts() {
    if (linkContactIds.length === 0 || !contact) return;
    if (fromApi && routeId) {
      try {
        for (const linkedId of linkContactIds) {
          if (linkedId !== routeId) {
            await contactAddLinkedContact(routeId, linkedId);
          }
        }
        const updated = await api<ApiContactDetail>(`/contacts/${routeId}`);
        setApiRecord(updated);
        toast.success(linkContactIds.length === 1 ? 'Contacto vinculado' : `${linkContactIds.length} contactos vinculados`);
        setLinkContactIds([]);
        setLinkContactSearch('');
        setAddLinkContactOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
      }
      return;
    }
    const ids = contact.linkedContactIds ?? [];
    const toAdd = linkContactIds.filter((id) => id !== contact.id && !ids.includes(id));
    if (toAdd.length === 0) return;
    updateContact(contact.id, { linkedContactIds: [...ids, ...toAdd] });
    toast.success(toAdd.length === 1 ? 'Contacto vinculado' : `${toAdd.length} contactos vinculados`);
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddLinkContactOpen(false);
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

  async function handleCreateNewContact(data: NewContactData) {
    if (!contact) return;
    if (fromApi && routeId) {
      try {
        const w = data.newCompanyWizardData;
        const today = new Date().toISOString().slice(0, 10);
        const baseBody: Record<string, unknown> = {
          name: data.name.trim(),
          telefono: data.phone?.trim() || contact.telefono,
          correo: data.email?.trim() || contact.correo,
          fuente: data.source,
          cargo: data.cargo?.trim() || undefined,
          etapa: data.etapaCiclo,
          assignedTo: data.assignedTo?.trim() || undefined,
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
              return data.estimatedValue > 0 ? data.estimatedValue : 0;
            })();
            if (factEmpresa <= 0) {
              toast.error(
                'Indica facturación estimada en el wizard de empresa o un valor estimado del contacto mayor que 0',
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
        await contactAddLinkedContact(routeId, createdContact.id);
        const updated = await api<ApiContactDetail>(`/contacts/${routeId}`);
        setApiRecord(updated);
        setNewContactOpen(false);
        toast.success('Contacto creado y vinculado correctamente');
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
      companies: [{ name: data.company }],
      telefono: data.phone || contact.telefono,
      correo: data.email || contact.correo,
      fuente: data.source,
      assignedTo: data.assignedTo || contact.assignedTo,
      estimatedValue: data.estimatedValue,
      clienteRecuperado: data.clienteRecuperado,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
    });
    const ids = contact.linkedContactIds ?? [];
    updateContact(contact.id, { linkedContactIds: [...ids, newContact.id] });
    toast.success('Contacto creado y vinculado');
    setNewContactOpen(false);
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

  async function handleRemoveContact(linkedContact: { id: string }) {
    if (!contact) return;
    if (fromApi && routeId) {
      try {
        const updated = await contactRemoveLinkedContact(routeId, linkedContact.id);
        setApiRecord(updated);
        toast.success('Contacto desvinculado');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    const ids = (contact.linkedContactIds ?? []).filter((id) => id !== linkedContact.id);
    updateContact(contact.id, { linkedContactIds: ids });
    toast.success('Contacto desvinculado');
  }

  const availableContactsToLink = mergedContacts.filter(
    (l) => l.id !== contact?.id && !(contact?.linkedContactIds ?? []).includes(l.id),
  );

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

  const contactLinkItems: LinkExistingItem[] = availableContactsToLink.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.telefono,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

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
          stageLabel={etapaLabels[contact.etapa] ?? contact.etapa}
          stageClassName={etapaColorsWithBorder[contact.etapa] ?? 'border-border bg-muted text-text-secondary'}
          estimatedValueLabel={formatCurrency(contact.estimatedValue)}
          onEdit={handleOpenEditDialog}
          onOpenWhatsapp={() => setWhatsappDrawerOpen(true)}
          onChangeStage={() => setStatusDialogOpen(true)}
          onAssign={() => setAssignDialogOpen(true)}
        />
      )}
      quickActions={
        <QuickActionsWithDialogs
          entityName={contact.name}
          contacts={mergedContacts.filter((l) => l.id !== contact.id)}
          companies={contact.companies ?? []}
          opportunities={contactOpportunities}
          contactId={contact.id}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setContactActivities((prev) => [activity, ...prev])}
        />
      }
      summaryCards={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-surface-elevated py-0 shadow-none">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-whatsapp/12 text-whatsapp">
                    <DollarSign className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Valor estimado</p>
                    <p className="text-l font-semibold text-text-primary">{formatCurrency(contact.estimatedValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-surface-elevated py-0 shadow-none">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stage-prospect/12 text-stage-prospect">
                    <RefreshCw className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Etapa actual</p>
                    <p className="text-l font-semibold text-text-primary">{etapaLabels[contact.etapa]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-surface-elevated py-0 shadow-none">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-activity-task/12 text-activity-task">
                    <Users className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Asesor asignado</p>
                    <p className="text-l font-semibold text-text-primary truncate">{contact.assignedToName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-surface-elevated py-0 shadow-none">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-activity-note/12 text-activity-note">
                    <CheckSquare className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary">Próxima acción</p>
                    <p
                      className="text-l font-semibold text-text-primary truncate"
                      title={nextPendingSummary?.title ?? undefined}
                    >
                      {nextPendingSummary?.title ?? '—'}
                    </p>
                    {nextPendingSummary ? (
                      <p className="text-xs text-text-tertiary">
                        Vence {formatDate(nextPendingSummary.dueDate)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
      }
      sidebar={<ContactoSidebar contact={contact} contactOpportunities={contactOpportunities} linkedContacts={linkedContactsForSidebar} onOpenConvertDialog={() => setConvertDialogOpen(true)} onAddExistingOpportunity={() => setAddExistingOpportunityOpen(true)} onRemoveOpportunity={handleRemoveOpportunity} onAddCompany={() => setAddCompanyOpen(true)} onAddExistingCompany={() => setAddExistingCompanyOpen(true)} onRemoveCompany={handleRemoveCompany} onNewContact={() => setNewContactOpen(true)} onAddLinkContact={() => setAddLinkContactOpen(true)} onRemoveContact={handleRemoveContact} />}
    >
        <Tabs defaultValue="historial">
          <TabsList variant="line" className="w-full justify-start flex-wrap">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="actividades">Actividades</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
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

          {/* Historial Tab */}
          <TabsContent value="historial" className="mt-4">
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
              <TimelinePanel events={contactTimelineEvents} />
            )}
          </TabsContent>
        </Tabs>



    </DetailLayout>

      <ContactEditDialog
        contact={contact}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handlePersistContactEdit}
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

      <NewContactWizard
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        onSubmit={handleCreateNewContact}
        title="Crear nuevo contacto"
        description={`Crea un nuevo contacto y vincúlalo a ${contact.name}.`}
        submitLabel="Crear y vincular"
      />

      {/* Vincular contacto Dialog */}
      <LinkExistingDialog
        open={addLinkContactOpen}
        onOpenChange={(open) => {
          setAddLinkContactOpen(open);
          if (!open) {
            setLinkContactIds([]);
            setLinkContactSearch('');
          }
        }}
        title="Vincular Contacto Existente"
        searchPlaceholder="Buscar contactos..."
        contactName={contact.name}
        items={contactLinkItems}
        selectedIds={linkContactIds}
        onSelectionChange={setLinkContactIds}
        onConfirm={handleLinkContacts}
        searchValue={linkContactSearch}
        onSearchChange={setLinkContactSearch}
        emptyMessage="No hay contactos disponibles para vincular."
      />

      <ChangeEtapaDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        entityName={contact.name}
        currentEtapa={contact.etapa}
        onEtapaChange={handleEtapaChange}
      />

      <AssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        entityName={contact.name}
        currentAssigneeId={contact.assignedTo}
        onAssignChange={handleAssignChange}
      />

      <WhatsappContactDrawer
        contact={contact}
        open={whatsappDrawerOpen}
        onOpenChange={setWhatsappDrawerOpen}
      />
    </>
  );
}
