import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, RefreshCw, UserPlus,
  Phone, Mail, Users,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  Plus, FileArchive, Loader2,
} from 'lucide-react';
import type { Contact, Etapa, CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import {
  contactSourceLabels, etapaLabels,
  companyRubroLabels,
  timelineEvents, activities,
} from '@/data/mock';
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
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { EntityFilesTab } from '@/components/files';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
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

const initialNotes = [
  { id: 'n1', text: 'El cliente prefiere vehículos SUV para su equipo directivo. Requiere servicio 24/7.', author: 'Ana Torres', date: '2026-03-02' },
  { id: 'n2', text: 'Llamada de seguimiento realizada. El cliente está evaluando propuestas de la competencia.', author: 'Carlos Mendoza', date: '2026-03-04' },
  { id: 'n3', text: 'Se acordó enviar tarifas diferenciadas según volumen de uso mensual.', author: 'María García', date: '2026-03-05' },
];



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
  const fromApi = isLikelyContactCuid(routeId);
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

  const defaultContactIdForNewOpp = useMemo(() => {
    if (fromApi && isLikelyContactCuid(routeId)) return routeId;
    return contact?.id ?? '';
  }, [fromApi, routeId, contact?.id]);

  const defaultCompanyIdForNewOpp = useMemo(() => {
    if (!contact) return '';
    const pc = getPrimaryCompany(contact);
    return pc?.id ?? '';
  }, [contact]);

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [contactActivities, setContactActivities] = useState(initialActivities);
  const [notes, setNotes] = useState(initialNotes);
  const [noteText, setNoteText] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
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
  const [editForm, setEditForm] = useState({
    name: '',
    cargo: '',
    telefono: '',
    correo: '',
    fuente: '' as ContactSource,
    estimatedValue: 0,
    nextAction: '',
    nextFollowUp: '',
  });

  useEffect(() => {
    setContactActivities(initialActivities);
  }, [initialActivities]);

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

  function handleAddNote() {
    if (!noteText.trim()) return;
    setNotes((prev) => [
      { id: `n-${Date.now()}`, text: noteText.trim(), author: 'Tú', date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
      setNoteText('');
    toast.success('Nota agregada correctamente');
  }

  function handleOpenEditDialog() {
    if (!contact) return;
    setEditForm({
      name: contact.name,
      cargo: contact.cargo ?? '',
      telefono: contact.telefono,
      correo: contact.correo,
      fuente: contact.fuente,
      estimatedValue: contact.estimatedValue,
      nextAction: contact.nextAction,
      nextFollowUp: contact.nextFollowUp,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!contact) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const updated = await api<ApiContactDetail>(`/contacts/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: editForm.name.trim(),
              cargo: editForm.cargo.trim() || null,
              telefono: editForm.telefono.trim(),
              correo: editForm.correo.trim(),
              fuente: editForm.fuente,
              estimatedValue: editForm.estimatedValue,
              nextAction: editForm.nextAction.trim() || null,
              nextFollowUp: editForm.nextFollowUp.trim() || null,
            }),
          });
          setApiRecord(updated);
          toast.success('Contacto actualizado correctamente');
          setEditDialogOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
        }
      })();
      return;
    }
    updateContact(contact.id, {
      name: editForm.name,
      cargo: editForm.cargo || undefined,
      telefono: editForm.telefono,
      correo: editForm.correo,
      fuente: editForm.fuente,
      estimatedValue: editForm.estimatedValue,
      nextAction: editForm.nextAction,
      nextFollowUp: editForm.nextFollowUp,
    });
    toast.success('Contacto actualizado correctamente');
    setEditDialogOpen(false);
  }


  async function handleConvertToOpportunity(data: NewOpportunityFormValues) {
    if (!contact) {
      toast.error('No hay contacto');
      throw new Error('no contact');
    }
    const contactId = fromApi && isLikelyContactCuid(routeId) ? routeId : contact.id;
    const merged: NewOpportunityFormValues = {
      ...data,
      contactId,
      companyId: defaultCompanyIdForNewOpp || data.companyId,
    };
    if (fromApi && isLikelyContactCuid(routeId)) {
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

  async function handleAddCompany(data: NewCompanyData) {
    if (!contact) return;
    if (fromApi && routeId) {
      try {
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
    if (fromApi && isLikelyContactCuid(routeId)) {
      void (async () => {
        try {
          for (const oppId of linkOpportunityIds) {
            if (isLikelyOpportunityCuid(oppId)) {
              await api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify({ contactId: routeId }),
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
        let companyId: string | undefined = data.companyId;
        if (data.newCompanyWizardData) {
          const created = await api<ApiCompanyRecord>('/companies', {
            method: 'POST',
            body: JSON.stringify({
              name: data.newCompanyWizardData.nombreComercial.trim(),
              razonSocial: data.newCompanyWizardData.razonSocial.trim() || undefined,
              ruc: data.newCompanyWizardData.ruc.trim() || undefined,
              telefono: data.newCompanyWizardData.telefono.trim() || undefined,
              domain: data.newCompanyWizardData.dominio.trim() || undefined,
              rubro: data.newCompanyWizardData.rubro || undefined,
              tipo: data.newCompanyWizardData.tipoEmpresa || undefined,
              linkedin: data.newCompanyWizardData.linkedin.trim() || undefined,
              correo: data.newCompanyWizardData.correo.trim() || undefined,
              distrito: data.newCompanyWizardData.distrito.trim() || undefined,
              provincia: data.newCompanyWizardData.provincia.trim() || undefined,
              departamento: data.newCompanyWizardData.departamento.trim() || undefined,
              direccion: data.newCompanyWizardData.direccion.trim() || undefined,
            }),
          });
          companyId = created.id;
        } else if (data.companyId) {
          companyId = data.companyId;
        }
        const today = new Date().toISOString().slice(0, 10);
        const createdContact = await api<ApiContactDetail>('/contacts', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name.trim(),
            telefono: data.phone?.trim() || contact.telefono,
            correo: data.email?.trim() || contact.correo,
            fuente: data.source,
            cargo: data.cargo?.trim() || undefined,
            etapa: data.etapaCiclo,
            assignedTo: data.assignedTo?.trim() || undefined,
            estimatedValue: data.estimatedValue ?? 0,
            nextAction: 'Contactar',
            notes: data.notes?.trim() || undefined,
            docType: data.docType || undefined,
            docNumber: data.docNumber?.trim() || undefined,
            departamento: data.departamento?.trim() || undefined,
            provincia: data.provincia?.trim() || undefined,
            distrito: data.distrito?.trim() || undefined,
            direccion: data.direccion?.trim() || undefined,
            clienteRecuperado: data.clienteRecuperado || undefined,
            etapaHistory: [{ etapa: data.etapaCiclo, fecha: today }],
            companyId,
          }),
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
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw /> Cambiar Etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus /> Asignar
          </Button>
        </>
      }
      quickActions={
        <QuickActionsWithDialogs
          entityName={contact.name}
          contacts={mergedContacts.filter((l) => l.id !== contact.id)}
          companies={contact.companies ?? []}
          opportunities={contactOpportunities}
          contactId={id}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setContactActivities((prev) => [activity, ...prev])}
        />
      }
      summaryCards={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <DollarSign className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Valor estimado</p>
                    <p className="text-l font-semibold">{formatCurrency(contact.estimatedValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <RefreshCw className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Etapa actual</p>
                    <p className="text-l font-semibold">{etapaLabels[contact.etapa]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <CalendarDays className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Próximo seguimiento</p>
                    <p className="text-l font-semibold">{formatDate(contact.nextFollowUp)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Users className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Asesor asignado</p>
                    <p className="text-l font-semibold truncate">{contact.assignedToName}</p>
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
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="archivos" className="gap-1.5">
              <FileArchive className="size-3.5" />
              Archivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actividades" className="mt-4">
            <ActivityPanel activities={contactActivities} onRegisterActivity={() => toast.info('Usa las acciones rápidas para registrar una actividad')} />
          </TabsContent>

          {/* Notas Tab */}
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
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-lg border p-4">
                      <p className="text-sm">{note.text}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{note.author}</span>
                        <span>·</span>
                        <span>{formatDate(note.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
              contactId={id}
            />
          </TabsContent>

          {/* Historial Tab */}
          <TabsContent value="historial" className="mt-4">
            <TimelinePanel events={timelineEvents} />
          </TabsContent>
        </Tabs>



    </DetailLayout>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Contacto</DialogTitle>
            <DialogDescription>Modifica los datos del contacto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cargo">Cargo</Label>
                <Input id="edit-cargo" value={editForm.cargo} onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input id="edit-phone" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Correo</Label>
                <Input id="edit-email" type="email" value={editForm.correo} onChange={(e) => setEditForm((f) => ({ ...f, correo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fuente</Label>
              <Select value={editForm.fuente} onValueChange={(v) => setEditForm((f) => ({ ...f, fuente: v as ContactSource }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(contactSourceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-value">Valor estimado (S/)</Label>
              <Input id="edit-value" type="number" min={0} value={editForm.estimatedValue} onChange={(e) => setEditForm((f) => ({ ...f, estimatedValue: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-next-action">Próxima acción</Label>
              <Input id="edit-next-action" value={editForm.nextAction} onChange={(e) => setEditForm((f) => ({ ...f, nextAction: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-followup">Próximo seguimiento</Label>
              <Input id="edit-followup" type="date" value={editForm.nextFollowUp} onChange={(e) => setEditForm((f) => ({ ...f, nextFollowUp: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.name.trim()}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
