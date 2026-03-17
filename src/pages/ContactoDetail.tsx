import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, RefreshCw, UserPlus,
  Phone, Mail, Users,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  Plus,
} from 'lucide-react';
import type { Lead, Etapa, CompanyRubro, CompanyTipo, LeadSource, LeadPriority } from '@/types';
import {
  users, leadSourceLabels, etapaLabels, priorityLabels,
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



function ContactoSidebar({ lead, leadOpportunities, onOpenConvertDialog, onAddExistingOpportunity, onAddCompany, onAddExistingCompany, onNewContact, onAddLinkContact }: {
  lead: Lead;
  leadOpportunities: import('@/types').Opportunity[];
  onOpenConvertDialog: () => void;
  onAddExistingOpportunity: () => void;
  onAddCompany: () => void;
  onAddExistingCompany: () => void;
  onNewContact: () => void;
  onAddLinkContact: () => void;
}) {
  const { leads } = useCRMStore();

  const linkedContacts = (lead.linkedContactIds ?? [])
    .map((id) => leads.find((l) => l.id === id))
    .filter((l): l is Lead => !!l);

  return (
    <>
      <EntityInfoCard
        title="Información de Contacto"
        fields={[
          { icon: Phone, value: lead.phone, href: `tel:${lead.phone}` },
          { icon: Mail, value: lead.email, href: `mailto:${lead.email}` },
          { icon: Building2, value: getPrimaryCompany(lead)?.name ?? '—' },
          { icon: Globe, value: leadSourceLabels[lead.source] },
          { icon: CalendarDays, value: `Fecha de creación: ${formatDate(lead.createdAt)}` },
          ...(lead.departamento ? [{ icon: MapPin as typeof Phone, value: lead.departamento }] : []),
          ...(lead.provincia ? [{ label: 'Provincia:', value: lead.provincia, indent: true }] : []),
          ...(lead.distrito ? [{ label: 'Distrito:', value: lead.distrito, indent: true }] : []),
          ...(lead.direccion ? [{ label: 'Dirección:', value: lead.direccion, indent: true }] : []),
        ]}
      />

      <LinkedOpportunitiesCard
        opportunities={leadOpportunities}
        onCreate={onOpenConvertDialog}
        onAddExisting={onAddExistingOpportunity}
      />

      <LinkedCompaniesCard
        companies={lead.companies ?? []}
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
  const { leads, opportunities, getOpportunitiesByLeadId, addOpportunity, updateOpportunity, updateLead, addLead } = useCRMStore();

  const lead = leads.find((l) => l.id === id);
  const initialActivities = activities.filter((a) => a.leadId === id);
  const leadOpportunities = id ? getOpportunitiesByLeadId(id) : [];

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [leadActivities, setLeadActivities] = useState(initialActivities);
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
    source: '' as LeadSource,
    priority: '' as LeadPriority,
    estimatedValue: 0,
    nextAction: '',
    nextFollowUp: '',
  });

  if (!lead) {
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
    if (!lead) return;
    setEditForm({
      name: lead.name,
      cargo: lead.cargo ?? '',
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      priority: lead.priority,
      estimatedValue: lead.estimatedValue,
      nextAction: lead.nextAction,
      nextFollowUp: lead.nextFollowUp,
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!lead) return;
    updateLead(lead.id, {
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
    if (!lead) return;
    addOpportunity({
      title: data.title,
      leadId: lead.id,
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
    if (lead) {
      updateLead(lead.id, { etapa: newEtapa as Lead['etapa'] });
      toast.success('Etapa actualizada correctamente');
    }
    setStatusDialogOpen(false);
  }

  function handleAssignChange(newAssigneeId: string) {
    if (lead) {
      const user = users.find((u) => u.id === newAssigneeId);
      updateLead(lead.id, { assignedTo: newAssigneeId, assignedToName: user?.name ?? 'Sin asignar' });
      toast.success('Asesor asignado correctamente');
    }
    setAssignDialogOpen(false);
  }

  function handleAddCompany(data: NewCompanyData) {
    if (!lead) return;
    const rubro = data.rubro || undefined;
    const tipo = data.tipoEmpresa || undefined;
    const companies = [...(lead.companies ?? []), {
      name: data.nombreComercial,
      rubro,
      tipo,
      domain: data.dominio || undefined,
      isPrimary: lead.companies?.length === 0,
    }];
    updateLead(lead.id, { companies });
    toast.success('Empresa agregada');
  }

  function handleLinkContacts() {
    if (linkContactIds.length === 0 || !lead) return;
    const ids = lead.linkedContactIds ?? [];
    const toAdd = linkContactIds.filter((id) => id !== lead.id && !ids.includes(id));
    if (toAdd.length === 0) return;
    updateLead(lead.id, { linkedContactIds: [...ids, ...toAdd] });
    toast.success(toAdd.length === 1 ? 'Contacto vinculado' : `${toAdd.length} contactos vinculados`);
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddLinkContactOpen(false);
  }

  function handleLinkOpportunities() {
    if (linkOpportunityIds.length === 0 || !lead) return;
    for (const oppId of linkOpportunityIds) {
      updateOpportunity(oppId, { leadId: lead.id, leadName: lead.name });
    }
    toast.success(linkOpportunityIds.length === 1 ? 'Oportunidad vinculada' : `${linkOpportunityIds.length} oportunidades vinculadas`);
    setLinkOpportunityIds([]);
    setLinkOpportunitySearch('');
    setAddExistingOpportunityOpen(false);
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !lead) return;
    const currentNames = new Set(lead.companies?.map((c) => c.name) ?? []);
    let companies = [...(lead.companies ?? [])];
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceLead = leads.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceLead?.companies?.find((c) => c.name === name);
      companies.push({
        name,
        rubro: sourceCompany?.rubro,
        tipo: sourceCompany?.tipo,
        isPrimary: companies.length === 0,
      });
      currentNames.add(name);
    }
    if (companies.length > (lead.companies?.length ?? 0)) {
      updateLead(lead.id, { companies });
      toast.success(companies.length - (lead.companies?.length ?? 0) === 1 ? 'Empresa vinculada' : `${companies.length - (lead.companies?.length ?? 0)} empresas vinculadas`);
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  function handleCreateNewContact(data: NewContactData) {
    if (!lead) return;
    const newLead = addLead({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: [{ name: data.company }],
      phone: data.phone || lead.phone,
      email: data.email || lead.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo || lead.assignedTo,
      estimatedValue: data.estimatedValue,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
    });
    const ids = lead.linkedContactIds ?? [];
    updateLead(lead.id, { linkedContactIds: [...ids, newLead.id] });
    toast.success('Contacto creado y vinculado');
    setNewContactOpen(false);
  }

  const availableContactsToLink = leads.filter(
    (l) => l.id !== lead?.id && !(lead?.linkedContactIds ?? []).includes(l.id),
  );

  const availableOpportunitiesToLink = id
    ? opportunities.filter((o) => o.leadId !== id)
    : [];

  const availableCompaniesToLink = (() => {
    if (!lead?.companies) return [];
    const currentNames = new Set(lead.companies.map((c) => c.name));
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro; tipo?: CompanyTipo; contactName?: string; contactPhone?: string }[] = [];
    for (const l of leads) {
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
      title={lead.name}
      subtitle={lead.cargo}
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
          entityName={lead.name}
          contacts={leads.filter((l) => l.id !== lead.id)}
          companies={lead.companies ?? []}
          opportunities={leadOpportunities}
          leadId={id}
          onTaskCreated={(task) => tasksTabRef.current?.addTask(task as any)}
          onActivityCreated={(activity) => setLeadActivities((prev) => [activity, ...prev])}
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
                    <p className="text-l font-semibold">{formatCurrency(lead.estimatedValue)}</p>
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
                    <p className="text-l font-semibold">{etapaLabels[lead.etapa]}</p>
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
                    <p className="text-l font-semibold">{formatDate(lead.nextFollowUp)}</p>
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
                    <p className="text-l font-semibold truncate">{lead.assignedToName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
      }
      sidebar={<ContactoSidebar lead={lead} leadOpportunities={leadOpportunities} onOpenConvertDialog={() => setConvertDialogOpen(true)} onAddExistingOpportunity={() => setAddExistingOpportunityOpen(true)} onAddCompany={() => setAddCompanyOpen(true)} onAddExistingCompany={() => setAddExistingCompanyOpen(true)} onNewContact={() => setNewContactOpen(true)} onAddLinkContact={() => setAddLinkContactOpen(true)} />}
    >
        <Tabs defaultValue="historial">
          <TabsList variant="line" className="w-full justify-start flex-wrap">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="actividades">Actividades</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
          </TabsList>

          <TabsContent value="actividades" className="mt-4">
            <ActivityPanel activities={leadActivities} onRegisterActivity={() => toast.info('Usa las acciones rápidas para registrar una actividad')} />
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
              contacts={leads.filter((l) => l.id !== lead?.id)}
              companies={lead?.companies ?? []}
              opportunities={leadOpportunities}
              defaultAssigneeId={lead?.assignedTo}
              onActivityCreated={(activity) => setLeadActivities((prev) => [activity as any, ...prev])}
              leadId={id}
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
                <Select value={editForm.source} onValueChange={(v) => setEditForm((f) => ({ ...f, source: v as LeadSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(leadSourceLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v as LeadPriority }))}>
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
        description={`Vincula una nueva empresa a ${lead.name}.`}
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
        leadName={lead.name}
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
        entityName={lead.name}
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
        leadName={lead.name}
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
        description={`Crea un nuevo contacto y vincúlalo a ${lead.name}.`}
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
        leadName={lead.name}
        items={contactLinkItems}
        selectedIds={linkContactIds}
        onSelectionChange={setLinkContactIds}
        onConfirm={handleLinkContacts}
        searchValue={linkContactSearch}
        onSearchChange={setLinkContactSearch}
        emptyMessage="No hay contactos disponibles para vincular."
      />

      {/* Change Etapa Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Etapa</DialogTitle>
            <DialogDescription>Selecciona la nueva etapa para {lead.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nueva etapa</Label>
            <Select value={lead.etapa} onValueChange={handleEtapaChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(etapaLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Asesor</DialogTitle>
            <DialogDescription>Selecciona el asesor para {lead.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Asesor</Label>
            <Select value={lead.assignedTo} onValueChange={handleAssignChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.filter((u) => u.status === 'activo').map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
