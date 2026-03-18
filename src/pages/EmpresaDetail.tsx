import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef } from 'react';
import {
  Building2, Users, DollarSign, Globe, Briefcase, CalendarDays,
  Edit, RefreshCw, UserPlus, Plus,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { companyRubroLabels, companyTipoLabels, etapaLabels, users, timelineEvents, activities } from '@/data/mock';
import { getPrimaryCompany } from '@/lib/utils';
import type { Etapa, CompanyRubro, CompanyTipo } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedOpportunitiesCard } from '@/components/shared/LinkedOpportunitiesCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';
import { NewOpportunityDialog } from '@/components/shared/NewOpportunityDialog';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contacts, opportunities } = useCRMStore();

  const companyName = id ? decodeURIComponent(id) : '';

  const companyContacts = useMemo(() => {
    if (!companyName) return [];
    return contacts.filter((l) =>
      l.companies?.some((c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase()),
    );
  }, [contacts, companyName]);

  const firstContact = companyContacts[0];
  const companyData = firstContact?.companies?.find(
    (c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase(),
  );
  const totalValue = companyContacts.reduce((sum: number, l) => sum + l.estimatedValue, 0);

  const companyOpportunities = useMemo(() => {
    const contactIds = new Set(companyContacts.map((l) => l.id));
    return opportunities.filter((o) => o.contactId && contactIds.has(o.contactId));
  }, [companyContacts, opportunities]);

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
        result.push({ name: comp.name, domain: comp.domain, rubro: comp.rubro, tipo: comp.tipo });
      }
    }
    return result;
  }, [companyContacts, companyName]);

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newOppOpen, setNewOppOpen] = useState(false);

  const [addExistingOppOpen, setAddExistingOppOpen] = useState(false);
  const [linkOppIds, setLinkOppIds] = useState<string[]>([]);
  const [linkOppSearch, setLinkOppSearch] = useState('');

  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);

  const [addExistingCompanyOpen, setAddExistingCompanyOpen] = useState(false);
  const [linkCompanyNames, setLinkCompanyNames] = useState<string[]>([]);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');

  const [newContactOpen, setNewContactOpen] = useState(false);

  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

  const [notes, setNotes] = useState([
    { id: 'n1', text: 'Se requiere actualizar los datos de facturación antes del próximo mes.', author: 'Ana Torres', date: '2026-03-02' },
    { id: 'n2', text: 'Reunión con gerencia general programada para revisar propuesta de servicios.', author: 'Carlos Mendoza', date: '2026-03-04' },
  ]);
  const [noteText, setNoteText] = useState('');

  const { addOpportunity, updateOpportunity, addContact, updateContact } = useCRMStore();

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
  const [editForm, setEditForm] = useState({ name: '', domain: '', rubro: '' as CompanyRubro | '', tipo: '' as CompanyTipo | '' });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  function handleOpenEditDialog() {
    setEditForm({
      name: companyData?.name ?? companyName,
      domain: companyData?.domain ?? '',
      rubro: companyData?.rubro ?? '',
      tipo: companyData?.tipo ?? '',
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    for (const contact of companyContacts) {
      const updatedCompanies = (contact.companies ?? []).map((c) => {
        if (c.name.trim().toLowerCase() === companyName.trim().toLowerCase()) {
          return { ...c, name: editForm.name, domain: editForm.domain || undefined, rubro: (editForm.rubro || undefined) as CompanyRubro | undefined, tipo: (editForm.tipo || undefined) as CompanyTipo | undefined };
        }
        return c;
      });
      updateContact(contact.id, { companies: updatedCompanies });
    }
    toast.success('Empresa actualizada correctamente');
    setEditDialogOpen(false);
    if (editForm.name !== companyName) {
      navigate(`/empresas/${encodeURIComponent(editForm.name)}`, { replace: true });
    }
  }

  function handleEtapaChange(newEtapa: string) {
    for (const contact of companyContacts) {
      updateContact(contact.id, { etapa: newEtapa as Etapa });
    }
    toast.success('Etapa actualizada correctamente');
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    const user = users.find((u) => u.id === newAssigneeId);
    for (const contact of companyContacts) {
      updateContact(contact.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
    }
    toast.success('Asesor asignado correctamente');
    setAssignDialogOpen(false);
  }

  // --- Handlers ---
  function handleCreateOpportunity(data: import('@/components/shared/NewOpportunityDialog').NewOpportunityData) {
    if (!firstContact) return;
    addOpportunity({
      title: data.title,
      contactId: firstContact.id,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString().slice(0, 10),
      description: data.description,
    });
    toast.success(`Oportunidad "${data.title}" creada`);
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

  function handleAddCompany(data: NewCompanyData) {
    if (!firstContact) return;
    const companies = [...(firstContact.companies ?? []), {
      name: data.nombreComercial,
      rubro: data.rubro || undefined,
      tipo: data.tipoEmpresa || undefined,
      domain: data.dominio || undefined,
      isPrimary: false,
    }];
    updateContact(firstContact.id, { companies });
    toast.success('Empresa agregada');
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !firstContact) return;
    const currentNames = new Set(firstContact.companies?.map((c) => c.name) ?? []);
    let companies = [...(firstContact.companies ?? [])];
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceContact = contacts.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceContact?.companies?.find((c) => c.name === name);
      companies.push({ name, rubro: sourceCompany?.rubro, tipo: sourceCompany?.tipo, isPrimary: false });
      currentNames.add(name);
    }
    if (companies.length > (firstContact.companies?.length ?? 0)) {
      updateContact(firstContact.id, { companies });
      toast.success('Empresa(s) vinculada(s)');
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  function handleCreateNewContact(data: NewContactData) {
    if (!firstContact) return;
    addContact({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: [{ name: companyName, rubro: companyData?.rubro, tipo: companyData?.tipo }],
      phone: data.phone || '',
      email: data.email || '',
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo || firstContact.assignedTo,
      estimatedValue: data.estimatedValue,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
    });
    toast.success('Contacto creado y vinculado a la empresa');
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

  // --- Link items ---
  const contactIds = new Set(companyContacts.map((l) => l.id));
  const availableOpps = opportunities.filter((o) => !o.contactId || !contactIds.has(o.contactId));
  const oppLinkItems: LinkExistingItem[] = availableOpps.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: `${formatCurrency(o.amount)} · ${etapaLabels[o.etapa]}`,
    status: o.status,
    icon: <DollarSign className="size-4" />,
  }));

  const currentCompanyNames = new Set([companyName.trim().toLowerCase(), ...linkedCompanies.map((c) => c.name.trim().toLowerCase())]);
  const availableCompanies = (() => {
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro; tipo?: CompanyTipo }[] = [];
    for (const l of contacts) {
      for (const c of l.companies ?? []) {
        const key = c.name.trim().toLowerCase();
        if (!currentCompanyNames.has(key) && !seen.has(key)) {
          seen.add(key);
          result.push({ name: c.name, rubro: c.rubro, tipo: c.tipo });
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

  const availableContacts = contacts.filter((l) => !contactIds.has(l.id));
  const contactLinkItems: LinkExistingItem[] = availableContacts.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.phone,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  if (!companyName || companyContacts.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/empresas')}>
          <Building2 className="size-4" /> Volver a Empresas
        </Button>
        <EmptyState
          icon={Building2}
          title="Empresa no encontrada"
          description="La empresa que buscas no existe o no tiene contactos asociados."
          actionLabel="Volver a Empresas"
          onAction={() => navigate('/empresas')}
        />
      </div>
    );
  }

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
          entityName={companyName}
          contacts={companyContacts}
          companies={linkedCompanies}
          opportunities={companyOpportunities}
          contactId={firstContact?.id}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setCompanyActivities((prev) => [activity, ...prev])}
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
                  <p className="text-l font-semibold">{formatCurrency(totalValue)}</p>
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
                  <p className="text-l font-semibold">{firstContact ? etapaLabels[firstContact.etapa] : '—'}</p>
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
                  <p className="text-l font-semibold">{firstContact ? formatDate(firstContact.nextFollowUp) : '—'}</p>
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
                  <p className="text-l font-semibold truncate">{firstContact?.assignedToName ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      sidebar={
        <>
          <EntityInfoCard
            title="Información de Empresa"
            fields={[
              { icon: Building2, value: companyData?.name ?? companyName },
              ...(companyData?.domain ? [{ icon: Globe as typeof Building2, value: companyData.domain, href: companyData.domain.startsWith('http') ? companyData.domain : `https://${companyData.domain}` }] : []),
              ...(companyData?.rubro ? [{ icon: Briefcase as typeof Building2, value: companyRubroLabels[companyData.rubro] }] : []),
              ...(companyData?.tipo ? [{ label: 'Tipo:', value: companyData.tipo }] : []),
            ]}
          />

          <LinkedOpportunitiesCard
            opportunities={companyOpportunities}
            onCreate={() => setNewOppOpen(true)}
            onAddExisting={() => setAddExistingOppOpen(true)}
          />

          <LinkedCompaniesCard
            companies={linkedCompanies}
            onCreate={() => setNewCompanyDialogOpen(true)}
            onAddExisting={() => setAddExistingCompanyOpen(true)}
          />

          <LinkedContactsCard
            contacts={companyContacts}
            title="Contactos"
            variant="compact"
            maxItems={5}
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
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
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          <TimelinePanel events={timelineEvents} />
        </TabsContent>

        <TabsContent value="actividades" className="mt-4">
          <ActivityPanel activities={companyActivities} />
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
            contacts={companyContacts}
            companies={(companyData ? [{ name: companyData.name }] : []).concat(linkedCompanies.map((c) => ({ name: c.name })))}
            opportunities={companyOpportunities}
            defaultAssigneeId={firstContact?.assignedTo}
            onActivityCreated={(activity) => setCompanyActivities((prev) => [activity as any, ...prev])}
            contactId={firstContact?.id}
          />
        </TabsContent>
      </Tabs>
    </DetailLayout>

    <NewOpportunityDialog
      open={newOppOpen}
      onOpenChange={setNewOppOpen}
      entityName={companyName}
      onSave={handleCreateOpportunity}
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

    <NewCompanyWizard
      open={newCompanyDialogOpen}
      onOpenChange={setNewCompanyDialogOpen}
      onSubmit={handleAddCompany}
      title="Agregar empresa"
      description={`Vincula una nueva empresa a los contactos de ${companyName}.`}
    />

    {/* Vincular empresa existente */}
    <LinkExistingDialog
      open={addExistingCompanyOpen}
      onOpenChange={(open) => { setAddExistingCompanyOpen(open); if (!open) { setLinkCompanyNames([]); setLinkCompanySearch(''); } }}
      title="Vincular Empresa Existente"
      searchPlaceholder="Buscar empresas..."
      contactName={companyName}
      items={companyLinkItems}
      selectedIds={linkCompanyNames}
      onSelectionChange={setLinkCompanyNames}
      onConfirm={handleLinkCompanies}
      searchValue={linkCompanySearch}
      onSearchChange={setLinkCompanySearch}
      emptyMessage="No hay empresas disponibles para vincular."
    />

    {/* Crear nuevo contacto */}
    <NewContactWizard
      open={newContactOpen}
      onOpenChange={setNewContactOpen}
      onSubmit={handleCreateNewContact}
      title="Crear nuevo contacto"
      description={`Crea un nuevo contacto vinculado a ${companyName}.`}
      submitLabel="Crear y vincular"
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={!editForm.name.trim()}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ChangeEtapaDialog
      open={statusDialogOpen}
      onOpenChange={setStatusDialogOpen}
      entityName={companyName}
      currentEtapa={firstContact?.etapa ?? ''}
      onEtapaChange={handleEtapaChange}
    />

    <AssignDialog
      open={assignDialogOpen}
      onOpenChange={setAssignDialogOpen}
      entityName={companyName}
      currentAssigneeId={firstContact?.assignedTo ?? ''}
      onAssignChange={handleAssignChange}
    />
    </>
  );
}
