import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef } from 'react';
import {
  Briefcase, DollarSign, Target, CalendarDays, User, Building2,
  Users, Edit, RefreshCw, UserPlus, Plus,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { etapaLabels, companyRubroLabels, users, timelineEvents, activities } from '@/data/mock';
import { getPrimaryCompany } from '@/lib/utils';
import type { CompanyRubro } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { ActivityPanel } from '@/components/shared/ActivityPanel';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import { LinkedContactsCard } from '@/components/shared/LinkedContactsCard';
import { LinkedCompaniesCard } from '@/components/shared/LinkedCompaniesCard';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';
import { NewContactWizard } from '@/components/shared/NewContactWizard';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { TasksTab, type TasksTabHandle } from '@/components/shared/TasksTab';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const { opportunities, leads } = useCRMStore();

  const opp = opportunities.find((o) => o.id === id);

  const linkedLead = opp?.leadId ? leads.find((l) => l.id === opp.leadId) : null;
  const primaryCompany = linkedLead ? getPrimaryCompany(linkedLead) : null;
  const assignedUser = opp ? users.find((u) => u.id === opp.assignedTo) : null;

  const initialOppActivities = useMemo(() => {
    if (!opp?.leadId) return [];
    return activities.filter((a) => a.leadId === opp.leadId);
  }, [opp]);
  const [oppActivities, setOppActivities] = useState(initialOppActivities);

  const { updateLead, addLead, updateOpportunity } = useCRMStore();

  const tasksTabRef = useRef<TasksTabHandle>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [addExistingContactOpen, setAddExistingContactOpen] = useState(false);
  const [linkContactIds, setLinkContactIds] = useState<string[]>([]);
  const [linkContactSearch, setLinkContactSearch] = useState('');

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

  function handleCreateNewContact(data: NewContactData) {
    if (!opp) return;
    const newLead = addLead({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: data.company ? [{ name: data.company }] : [],
      phone: data.phone || '',
      email: data.email || '',
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo || opp.assignedTo,
      estimatedValue: data.estimatedValue,
    });
    updateOpportunity(opp.id, { leadId: newLead.id, leadName: newLead.name });
    toast.success('Contacto creado y vinculado a la oportunidad');
    setNewContactOpen(false);
  }

  function handleLinkContacts() {
    if (linkContactIds.length === 0 || !opp) return;
    const firstContactId = linkContactIds[0];
    updateOpportunity(opp.id, { leadId: firstContactId, leadName: leads.find((l) => l.id === firstContactId)?.name });
    toast.success('Contacto vinculado a la oportunidad');
    setLinkContactIds([]);
    setLinkContactSearch('');
    setAddExistingContactOpen(false);
  }

  function handleAddCompany(data: NewCompanyData) {
    if (!linkedLead) return;
    const companies = [...(linkedLead.companies ?? []), {
      name: data.nombreComercial,
      rubro: data.rubro || undefined,
      tipo: data.tipoEmpresa || undefined,
      domain: data.dominio || undefined,
      isPrimary: false,
    }];
    updateLead(linkedLead.id, { companies });
    toast.success('Empresa agregada');
  }

  function handleLinkCompanies() {
    if (linkCompanyNames.length === 0 || !linkedLead) return;
    const currentNames = new Set(linkedLead.companies?.map((c) => c.name) ?? []);
    let companies = [...(linkedLead.companies ?? [])];
    for (const name of linkCompanyNames) {
      if (currentNames.has(name)) continue;
      const sourceLead = leads.find((l) => l.companies?.some((c) => c.name === name));
      const sourceCompany = sourceLead?.companies?.find((c) => c.name === name);
      companies.push({ name, rubro: sourceCompany?.rubro, tipo: sourceCompany?.tipo, isPrimary: false });
      currentNames.add(name);
    }
    if (companies.length > (linkedLead.companies?.length ?? 0)) {
      updateLead(linkedLead.id, { companies });
      toast.success('Empresa(s) vinculada(s)');
    }
    setLinkCompanyNames([]);
    setLinkCompanySearch('');
    setAddExistingCompanyOpen(false);
  }

  const availableContacts = linkedLead ? leads.filter((l) => l.id !== linkedLead.id) : leads;
  const contactLinkItems: LinkExistingItem[] = availableContacts.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: [c.cargo, getPrimaryCompany(c)?.name].filter(Boolean).join(' · ') || c.phone,
    status: 'Activo',
    icon: <Users className="size-4" />,
  }));

  const currentCompanyNames = new Set((linkedLead?.companies ?? []).map((c) => c.name.trim().toLowerCase()));
  const availableCompanies = (() => {
    const seen = new Set<string>();
    const result: { name: string; rubro?: CompanyRubro }[] = [];
    for (const l of leads) {
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
      subtitle={opp.description}
      headerActions={
        <>
          <Badge variant="outline" className={`${statusColors[opp.status] ?? ''} border-0`}>
            {statusLabels[opp.status] ?? opp.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => toast.info('Editar oportunidad')}>
            <Edit /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info('Cambiar etapa')}>
            <RefreshCw /> Cambiar Etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info('Asignar')}>
            <UserPlus /> Asignar
          </Button>
        </>
      }
      quickActions={
        <QuickActionsWithDialogs
          entityName={opp.title}
          contacts={linkedLead ? [linkedLead] : []}
          companies={linkedLead?.companies ?? []}
          opportunities={[opp]}
          leadId={opp?.leadId}
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

          <LinkedContactsCard
            contacts={linkedLead ? [linkedLead] : []}
            title="Contacto vinculado"
            onCreate={() => setNewContactOpen(true)}
            onAddExisting={() => setAddExistingContactOpen(true)}
          />

          <LinkedCompaniesCard
            companies={primaryCompany ? [primaryCompany] : (linkedLead?.companies ?? [])}
            onCreate={() => setNewCompanyDialogOpen(true)}
            onAddExisting={() => setAddExistingCompanyOpen(true)}
          />

          {assignedUser && (
            <Card className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <User className="size-4.5 text-muted-foreground" />
                  Responsable
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border bg-card p-3.5">
                  <p className="text-[14px] font-semibold">{assignedUser.name}</p>
                  <p className="text-[12px] text-muted-foreground">{assignedUser.email}</p>
                  <p className="text-[12px] text-muted-foreground">{assignedUser.phone}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      }
    >
      <Tabs defaultValue="historial">
        <TabsList variant="line" className="w-full justify-start flex-wrap">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          <TimelinePanel events={timelineEvents} />
        </TabsContent>

        <TabsContent value="actividades" className="mt-4">
          <ActivityPanel activities={oppActivities} />
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
            contacts={linkedLead ? [linkedLead] : []}
            companies={primaryCompany ? [{ name: primaryCompany.name }] : []}
            opportunities={opp ? [opp] : []}
            defaultAssigneeId={opp?.assignedTo}
            onActivityCreated={(activity) => setOppActivities((prev) => [activity as any, ...prev])}
            leadId={opp?.leadId}
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

    {/* Vincular contacto existente */}
    <LinkExistingDialog
      open={addExistingContactOpen}
      onOpenChange={(open) => { setAddExistingContactOpen(open); if (!open) { setLinkContactIds([]); setLinkContactSearch(''); } }}
      title="Vincular Contacto Existente"
      searchPlaceholder="Buscar contactos..."
      leadName={opp.title}
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
      leadName={opp.title}
      items={companyLinkItems}
      selectedIds={linkCompanyNames}
      onSelectionChange={setLinkCompanyNames}
      onConfirm={handleLinkCompanies}
      searchValue={linkCompanySearch}
      onSearchChange={setLinkCompanySearch}
      emptyMessage="No hay empresas disponibles para vincular."
    />
    </>
  );
}
