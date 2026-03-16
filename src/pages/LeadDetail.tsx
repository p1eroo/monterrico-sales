import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, RefreshCw, UserPlus,
  Phone, Mail, Users, StickyNote, CheckSquare, Paperclip,
  Building2, Globe, DollarSign, CalendarDays, MapPin,
  Plus, MessageSquare, Calendar, ClipboardList, Star, Briefcase,
  User,
} from 'lucide-react';
import type { Lead, TimelineEvent, Etapa, CompanyRubro, CompanyTipo, ActivityType, LeadSource, LeadPriority } from '@/types';
import {
  users, leadSourceLabels, etapaLabels, priorityLabels,
  companyRubroLabels, companyTipoLabels,
  timelineEvents, activities,
} from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany } from '@/lib/utils';

import { EmptyState } from '@/components/shared/EmptyState';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const rubroColors: Record<string, string> = {
  mineria: 'bg-amber-100 text-amber-700',
  hoteleria: 'bg-purple-100 text-purple-700',
  banca: 'bg-blue-100 text-blue-700',
  construccion: 'bg-orange-100 text-orange-700',
  salud: 'bg-rose-100 text-rose-700',
  retail: 'bg-pink-100 text-pink-700',
  telecomunicaciones: 'bg-indigo-100 text-indigo-700',
  educacion: 'bg-cyan-100 text-cyan-700',
  energia: 'bg-yellow-100 text-yellow-700',
  consultoria: 'bg-teal-100 text-teal-700',
  diplomatico: 'bg-violet-100 text-violet-700',
  aviacion: 'bg-sky-100 text-sky-700',
  consumo_masivo: 'bg-lime-100 text-lime-700',
  otros: 'bg-gray-100 text-gray-700',
};

const tipoColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-slate-100 text-slate-600',
};

const etapaColors: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700',
  contacto: 'bg-blue-100 text-blue-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_efectiva: 'bg-cyan-100 text-cyan-700',
  propuesta_economica: 'bg-purple-100 text-purple-700',
  negociacion: 'bg-amber-100 text-amber-700',
  licitacion: 'bg-amber-100 text-amber-700',
  licitacion_etapa_final: 'bg-amber-100 text-amber-700',
  cierre_ganado: 'bg-emerald-100 text-emerald-700',
  firma_contrato: 'bg-emerald-100 text-emerald-700',
  activo: 'bg-emerald-100 text-emerald-700',
  cierre_perdido: 'bg-red-100 text-red-700',
  inactivo: 'bg-gray-100 text-gray-700',
};

const timelineIconMap: Record<TimelineEvent['type'], typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: Users,
  nota: StickyNote,
  cambio_estado: RefreshCw,
  tarea: CheckSquare,
  archivo: Paperclip,
};

const timelineColorMap: Record<TimelineEvent['type'], string> = {
  llamada: 'bg-blue-100 text-blue-600',
  correo: 'bg-purple-100 text-purple-600',
  reunion: 'bg-emerald-100 text-emerald-600',
  nota: 'bg-amber-100 text-amber-600',
  cambio_estado: 'bg-orange-100 text-orange-600',
  tarea: 'bg-cyan-100 text-cyan-600',
  archivo: 'bg-gray-100 text-gray-600',
};

const activityTypeIconMap: Record<ActivityType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  seguimiento: RefreshCw,
  whatsapp: MessageSquare,
};

const activityStatusLabelMap: Record<string, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  reprogramada: 'Reprogramada',
};

const mockNotes = [
  { id: 'n1', text: 'El cliente prefiere vehículos SUV para su equipo directivo. Requiere servicio 24/7.', author: 'Ana Torres', date: '2026-03-02' },
  { id: 'n2', text: 'Llamada de seguimiento realizada. El cliente está evaluando propuestas de la competencia.', author: 'Carlos Mendoza', date: '2026-03-04' },
  { id: 'n3', text: 'Se acordó enviar tarifas diferenciadas según volumen de uso mensual.', author: 'María García', date: '2026-03-05' },
];

