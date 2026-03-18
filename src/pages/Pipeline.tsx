import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCorners,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  Plus,
  Calendar,
  User,
  Building2,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, Etapa, PipelineColumn } from '@/types';
import { companyRubroLabels } from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany } from '@/lib/utils';
import { NewContactWizard, type NewContactData } from '@/components/shared/NewContactWizard';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PIPELINE_COLUMNS: { id: Etapa; title: string; color: string }[] = [
  { id: 'lead', title: 'Lead', color: 'bg-slate-500' },
  { id: 'contacto', title: 'Contacto', color: 'bg-blue-500' },
  { id: 'reunion_agendada', title: 'Reunión Agendada', color: 'bg-indigo-500' },
  { id: 'reunion_efectiva', title: 'Reunión Efectiva', color: 'bg-cyan-500' },
  { id: 'propuesta_economica', title: 'Propuesta Económica', color: 'bg-purple-500' },
  { id: 'negociacion', title: 'Negociación', color: 'bg-orange-500' },
  { id: 'licitacion', title: 'Licitación', color: 'bg-amber-500' },
  { id: 'licitacion_etapa_final', title: 'Licitación Etapa Final', color: 'bg-amber-600' },
  { id: 'cierre_ganado', title: 'Cierre Ganado', color: 'bg-emerald-500' },
  { id: 'firma_contrato', title: 'Firma de Contrato', color: 'bg-emerald-600' },
  { id: 'activo', title: 'Activo', color: 'bg-emerald-700' },
  { id: 'cierre_perdido', title: 'Cierre Perdido', color: 'bg-red-500' },
  { id: 'inactivo', title: 'Inactivo', color: 'bg-gray-500' },
];

const formatCurrency = (value: number) =>
  `S/ ${new Intl.NumberFormat('es-PE').format(value)}`;

function buildPipeline(allContacts: Contact[]): PipelineColumn[] {
  return PIPELINE_COLUMNS.map(({ id, title }) => {
    const columnContacts = allContacts.filter((l) => l.etapa === id);
    return {
      id,
      title,
      contacts: columnContacts,
      totalValue: columnContacts.reduce((sum, l) => sum + l.estimatedValue, 0),
    };
  });
}

