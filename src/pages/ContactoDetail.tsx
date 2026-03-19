import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, RefreshCw, UserPlus,
  Phone, Mail, Users,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  Plus,
} from 'lucide-react';
import type { Contact, Etapa, CompanyRubro, CompanyTipo, ContactSource, ContactPriority } from '@/types';
import {
  users, contactSourceLabels, etapaLabels, priorityLabels,
  companyRubroLabels,
  timelineEvents, activities,
} from '@/data/mock';
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
import { NewOpportunityDialog, type NewOpportunityData } from '@/components/shared/NewOpportunityDialog';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const initialNotes = [
  { id: 'n1', text: 'El cliente prefiere vehículos SUV para su equipo directivo. Requiere servicio 24/7.', author: 'Ana Torres', date: '2026-03-02' },
  { id: 'n2', text: 'Llamada de seguimiento realizada. El cliente está evaluando propuestas de la competencia.', author: 'Carlos Mendoza', date: '2026-03-04' },
  { id: 'n3', text: 'Se acordó enviar tarifas diferenciadas según volumen de uso mensual.', author: 'María García', date: '2026-03-05' },
];



function ContactoSidebar({ contact, contactOpportunities, onOpenConvertDialog, onAddExistingOpportunity, onAddCompany, onAddExistingCompany, onNewContact, onAddLinkContact }: {
  contact: Contact;
  contactOpportunities: import('@/types').Opportunity[];
  onOpenConvertDialog: () => void;
  onAddExistingOpportunity: () => void;
  onAddCompany: () => void;
  onAddExistingCompany: () => void;
  onNewContact: () => void;
  onAddLinkContact: () => void;
}) {
  const { contacts } = useCRMStore();

  const linkedContacts = (contact.linkedContactIds ?? [])
    .map((id) => contacts.find((l) => l.id === id))
    .filter((l): l is Contact => !!l);

  return (
    <>
      <EntityInfoCard
        title="Información de Contacto"
        fields={[
          { icon: Phone, value: contact.phone, href: `tel:${contact.phone}` },
          { icon: Mail, value: contact.email, href: `mailto:${contact.email}` },
          { icon: Building2, value: getPrimaryCompany(contact)?.name ?? '—' },
          { icon: Globe, value: contactSourceLabels[contact.source] },
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
      />

      <LinkedCompaniesCard
        companies={contact.companies ?? []}
        onCreate={onAddCompany}
        onAddExisting={onAddExistingCompany}
      />

      <LinkedContactsCard
        contacts={linkedContacts}
        onCreate={onNewContact}
        onAddExisting={onAddLinkContact}
      />
    </>
  );
}

export default function ContactoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contacts, opportunities, getOpportunitiesByContactId, addOpportunity, updateOpportunity, updateContact, addContact } = useCRMStore();

  const contact = contacts.find((l) => l.id === id);
  const initialActivities = activities.filter((a) => a.contactId === id);
  const contactOpportunities = id ? getOpportunitiesByContactId(id) : [];

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
    phone: '',
    email: '',
    source: '' as ContactSource,
    priority: '' as ContactPriority,
    estimatedValue: 0,
    nextAction: '',
    nextFollowUp: '',
  });

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
      phone: contact.phone,
      email: contact.email,
      source: contact.source,
      priority: contact.priority,
      estimatedValue: contact.estimatedValue,
      nextAction: contact.nextAction,
      nextFollowUp: contact.nextFollowUp,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!contact) return;
    updateContact(contact.id, {
      name: editForm.name,
      cargo: editForm.cargo || undefined,
      phone: editForm.phone,
      email: editForm.email,
      source: editForm.source,
      priority: editForm.priority,
      estimatedValue: editForm.estimatedValue,
      nextAction: editForm.nextAction,
      nextFollowUp: editForm.nextFollowUp,
    });
    toast.success('Contacto actualizado correctamente');
    setEditDialogOpen(false);
  }


  function handleConvertToOpportunity(data: NewOpportunityData) {
    if (!contact) return;
    addOpportunity({
      title: data.title,
      contactId: contact.id,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString().slice(0, 10),
      description: data.description,
    });
    toast.success(`Oportunidad "${data.title}" creada correctamente`);
  }

  function handleEtapaChange(newEtapa: string) {
    if (contact) {
      updateContact(contact.id, { etapa: newEtapa as Contact['etapa'] });
      toast.success('Etapa actualizada correctamente');
    }
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    if (contact) {
      const user = users.find((u) => u.id === newAssigneeId);
      updateContact(contact.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
      toast.success('Asesor asignado correctamente');
    }
    setAssignDialogOpen(false);
  }

  function handleAddCompany(data: NewCompanyData) {
    if (!contact) return;
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

  function handleLinkContacts() {
    if (linkContactIds.length === 0 || !contact) return;
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
    for (const oppId of linkOpportunityIds) {
      updateOpportunity(oppId, { contactId: contact.id, contactName: contact.name });
    }
    toast.success(linkOpportunityIds.length === 1 ? 'Oportunidad vinculada' : `${linkOpportunityIds.length} oportunidades vinculadas`);
    setLinkOpportunityIds([]);
    setLinkOpportunitySearch('');
    setAddExistingOpportunityOpen(false);
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !contact) return;
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

  function handleCreateNewContact(data: NewContactData) {
    if (!contact) return;
    const newContact = addContact({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: [{ name: data.company }],
      phone: data.phone || contact.phone,
      email: data.email || contact.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo || contact.assignedTo,
      estimatedValue: data.estimatedValue,
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

  const availableContactsToLink = contacts.filter(
    (l) => l.id !== contact?.id && !(contact?.linkedContactIds ?? []).includes(l.id),
  );

  const availableOpportunitiesToLink = id
    ? opportunities.filter((o) => o.contactId !== id)
    : [];

  const availableCompaniesToLink = (() => {
    if (!contact?.companies) return [];
    const currentNames = new Set(contact.companies.map((c) => c.name));
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro; tipo?: CompanyTipo; contactName?: string; contactPhone?: string }[] = [];
    for (const l of contacts) {
      for (const c of l.companies ?? []) {
        if (!currentNames.has(c.name) && !seen.has(c.name)) {
          seen.add(c.name);
          result.push({
            name: c.name,
            rubro: c.rubro,
            tipo: c.tipo,
            contactName: l.name,
            contactPhone: l.phone,
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
    const subtitle = c.contactName && c.contactPhone
      ? `${c.contactName} · ${c.contactPhone}`
      : c.contactName ?? (c.rubro ? companyRubroLabels[c.rubro] : undefined);
    return {
      id: c.name,
      title: c.name,
      subtitle,
      status: 'Activo',
      icon: <Building2 className="size-4" />,
    };
  });

  const contactLinkItems: LinkExistingItem[] = availableContactsToLink.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.phone,
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
          contacts={contacts.filter((l) => l.id !== contact.id)}
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
      sidebar={<ContactoSidebar contact={contact} contactOpportunities={contactOpportunities} onOpenConvertDialog={() => setConvertDialogOpen(true)} onAddExistingOpportunity={() => setAddExistingOpportunityOpen(true)} onAddCompany={() => setAddCompanyOpen(true)} onAddExistingCompany={() => setAddExistingCompanyOpen(true)} onNewContact={() => setNewContactOpen(true)} onAddLinkContact={() => setAddLinkContactOpen(true)} />}
    >
        <Tabs defaultValue="historial">
          <TabsList variant="line" className="w-full justify-start flex-wrap">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="actividades">Actividades</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
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

          {/* Tareas Tab */}
          <TabsContent value="tareas" className="mt-4">
            <TasksTab
              ref={tasksTabRef}
              contacts={contacts.filter((l) => l.id !== contact?.id)}
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
                <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select value={editForm.source} onValueChange={(v) => setEditForm((f) => ({ ...f, source: v as ContactSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(contactSourceLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v as ContactPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      <NewOpportunityDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        entityName={contact.name}
        onSave={handleConvertToOpportunity}
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