type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = 'llamada' | 'reunion' | 'correo';

interface MockTask {
  id: string;
  title: string;
  status: TaskStatus;
  type?: TaskType;
  priority: TaskPriority;
  company?: string;
  startDate?: string;
  dueDate: string;
  startTime?: string;
  assignee: string;
}

const taskStatusLabels: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

const taskStatusColors: Record<TaskStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  completada: 'bg-emerald-100 text-emerald-700',
};

const taskPriorityColors: Record<TaskPriority, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-600',
};

const taskTypeLabels: Record<TaskType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
};

const initialMockTasks: MockTask[] = [
  { id: 't1', title: 'Enviar propuesta comercial actualizada', status: 'completada', type: 'correo', priority: 'alta', company: 'Minera Los Andes', startDate: '2026-03-03', dueDate: '2026-03-05', startTime: '09:00', assignee: 'Carlos Mendoza' },
  { id: 't2', title: 'Coordinar visita a la flota ejecutiva', status: 'pendiente', type: 'reunion', priority: 'media', company: 'Hotel Libertador', startDate: '2026-03-06', dueDate: '2026-03-08', startTime: '14:00', assignee: 'José Ramírez' },
  { id: 't3', title: 'Preparar contrato borrador', status: 'pendiente', type: 'correo', priority: 'media', startDate: '2026-03-08', dueDate: '2026-03-10', startTime: '10:00', assignee: 'María García' },
  { id: 't4', title: 'Confirmar disponibilidad de vehículos', status: 'en_progreso', type: 'llamada', priority: 'baja', startDate: '2026-03-05', dueDate: '2026-03-07', startTime: '11:30', assignee: 'Ana Torres' },
];

const etapasParaOportunidad: Etapa[] = ['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'];

const newOpportunitySchema = z.object({
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: z.enum(['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'] as const),
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  description: z.string().optional(),
});