function formatFollowUp(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

// --- Sortable Lead Card ---

interface SortableLeadCardProps {
  lead: Contact;
  overlay?: boolean;
}

function SortableLeadCard({ lead, overlay }: SortableLeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { lead, type: 'lead' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <LeadCard
        lead={lead}
        dragListeners={listeners}
        isDragging={isDragging}
        overlay={overlay}
      />
    </div>
  );
}

// --- Lead Card ---

interface LeadCardProps {
  lead: Contact;
  dragListeners?: ReturnType<typeof useSortable>['listeners'];
  isDragging?: boolean;
  overlay?: boolean;
}

function LeadCard({ lead, dragListeners, isDragging, overlay }: LeadCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/contactos/${lead.id}`)}
      className={cn(
        'group cursor-pointer rounded-lg border bg-white p-3.5 shadow-sm transition-all',
        'hover:shadow-md hover:border-primary/30',
        isDragging && 'opacity-40',
        overlay && 'rotate-2 shadow-xl border-primary/40',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="truncate text-sm font-semibold text-foreground">
              {lead.name}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Building2 className="size-3 shrink-0" />
              {getPrimaryCompany(lead)?.name ?? '—'}
            </p>
            {(getPrimaryCompany(lead)?.rubro || getPrimaryCompany(lead)?.tipo) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {getPrimaryCompany(lead)?.rubro && <Badge variant="outline" className="text-[10px] px-1 py-0">{companyRubroLabels[getPrimaryCompany(lead)!.rubro!]}</Badge>}
                {getPrimaryCompany(lead)?.tipo && <Badge variant="secondary" className="text-[10px] px-1 py-0">Tipo {getPrimaryCompany(lead)!.tipo}</Badge>}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(lead.estimatedValue)}
            </span>
            <PriorityBadge priority={lead.priority} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate">
              <User className="size-3 shrink-0" />
              <span className="truncate">{lead.assignedToName.split(' ')[0]}</span>
            </span>
            {lead.nextFollowUp && (
              <span className="flex shrink-0 items-center gap-1">
                <Calendar className="size-3" />
                {formatFollowUp(lead.nextFollowUp)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Droppable Column ---

interface KanbanColumnProps {
  column: PipelineColumn;
  colorClass: string;
}

function KanbanColumn({ column, colorClass }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex h-full min-w-[280px] max-w-[320px] shrink-0 flex-col">
      <div className={cn('h-1 rounded-t-lg', colorClass)} />

      <div className="flex items-center justify-between rounded-t-none border-x border-t bg-white/80 px-3.5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
          <Badge variant="secondary" className="size-5 justify-center rounded-full p-0 text-[10px] font-bold">
            {column.contacts.length}
          </Badge>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {formatCurrency(column.totalValue)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border-x border-b bg-muted/30 p-2"
      >
        <SortableContext
          items={column.contacts.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.contacts.map((contact) => (
            <SortableLeadCard key={contact.id} lead={contact} />
          ))}
        </SortableContext>

        {column.contacts.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-xs text-muted-foreground">
            Sin leads
          </div>
        )}
      </div>
    </div>
  );
}

// --- Pipeline Page ---

export default function Pipeline() {
  const { contacts: allContacts, updateContact, addContact } = useCRMStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);

  const pipeline = useMemo(() => buildPipeline(allContacts), [allContacts]);

  const activeLead = useMemo(
    () => (activeId ? allContacts.find((l) => l.id === activeId) : undefined),
    [activeId, allContacts],
  );

  const totalPipelineValue = useMemo(
    () => allContacts.reduce((sum, l) => sum + l.estimatedValue, 0),
    [allContacts],
  );

  function findColumnByContactId(contactId: string): Etapa | undefined {
    const lead = allContacts.find((l) => l.id === contactId);
    return lead?.etapa;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContactId = active.id as string;
    const overId = over.id as string;

    const activeColumn = findColumnByContactId(activeContactId);
    const overColumn = PIPELINE_COLUMNS.find((c) => c.id === overId)
      ? (overId as Etapa)
      : findColumnByContactId(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    updateContact(activeContactId, { etapa: overColumn });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContactId = active.id as string;
    const overId = over.id as string;

    const overColumn = PIPELINE_COLUMNS.find((c) => c.id === overId)
      ? (overId as Etapa)
      : findColumnByContactId(overId);

    if (!overColumn) return;

    updateContact(activeContactId, { etapa: overColumn });
  }

  function onSubmitNewContact(data: NewContactData) {
    addContact({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: [{ name: data.company, isPrimary: true }],
      phone: data.phone,
      email: data.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
    });
    toast.success(`Contacto "${data.name}" creado exitosamente`);
    setNewContactOpen(false);
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Pipeline Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona tu embudo de ventas arrastrando contactos entre etapas</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Valor total: <span className="text-foreground">{formatCurrency(totalPipelineValue)}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => toast.info('Filtros próximamente')}>
            <Filter className="size-4" />
            Filtros
          </Button>
          <Button size="sm" onClick={() => setNewContactOpen(true)}>
            <Plus className="size-4" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="scrollbar-thin -mx-2 flex flex-1 gap-3 overflow-x-auto px-2 pb-4">
          {pipeline.map((column) => {
            const colConfig = PIPELINE_COLUMNS.find((c) => c.id === column.id)!;
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                colorClass={colConfig.color}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[280px]">
              <LeadCard lead={activeLead} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <NewContactWizard
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        onSubmit={onSubmitNewContact}
      />
    </div>
  );
}
