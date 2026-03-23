import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Briefcase, DollarSign, Target, CalendarDays, User, Building2,
  Users, Edit, RefreshCw, UserPlus, Plus, FileArchive, Loader2,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { etapaLabels, companyRubroLabels, timelineEvents, activities } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { getPrimaryCompany } from '@/lib/utils';
import type { CompanyRubro, Etapa, OpportunityStatus } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';
import { NewOpportunityDialog, type NewOpportunityData } from '@/components/shared/NewOpportunityDialog';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { EntityFilesTab } from '@/components/files';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import {
  type ApiOpportunityDetail,
  isLikelyOpportunityCuid,
  mapApiContactToContact,
  mapApiOpportunityToOpportunity,
} from '@/lib/opportunityApi';
import { type ApiContactListRow, contactListAll, contactRemoveCompany, isLikelyContactCuid, mapApiContactRowToContact } from '@/lib/contactApi';
import { type ApiCompanyRecord } from '@/lib/companyApi';

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

const statusColors: Record<string, string> = {
  abierta: 'bg-blue-100 text-blue-700',
  ganada: 'bg-emerald-100 text-emerald-700',
  perdida: 'bg-red-100 text-red-700',
  suspendida: 'bg-amber-100 text-amber-700',
};

export default function OportunidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeId = id ? decodeURIComponent(id) : '';
  const fromApi = isLikelyOpportunityCuid(routeId);
  const { opportunities, contacts, getOpportunitiesByContactId, addOpportunity, updateOpportunity, updateContact, addContact } = useCRMStore();

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

  const { users } = useUsers();
  const storeOpp = opportunities.find((o) => o.id === routeId);

  const opp = useMemo(() => {
    if (fromApi) {
      if (!apiRecord) return undefined;
      return mapApiOpportunityToOpportunity(apiRecord);
    }
    return storeOpp;
  }, [fromApi, apiRecord, storeOpp]);

  const linkedContact = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.contacts?.[0]?.contact) {
      const c = apiRecord.contacts[0].contact;
      const fromStore = contacts.find((l) => l.id === c.id);
      return fromStore ?? mapApiContactToContact(c);
    }
    return opp.contactId ? contacts.find((l) => l.id === opp.contactId) ?? null : null;
  }, [fromApi, apiRecord, opp, contacts]);

  const primaryCompany = useMemo(() => {
    if (!opp) return null;
    if (fromApi && apiRecord?.companies?.[0]?.company) {
      const comp = apiRecord.companies[0].company;
      return { name: comp.name };
    }
    return linkedContact ? getPrimaryCompany(linkedContact) : null;
  }, [fromApi, apiRecord, opp, linkedContact]);

  const otherOpportunities = useMemo(() => {
    if (!linkedContact) return [];
    return getOpportunitiesByContactId(linkedContact.id).filter((o) => o.id !== routeId);
  }, [linkedContact, routeId, getOpportunitiesByContactId]);

  const assignedUser = useMemo(() => {
    if (!opp) return undefined;
    return users.find((u) => u.id === opp.assignedTo);
  }, [opp, users]);

  const initialOppActivities = useMemo(() => {
    if (!opp?.contactId) return [];
    return activities.filter((a) => a.contactId === opp.contactId);
  }, [opp]);
  const [oppActivities, setOppActivities] = useState(initialOppActivities);

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

  const [newOppOpen, setNewOppOpen] = useState(false);
  const [addExistingOppOpen, setAddExistingOppOpen] = useState(false);
  const [linkOppIds, setLinkOppIds] = useState<string[]>([]);
  const [linkOppSearch, setLinkOppSearch] = useState('');

  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);

  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');

  const [notes, setNotes] = useState([
    { id: 'n1', text: 'Negociación en fase avanzada, el cliente solicita condiciones especiales de pago.', author: 'Ana Torres', date: '2026-03-02' },
    { id: 'n2', text: 'Se envió propuesta final con descuento por volumen incluido.', author: 'Carlos Mendoza', date: '2026-03-04' },
  ]);
  const [noteText, setNoteText] = useState('');

  function handleAddNote() {
    if (!noteText.trim()) return;
    setNotes((prev) => [
      { id: `n-${Date.now()}`, text: noteText.trim(), author: 'Tú', date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
    setNoteText('');
    toast.success('Nota agregada correctamente');
  }

  // --- Edit / Etapa / Asignar dialogs ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', amount: 0, expectedCloseDate: '', status: '' as OpportunityStatus | '' });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  function handleOpenEditDialog() {
    if (!opp) return;
    setEditForm({
      title: opp.title,
      amount: opp.amount,
      expectedCloseDate: opp.expectedCloseDate,
      status: opp.status,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!opp) return;
    if (fromApi && routeId) {
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: editForm.title.trim(),
              amount: editForm.amount,
              expectedCloseDate: editForm.expectedCloseDate || null,
              status: editForm.status || undefined,
            }),
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
    updateOpportunity(opp.id, {
      title: editForm.title,
      amount: editForm.amount,
      expectedCloseDate: editForm.expectedCloseDate,
      status: (editForm.status || undefined) as OpportunityStatus | undefined,
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
      setStatusDialogOpen(false);
      return;
    }
    updateOpportunity(opp.id, { etapa: newEtapa as Etapa });
    toast.success('Etapa actualizada correctamente');
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    if (!opp) return;
    if (fromApi && routeId) {
      if (!isLikelyOpportunityCuid(newAssigneeId)) {
        toast.error('El asesor debe ser un usuario del servidor (id válido en PostgreSQL).');
        return;
      }
      void (async () => {
        try {
          const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
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
    updateOpportunity(opp.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
    toast.success('Asesor asignado correctamente');
    setAssignDialogOpen(false);
  }

  async function handleCreateNewContact(data: NewContactData) {
    if (!opp) return;
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
        }
        const today = new Date().toISOString().slice(0, 10);
        const createdContact = await api<{ id: string }>('/contacts', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name.trim(),
            phone: data.phone?.trim() || '',
            email: data.email?.trim() || '',
            source: data.source,
            cargo: data.cargo?.trim() || undefined,
            etapa: data.etapaCiclo,
            assignedTo: data.assignedTo?.trim() || opp.assignedTo || undefined,
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
        const updated = await api<ApiOpportunityDetail>(`/opportunities/${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: createdContact.id }),
        });
        setApiRecord(updated);
        setNewContactOpen(false);
        toast.success('Contacto creado y vinculado a la oportunidad');
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
      phone: data.phone || '',
      email: data.email || '',
      source: data.source,
      assignedTo: data.assignedTo || opp.assignedTo,
      estimatedValue: data.estimatedValue,
      clienteRecuperado: data.clienteRecuperado,
    });
    updateOpportunity(opp.id, { contactId: newContact.id, contactName: newContact.name });
    toast.success('Contacto creado y vinculado a la oportunidad');
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

  function handleAddCompany(data: NewCompanyData) {
    if (!linkedContact) return;
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

  async function handleRemoveOpportunity(oppItem: import('@/types').Opportunity) {
    if (fromApi && isLikelyOpportunityCuid(oppItem.id)) {
      try {
        await api(`/opportunities/${oppItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ contactId: null }),
        });
        toast.success('Oportunidad desvinculada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo desvincular');
      }
      return;
    }
    updateOpportunity(oppItem.id, { contactId: '', contactName: '' });
    toast.success('Oportunidad desvinculada');
  }

  function handleCreateNewOpportunity(data: NewOpportunityData) {
    if (!linkedContact) return;
    if (fromApi && isLikelyContactCuid(linkedContact.id)) {
      void (async () => {
        try {
          const body: Record<string, unknown> = {
            title: data.title.trim(),
            amount: data.amount,
            etapa: data.etapa,
            status: 'abierta',
            priority: data.priority,
            expectedCloseDate: data.expectedCloseDate,
            contactId: linkedContact.id,
          };
          if (data.assignedTo) body.assignedTo = data.assignedTo;
          await api('/opportunities', { method: 'POST', body: JSON.stringify(body) });
          toast.success(`Oportunidad "${data.title}" creada correctamente`);
          setNewOppOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo crear la oportunidad');
        }
      })();
      return;
    }
    addOpportunity({
      title: data.title,
      contactId: linkedContact.id,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      priority: data.priority,
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast.success(`Oportunidad "${data.title}" creada correctamente`);
    setNewOppOpen(false);
  }

  function handleLinkOpportunities() {
    if (linkOppIds.length === 0 || !linkedContact) return;
    if (fromApi) {
      void (async () => {
        try {
          for (const oppId of linkOppIds) {
            if (isLikelyOpportunityCuid(oppId)) {
              await api(`/opportunities/${oppId}`, {
                method: 'PATCH',
                body: JSON.stringify({ contactId: linkedContact.id }),
              });
            } else {
              updateOpportunity(oppId, { contactId: linkedContact.id, contactName: linkedContact.name });
            }
          }
          toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
          setLinkOppIds([]);
          setLinkOppSearch('');
          setAddExistingOppOpen(false);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
        }
      })();
      return;
    }
    for (const oppId of linkOppIds) {
      updateOpportunity(oppId, { contactId: linkedContact.id, contactName: linkedContact.name });
    }
    toast.success(linkOppIds.length === 1 ? 'Oportunidad vinculada' : `${linkOppIds.length} oportunidades vinculadas`);
    setLinkOppIds([]);
    setLinkOppSearch('');
    setAddExistingOppOpen(false);
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !linkedContact) return;
    const currentNames = new Set(linkedContact.companies?.map((c) => c.name) ?? []);
    let companies = [...(linkedContact.companies ?? [])];
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceContact = contacts.find((l) => l.companies?.some((c) => c.name === name));
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

  const availableOppsToLink = opportunities.filter(
    (o) => o.id !== routeId && o.contactId !== linkedContact?.id,
  );
  const opportunityLinkItems: LinkExistingItem[] = availableOppsToLink.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: `${formatCurrency(o.amount)} · ${etapaLabels[o.etapa]}`,
    status: o.status,
    icon: <DollarSign className="size-4" />,
  }));

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
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.phone,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  const currentCompanyNames = new Set((linkedContact?.companies ?? []).map((c) => c.name.trim().toLowerCase()));
  const availableCompanies = (() => {
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro }[] = [];
    for (const l of contacts) {
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span>Cargando oportunidad…</span>
      </div>
    );
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

  return (
    <>
    <DetailLayout
      backPath="/opportunities"
      title={opp.title}
      headerActions={
        <>
          <Badge variant="outline" className={`${statusColors[opp.status] ?? ''} border-0`}>
            {statusLabels[opp.status] ?? opp.status}
          </Badge>
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
          entityName={opp.title}
          contacts={linkedContact ? [linkedContact] : []}
          companies={linkedContact?.companies ?? []}
          opportunities={[opp]}
          contactId={opp?.contactId}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setOppActivities((prev) => [activity, ...prev])}
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
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="text-l font-semibold text-emerald-600">{formatCurrency(opp.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Target className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Probabilidad</p>
                  <p className="text-l font-semibold">{opp.probability}%</p>
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
                  <p className="text-sm text-muted-foreground">Fecha de cierre</p>
                  <p className="text-l font-semibold">{formatDate(opp.expectedCloseDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <RefreshCw className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Etapa</p>
                  <p className="text-l font-semibold">{etapaLabels[opp.etapa]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      sidebar={
        <>
          <EntityInfoCard
            title="Información de la Oportunidad"
            fields={[
              { icon: DollarSign, value: formatCurrency(opp.amount) },
              { icon: Target, value: `${opp.probability}% probabilidad` },
              { icon: CalendarDays, value: `Cierre: ${formatDate(opp.expectedCloseDate)}` },
              { icon: User, value: opp.assignedToName },
              { icon: CalendarDays, value: `Creada: ${formatDate(opp.createdAt)}` },
            ]}
          />

          <LinkedOpportunitiesCard
            opportunities={otherOpportunities}
            onCreate={() => setNewOppOpen(true)}
            onAddExisting={() => setAddExistingOppOpen(true)}
            onRemove={handleRemoveOpportunity}
          />

          <LinkedCompaniesCard
            companies={primaryCompany ? [primaryCompany] : (linkedContact?.companies ?? [])}
            onCreate={() => setNewCompanyDialogOpen(true)}
            onAddExisting={() => setAddExistingCompanyOpen(true)}
            onRemove={linkedContact ? handleRemoveCompany : undefined}
            etapa={primaryCompany ? opp?.etapa : linkedContact?.etapa}
          />

          <LinkedContactsCard
            contacts={linkedContact ? [linkedContact] : []}
            title="Contacto vinculado"
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
            onRemove={linkedContact ? handleRemoveContact : undefined}
          />
        </>
      }
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

        <TabsContent value="historial" className="mt-4">
          <TimelinePanel events={timelineEvents} />
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
    />

    <NewOpportunityDialog
      open={newOppOpen}
      onOpenChange={setNewOppOpen}
      entityName={linkedContact?.name ?? opp.title}
      onSave={handleCreateNewOpportunity}
    />

    {/* Vincular oportunidad existente */}
    <LinkExistingDialog
      open={addExistingOppOpen}
      onOpenChange={(open) => { setAddExistingOppOpen(open); if (!open) { setLinkOppIds([]); setLinkOppSearch(''); } }}
      title="Vincular Oportunidad Existente"
      searchPlaceholder="Buscar oportunidades..."
      contactName={linkedContact?.name ?? opp.title}
      items={opportunityLinkItems}
      selectedIds={linkOppIds}
      onSelectionChange={setLinkOppIds}
      onConfirm={handleLinkOpportunities}
      searchValue={linkOppSearch}
      onSearchChange={setLinkOppSearch}
      emptyMessage="No hay oportunidades disponibles para vincular."
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={!editForm.title.trim()}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ChangeEtapaDialog
      open={statusDialogOpen}
      onOpenChange={setStatusDialogOpen}
      entityName={opp.title}
      currentEtapa={opp.etapa}
      onEtapaChange={handleEtapaChange}
    />

    <AssignDialog
      open={assignDialogOpen}
      onOpenChange={setAssignDialogOpen}
      entityName={opp.title}
      currentAssigneeId={opp.assignedTo}
      onAssignChange={handleAssignChange}
    />
    </>
  );
}