type NewOpportunityForm = z.infer<typeof newOpportunitySchema>;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, opportunities, getOpportunitiesByLeadId, addOpportunity, updateOpportunity, updateLead, addLead } = useCRMStore();

  const lead = leads.find((l) => l.id === id);
  const leadActivities = activities.filter((a) => a.leadId === id);
  const leadOpportunities = id ? getOpportunitiesByLeadId(id) : [];

  const [noteText, setNoteText] = useState('');
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState(''); 
  const [newCompanyRubro, setNewCompanyRubro] = useState<CompanyRubro | undefined>();
  const [newCompanyTipo, setNewCompanyTipo] = useState<CompanyTipo | undefined>();
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
  const [newContactName, setNewContactName] = useState('');
  const [newContactCargo, setNewContactCargo] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [tasks, setTasks] = useState<MockTask[]>(initialMockTasks);
  const [newTask, setNewTask] = useState({
    title: '',
    type: '' as TaskType | '',
    status: 'pendiente' as TaskStatus,
    priority: 'media' as TaskPriority,
    company: '',
    startDate: '',
    dueDate: '',
    startTime: '',
    assignee: '',
  });
  const [completedTask, setCompletedTask] = useState<MockTask | null>(null);
  const [activityFromTaskOpen, setActivityFromTaskOpen] = useState(false);

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

  const oppForm = useForm<NewOpportunityForm>({
    resolver: zodResolver(newOpportunitySchema) as import('react-hook-form').Resolver<NewOpportunityForm>,
    defaultValues: {
      title: '',
      amount: 0,
      etapa: 'lead',
      expectedCloseDate: '',
      assignedTo: '',
      description: '',
    },
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
    if (noteText.trim()) {
      toast.success('Nota agregada correctamente');
      setNoteText('');
    }
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

  function handleQuickAction(action: string) {
    setActiveDialog(action);
  }

  function submitQuickAction() {
    if (activeDialog === 'tarea') {
      if (!newTask.title.trim()) {
        toast.error('Ingresa un título para la tarea');
        return;
      }
      const assigneeName = users.find((u) => u.id === newTask.assignee)?.name ?? '';
      const task: MockTask = {
        id: `t${Date.now()}`,
        title: newTask.title,
        status: newTask.status,
        type: (newTask.type || undefined) as TaskType | undefined,
        priority: newTask.priority,
        company: newTask.company || undefined,
        startDate: newTask.startDate || undefined,
        dueDate: newTask.dueDate,
        startTime: newTask.startTime || undefined,
        assignee: assigneeName,
      };
      setTasks((prev) => [...prev, task]);
      setNewTask({ title: '', type: '', status: 'pendiente', priority: 'media', company: '', startDate: '', dueDate: '', startTime: '', assignee: '' });
      toast.success('Tarea creada');
      setActiveDialog(null);
      return;
    }
    const actionLabels: Record<string, string> = {
      nota: 'Nota agregada',
      llamada: 'Llamada registrada',
      reunion: 'Reunión programada',
      correo: 'Correo enviado',
      archivo: 'Archivo adjuntado',
    };
    toast.success(actionLabels[activeDialog ?? ''] ?? 'Acción completada');
    setActiveDialog(null);
  }

  function handleTaskToggle(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'completada') {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'pendiente' as TaskStatus } : t));
      return;
    }

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'completada' as TaskStatus } : t));
    toast.success('Tarea completada');

    if (task.type) {
      setCompletedTask(task);
      setActivityFromTaskOpen(true);
    }
  }

  function handleOpenConvertDialog() {
    if (lead) {
      oppForm.reset({
        title: `Servicio ${getPrimaryCompany(lead)?.name ?? 'Empresa'}`,
        amount: lead.estimatedValue,
        etapa: 'lead',
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        assignedTo: lead.assignedTo,
        description: '',
      });
    }
    setConvertDialogOpen(true);
  }

  function handleConvertToOpportunity(data: NewOpportunityForm) {
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
    setConvertDialogOpen(false);
    oppForm.reset();
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

  function handleAddCompany() {
    const name = newCompanyName.trim();
    if (!name || !lead) return;
    const companies = [...(lead.companies ?? []), { name, rubro: newCompanyRubro, tipo: newCompanyTipo, isPrimary: lead.companies?.length === 0 }];
    updateLead(lead.id, { companies });
    toast.success('Empresa agregada');
    setNewCompanyName('');
    setNewCompanyRubro(undefined);
    setNewCompanyTipo(undefined);
    setAddCompanyOpen(false);
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

  function handleCreateNewContact() {
    const name = newContactName.trim();
    const company = newContactCompany.trim();
    if (!name || !company || !lead) return;
    const newLead = addLead({
      name,
      cargo: newContactCargo.trim() || undefined,
      companies: [{ name: company }],
      phone: newContactPhone.trim() || lead.phone,
      email: newContactEmail.trim() || lead.email,
      source: lead.source,
      priority: lead.priority,
      assignedTo: lead.assignedTo,
      estimatedValue: 0,
    });
    const ids = lead.linkedContactIds ?? [];
    updateLead(lead.id, { linkedContactIds: [...ids, newLead.id] });
    toast.success('Contacto creado y vinculado');
    setNewContactName('');
    setNewContactCargo('');
    setNewContactCompany('');
    setNewContactPhone('');
    setNewContactEmail('');
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
    <div className="space-y-6">
      {/* Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-lg text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700" onClick={() => navigate('/contactos')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
            {lead.cargo && <p className="mt-0.5 text-sm text-muted-foreground">{lead.cargo}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw /> Cambiar Etapa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus /> Asignar
          </Button>
        </div>
      </div>

      {/* Main content: Summary cards + Tabs (left) | Sidebar (right) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_520px] items-start">
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1.5 border border-border/40">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('nota')}>
              <MessageSquare className="size-4" /> Nota
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('llamada')}>
              <Phone className="size-4" /> Llamada
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('reunion')}>
              <Calendar className="size-4" /> Reunión
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('correo')}>
              <Mail className="size-4" /> Correo
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('archivo')}>
              <Paperclip className="size-4" /> Archivo
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => handleQuickAction('tarea')}>
              <ClipboardList className="size-4" /> Tarea
            </Button>
          </div>
          {/* Summary cards */}
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
        <Tabs defaultValue="historial">
          <TabsList variant="line" className="w-full justify-start flex-wrap">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="actividades">Actividades</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
          </TabsList>

          {/* Actividades Tab */}
          <TabsContent value="actividades" className="mt-4">
            <Card className="pt-2">
              <CardContent>
                {leadActivities.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="Sin actividades"
                    description="No hay actividades registradas para este lead."
                    actionLabel="Registrar actividad"
                    onAction={() => handleQuickAction('llamada')}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Tipo</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Asignado</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadActivities.map((activity) => {
                        const statusColors: Record<string, string> = {
                          pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
                          completada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                          vencida: 'bg-red-100 text-red-700 border-red-200',
                          reprogramada: 'bg-blue-100 text-blue-700 border-blue-200',
                        };
                        const Icon = activityTypeIconMap[activity.type];
                        return (
                          <TableRow key={activity.id}>
                            <TableCell>
                              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                                <Icon className="size-4 text-muted-foreground" />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{activity.title}</TableCell>
                            <TableCell className="max-w-[220px] whitespace-normal text-muted-foreground">
                              <span className="line-clamp-2">{activity.description}</span>
                            </TableCell>
                            <TableCell>{activity.assignedToName}</TableCell>
                            <TableCell>{formatDate(activity.dueDate)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={statusColors[activity.status] ?? ''}>
                                {activityStatusLabelMap[activity.status] ?? activity.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
                  {mockNotes.map((note) => (
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
            <Card className="pt-2">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Tarea</TableHead>
                      <TableHead className="hidden md:table-cell">Empresa</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                      <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Checkbox
                            checked={task.status === 'completada'}
                            onCheckedChange={() => handleTaskToggle(task.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${task.status === 'completada' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{task.company ?? '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {task.type ? (
                            <Badge variant="outline" className="text-xs">{taskTypeLabels[task.type]}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge className={`text-xs border-0 ${taskPriorityColors[task.priority]}`}>
                            {priorityLabels[task.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{task.assignee}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {formatDate(task.dueDate)}
                          {task.startTime && <span className="ml-1 text-xs">({task.startTime})</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs border-0 ${taskStatusColors[task.status]}`}>
                            {taskStatusLabels[task.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial Tab */}
          <TabsContent value="historial" className="mt-4">
            <Card className="border-0 bg-transparent shadow-none pt-0">
              <CardContent className="pt-6">
                <div className="relative">
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {timelineEvents.map((event) => {
                      const Icon = timelineIconMap[event.type];
                      const colorClass = timelineColorMap[event.type];
                      return (
                        <div key={event.id} className="relative flex gap-4 pl-0">
                          <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{event.title}</p>
                              <span className="shrink-0 text-xs text-muted-foreground">{event.date}</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">por {event.user}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>

        {/* Right Sidebar - alineado con la fila de los cards de valor estimado, etapa, etc. */}
        <div className="space-y-4">
          <Card className="gap-2">
            <CardHeader className="-mb-1 -mt-1">
              <CardTitle className="text-[14px]">Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm pt-0">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate">{lead.email}</a>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span>{getPrimaryCompany(lead)?.name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <span>{leadSourceLabels[lead.source]}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span>Fecha de creación: {formatDate(lead.createdAt)}</span>
              </div>
              {(lead.departamento || lead.provincia || lead.distrito || lead.direccion) && (
                <>
                  <div className="border-t pt-2 mt-1" />
                  {lead.departamento && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-muted-foreground" />
                      <span>{lead.departamento}</span>
                    </div>
                  )}
                  {lead.provincia && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-muted-foreground">Provincia:</span>
                      <span>{lead.provincia}</span>
                    </div>
                  )}
                  {lead.distrito && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-muted-foreground">Distrito:</span>
                      <span>{lead.distrito}</span>
                    </div>
                  )}
                  {lead.direccion && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-muted-foreground">Dirección:</span>
                      <span>{lead.direccion}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>



          {/* Oportunidades vinculadas */}
          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <Briefcase className="size-4.5 text-muted-foreground" />
                Oportunidades
                <span className="text-muted-foreground font-normal">({leadOpportunities.length})</span>
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0">
                    <Plus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenConvertDialog}>Crear nueva</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddExistingOpportunityOpen(true)}>Agregar existente</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-0">
              {leadOpportunities.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-center text-xs text-muted-foreground">Sin oportunidades vinculadas.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {leadOpportunities.slice(0, 3).map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => navigate('/opportunities')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[14px] font-semibold leading-tight">{opp.title}</p>
                        <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[opp.etapa] ?? 'bg-gray-100 text-gray-700'}`}>
                          {etapaLabels[opp.etapa]}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2.5">
                        <span className="text-[15px] font-bold text-emerald-600">{formatCurrency(opp.amount)}</span>
                        <span className="text-[12px] text-muted-foreground">{opp.probability}% prob.</span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {opp.assignedToName}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          Cierre: {formatDate(opp.expectedCloseDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {leadOpportunities.length > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{leadOpportunities.length - 3} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Empresas vinculadas */}
          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <Building2 className="size-4.5 text-muted-foreground" />
                Empresas vinculadas
                <span className="text-muted-foreground font-normal">({lead.companies?.length ?? 0})</span>
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0">
                    <Plus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setAddCompanyOpen(true)}>Crear nueva</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddExistingCompanyOpen(true)}>Agregar existente</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-0">
              {(!lead.companies || lead.companies.length === 0) ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-center text-xs text-muted-foreground">Sin empresas vinculadas.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lead.companies.slice(0, 3).map((comp, idx) => (
                    <div
                      key={`${comp.name}-${idx}`}
                      className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {comp.isPrimary && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
                          <p className="text-[14px] font-semibold leading-tight truncate">{comp.name}</p>
                        </div>
                        {comp.rubro && (
                          <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${rubroColors[comp.rubro] ?? 'bg-gray-100 text-gray-700'}`}>
                            {companyRubroLabels[comp.rubro]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                        {comp.domain && (
                          <span className="flex items-center gap-1">
                            <Globe className="size-3" />
                            {comp.domain}
                          </span>
                        )}
                        {comp.tipo && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border-0 ${tipoColors[comp.tipo]}`}>
                            Tipo {comp.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {(lead.companies?.length ?? 0) > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{(lead.companies?.length ?? 0) - 3} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contactos vinculados */}
          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <Users className="size-4.5 text-muted-foreground" />
                Contactos vinculados
                <span className="text-muted-foreground font-normal">({lead.linkedContactIds?.length ?? 0})</span>
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0">
                    <Plus className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setNewContactOpen(true)}>Crear nuevo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddLinkContactOpen(true)}>Agregar existente</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-0">
              {(!lead.linkedContactIds || lead.linkedContactIds.length === 0) ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-center text-xs text-muted-foreground">Sin contactos vinculados.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(lead.linkedContactIds ?? []).slice(0, 3).map((contactId) => {
                    const linked = leads.find((l) => l.id === contactId);
                    if (!linked) return null;
                    const primaryCompany = getPrimaryCompany(linked);
                    return (
                      <div
                        key={contactId}
                        className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer"
                        onClick={() => navigate(`/contactos/${contactId}`)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-[14px] font-semibold leading-tight truncate">{linked.name}</p>
                          <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[linked.etapa] ?? 'bg-gray-100 text-gray-700'}`}>
                            {etapaLabels[linked.etapa]}
                          </Badge>
                        </div>
                        {linked.cargo && (
                          <p className="text-[13px] text-muted-foreground mb-2">{linked.cargo}{primaryCompany ? ` · ${primaryCompany.name}` : ''}</p>
                        )}
                        <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                          {linked.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="size-3" />
                              {linked.phone}
                            </span>
                          )}
                          {linked.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="size-3 shrink-0" />
                              {linked.email}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(lead.linkedContactIds?.length ?? 0) > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{(lead.linkedContactIds?.length ?? 0) - 3} más</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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

      {/* Quick Action Dialog */}
      <Dialog open={activeDialog !== null} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeDialog === 'nota' && 'Agregar Nota'}
              {activeDialog === 'llamada' && 'Registrar Llamada'}
              {activeDialog === 'reunion' && 'Programar Reunión'}
              {activeDialog === 'tarea' && 'Crear Tarea'}
              {activeDialog === 'correo' && 'Enviar Correo'}
              {activeDialog === 'archivo' && 'Adjuntar Archivo'}
            </DialogTitle>
            <DialogDescription>
              {activeDialog === 'nota' && 'Agrega una nota sobre este lead.'}
              {activeDialog === 'llamada' && 'Registra los detalles de la llamada.'}
              {activeDialog === 'reunion' && 'Programa una reunión con el lead.'}
              {activeDialog === 'tarea' && 'Crea una tarea relacionada a este lead.'}
              {activeDialog === 'correo' && 'Envía un correo a este contacto.'}
              {activeDialog === 'archivo' && 'Adjunta un archivo relacionado a este lead.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeDialog === 'nota' && (
              <div className="space-y-2">
                <Label>Contenido de la nota</Label>
                <Textarea placeholder="Escribe tu nota aquí..." rows={4} />
              </div>
            )}
            {activeDialog === 'llamada' && (
              <>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input placeholder="Asunto de la llamada" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input type="time" defaultValue={new Date().toTimeString().slice(0, 5)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duración (min)</Label>
                    <Input type="number" min={1} placeholder="Ej: 15" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="no_contesta">No contesta</SelectItem>
                      <SelectItem value="ocupado">Ocupado</SelectItem>
                      <SelectItem value="mensaje">Dejó mensaje</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resumen</Label>
                  <Textarea placeholder="Resumen de la conversación..." rows={3} />
                </div>
              </>
            )}
            {activeDialog === 'reunion' && (
              <>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input placeholder="Título de la reunión" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha y hora</Label>
                    <Input type="datetime-local" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de reunión</Label>
                    <Select>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="virtual">Virtual</SelectItem>
                        <SelectItem value="telefonica">Telefónica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectiva">Efectiva</SelectItem>
                      <SelectItem value="reprogramada">Reprogramada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas de la reunión</Label>
                  <Textarea placeholder="Puntos tratados, acuerdos, próximos pasos..." rows={3} />
                </div>
              </>
            )}
            {activeDialog === 'tarea' && (
              <>
                <div className="space-y-2">
                  <Label>Título de la tarea</Label>
                  <Input
                    placeholder="¿Qué necesitas hacer?"
                    value={newTask.title}
                    onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 grid-cols-2">
                  {/* Empresa */}
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select
                      value={newTask.company}
                      onValueChange={(v) => setNewTask((t) => ({ ...t, company: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(lead?.companies ?? []).map((comp) => (
                          <SelectItem key={comp.name} value={comp.name}>
                            <span className="flex items-center gap-2">
                              <Building2 className="size-3.5" />
                              {comp.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Asignar a */}
                  <div className="space-y-2">
                    <Label>Asignar a</Label>
                    <Select
                      value={newTask.assignee}
                      onValueChange={(v) => setNewTask((t) => ({ ...t, assignee: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar asesor" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter((u) => u.status === 'activo').map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={newTask.type}
                      onValueChange={(v) => setNewTask((t) => ({ ...t, type: v as TaskType }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estado */}
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={newTask.status}
                      onValueChange={(v) => setNewTask((t) => ({ ...t, status: v as TaskStatus }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskStatusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Prioridad */}
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v as TaskPriority }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Hora estimada */}
                  <div className="space-y-2">
                    <Label>Hora estimada</Label>
                    <Input
                      type="time"
                      value={newTask.startTime}
                      onChange={(e) => setNewTask((t) => ({ ...t, startTime: e.target.value }))}
                    />
                  </div>

                  {/* Fecha de inicio */}
                  <div className="space-y-2">
                    <Label>Fecha de inicio</Label>
                    <Input
                      type="date"
                      value={newTask.startDate}
                      onChange={(e) => setNewTask((t) => ({ ...t, startDate: e.target.value }))}
                    />
                  </div>

                  {/* Fecha límite */}
                  <div className="space-y-2">
                    <Label>Fecha límite</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
            {activeDialog === 'correo' && (
              <>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input placeholder="Asunto del correo" />
                </div>
                <div className="space-y-2">
                  <Label>Resumen del contenido</Label>
                  <Textarea placeholder="Resumen de lo enviado/recibido..." rows={3} />
                </div>
              </>
            )}
            {activeDialog === 'archivo' && (
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={submitQuickAction}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar empresa</DialogTitle>
            <DialogDescription>
              Vincula una nueva empresa al contacto {lead.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa *</Label>
              <Input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ej: Constructora ABC"
              />
            </div>
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Select value={newCompanyRubro ?? ''} onValueChange={(v) => setNewCompanyRubro(v ? (v as CompanyRubro) : undefined)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rubro" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyRubroLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newCompanyTipo ?? ''} onValueChange={(v) => setNewCompanyTipo(v ? (v as CompanyTipo) : undefined)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo (A, B, C)" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(companyTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCompanyOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCompany} disabled={!newCompanyName.trim()}>
              Agregar empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Crear nueva oportunidad Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Oportunidad</DialogTitle>
            <DialogDescription>
              Crea una nueva oportunidad vinculada a {lead.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={oppForm.handleSubmit(handleConvertToOpportunity)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="opp-title">Título *</Label>
                <Input
                  id="opp-title"
                  {...oppForm.register('title')}
                  placeholder="Ej: Servicio Corporativo Empresa X"
                />
                {oppForm.formState.errors.title && (
                  <p className="text-xs text-destructive">{oppForm.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-amount">Monto (S/) *</Label>
                <Input
                  id="opp-amount"
                  type="number"
                  {...oppForm.register('amount', { valueAsNumber: true })}
                  placeholder="0"
                />
                {oppForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{oppForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <Select
                  value={oppForm.watch('etapa')}
                  onValueChange={(v) => oppForm.setValue('etapa', v as Etapa)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {etapasParaOportunidad.map((e) => (
                      <SelectItem key={e} value={e}>
                        {etapaLabels[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-expectedCloseDate">Fecha estimada de cierre *</Label>
                <Input
                  id="opp-expectedCloseDate"
                  type="date"
                  {...oppForm.register('expectedCloseDate')}
                />
                {oppForm.formState.errors.expectedCloseDate && (
                  <p className="text-xs text-destructive">{oppForm.formState.errors.expectedCloseDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Responsable *</Label>
                <Select
                  value={oppForm.watch('assignedTo')}
                  onValueChange={(v) => oppForm.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === 'activo').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {oppForm.formState.errors.assignedTo && (
                  <p className="text-xs text-destructive">{oppForm.formState.errors.assignedTo.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-description">Descripción</Label>
              <Textarea
                id="opp-description"
                {...oppForm.register('description')}
                placeholder="Detalles adicionales sobre la oportunidad..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConvertDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Oportunidad</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Crear nuevo contacto Dialog */}
      <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nuevo contacto</DialogTitle>
            <DialogDescription>
              Crea un nuevo contacto y vincúlalo a {lead.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={newContactCargo}
                onChange={(e) => setNewContactCargo(e.target.value)}
                placeholder="Ej: Jefe de Proyectos"
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Input
                value={newContactCompany}
                onChange={(e) => setNewContactCompany(e.target.value)}
                placeholder="Ej: Minera Los Andes"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder={lead.phone || "Ej: 999 999 999"}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder={lead.email || "Ej: contacto@empresa.com"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewContactOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateNewContact} disabled={!newContactName.trim() || !newContactCompany.trim()}>
              Crear y vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      {/* Actividad generada al completar tarea */}
      <Dialog open={activityFromTaskOpen} onOpenChange={(open) => { setActivityFromTaskOpen(open); if (!open) setCompletedTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {completedTask?.type === 'llamada' && <><Phone className="size-5 text-blue-600" /> Registrar Llamada</>}
              {completedTask?.type === 'reunion' && <><Users className="size-5 text-emerald-600" /> Registrar Reunión</>}
              {completedTask?.type === 'correo' && <><Mail className="size-5 text-purple-600" /> Registrar Correo</>}
            </DialogTitle>
            <DialogDescription>
              La tarea "{completedTask?.title}" fue completada. Registra los detalles de la actividad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumen de la tarea completada */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tarea</span>
                <span className="font-medium">{completedTask?.title}</span>
              </div>
              {completedTask?.company && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{completedTask.company}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Responsable</span>
                <span>{completedTask?.assignee}</span>
              </div>
            </div>

            {completedTask?.type === 'llamada' && (
              <>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input placeholder="Asunto de la llamada" defaultValue={completedTask.title} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" defaultValue={completedTask.dueDate || new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input type="time" defaultValue={completedTask.startTime || new Date().toTimeString().slice(0, 5)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duración (min)</Label>
                    <Input type="number" min={1} placeholder="Ej: 15" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="no_contesta">No contesta</SelectItem>
                      <SelectItem value="ocupado">Ocupado</SelectItem>
                      <SelectItem value="mensaje">Dejó mensaje</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resumen</Label>
                  <Textarea placeholder="Resumen de la conversación..." rows={3} />
                </div>
              </>
            )}

            {completedTask?.type === 'reunion' && (
              <>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input placeholder="Título de la reunión" defaultValue={completedTask.title} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha y hora</Label>
                    <Input type="datetime-local" defaultValue={completedTask.dueDate && completedTask.startTime ? `${completedTask.dueDate}T${completedTask.startTime}` : ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de reunión</Label>
                    <Select>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="virtual">Virtual</SelectItem>
                        <SelectItem value="telefonica">Telefónica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectiva">Efectiva</SelectItem>
                      <SelectItem value="reprogramada">Reprogramada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas de la reunión</Label>
                  <Textarea placeholder="Puntos tratados, acuerdos, próximos pasos..." rows={3} />
                </div>
              </>
            )}

            {completedTask?.type === 'correo' && (
              <>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input placeholder="Asunto del correo" defaultValue={completedTask.title} />
                </div>
                <div className="space-y-2">
                  <Label>Resumen del contenido</Label>
                  <Textarea placeholder="Resumen de lo enviado/recibido..." rows={3} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActivityFromTaskOpen(false); setCompletedTask(null); }}>
              Omitir
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => {
              toast.success(`${completedTask?.type === 'llamada' ? 'Llamada' : completedTask?.type === 'reunion' ? 'Reunión' : 'Correo'} registrad${completedTask?.type === 'reunion' ? 'a' : completedTask?.type === 'llamada' ? 'a' : 'o'} exitosamente`);
              setActivityFromTaskOpen(false);
              setCompletedTask(null);
            }}>
              Guardar actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
