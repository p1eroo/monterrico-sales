import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppStore } from '@/store';
import {
  DndContext,
  closestCorners,
  DragOverlay,
  PointerSensor,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  Plus,
  Calendar,
  User,
  Building2,
  X,
  ChevronRight,
  Check,
  Info,
  RefreshCw,
  UserPlus,
  Phone,
  Mail,
  Users,
  MessageSquare,
  CheckSquare,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, Etapa, Opportunity, PipelineColumn } from '@/types';
import { companyRubroLabels, etapaLabels, activities, activityTypeLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { api } from '@/lib/api';
import { fetchCrmConfig } from '@/lib/crmConfigApi';
import type { CrmCatalogDto } from '@/lib/crmConfigApi';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { contactDetailHref, opportunityDetailHref } from '@/lib/detailRoutes';
import { getPrimaryCompany } from '@/lib/utils';
import {
  type ApiContactDetail,
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactUpdate,
  contactListAll,
} from '@/lib/contactApi';
import {
  type ApiOpportunityListRow,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangeEtapaDialog } from '@/components/shared/ChangeEtapaDialog';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { cn } from '@/lib/utils';
import { formatCurrencyShort, formatDateShortLocal } from '@/lib/formatters';
import type { ActivityType } from '@/types';

export type PipelineStageColumnConfig = {
  id: Etapa;
  title: string;
  /** Color de acento (hex) para barras y puntos; inline para que funcione con cualquier valor del catálogo. */
  accentColor: string;
};

/** Orden y colores por defecto si aún no hay catálogo CRM en memoria. */
const FALLBACK_PIPELINE_COLUMNS: PipelineStageColumnConfig[] = [
  { id: 'lead', title: 'Lead', accentColor: '#64748b' },
  { id: 'contacto', title: 'Contacto', accentColor: '#3b82f6' },
  { id: 'reunion_agendada', title: 'Reunión Agendada', accentColor: '#6366f1' },
  { id: 'reunion_efectiva', title: 'Reunión Efectiva', accentColor: '#06b6d4' },
  { id: 'propuesta_economica', title: 'Propuesta Económica', accentColor: '#a855f7' },
  { id: 'negociacion', title: 'Negociación', accentColor: '#f97316' },
  { id: 'licitacion', title: 'Licitación', accentColor: '#f59e0b' },
  { id: 'licitacion_etapa_final', title: 'Licitación Etapa Final', accentColor: '#d97706' },
  { id: 'cierre_ganado', title: 'Cierre Ganado', accentColor: '#22c55e' },
  { id: 'firma_contrato', title: 'Firma de Contrato', accentColor: '#16a34a' },
  { id: 'activo', title: 'Activo', accentColor: '#15803d' },
  { id: 'cierre_perdido', title: 'Cierre Perdido', accentColor: '#ef4444' },
  { id: 'inactivo', title: 'Inactivo', accentColor: '#6b7280' },
];

function normalizeHexColor(raw: string, fallback: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t) || /^#[0-9A-Fa-f]{3}$/.test(t)) return t;
  return fallback;
}

function stagesFromCatalog(
  stages: CrmCatalogDto['stages'] | undefined,
): PipelineStageColumnConfig[] {
  if (!stages?.length) return FALLBACK_PIPELINE_COLUMNS;
  const sorted = [...stages]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!sorted.length) return FALLBACK_PIPELINE_COLUMNS;
  return sorted.map((s) => ({
    id: s.slug as Etapa,
    title: s.name,
    accentColor: normalizeHexColor(s.color, '#64748b'),
  }));
}

/** Incluye al final etapas presentes en contactos pero fuera del catálogo habilitado (datos legacy). */
function mergePipelineColumns(
  base: PipelineStageColumnConfig[],
  contacts: Contact[],
): PipelineStageColumnConfig[] {
  const seen = new Set(base.map((c) => c.id));
  const tail: PipelineStageColumnConfig[] = [];
  for (const contact of contacts) {
    const e = contact.etapa;
    if (seen.has(e)) continue;
    seen.add(e);
    const fb = FALLBACK_PIPELINE_COLUMNS.find((x) => x.id === e);
    tail.push(
      fb ?? {
        id: e,
        title: etapaLabels[e] ?? e,
        accentColor: '#94a3b8',
      },
    );
  }
  return [...base, ...tail];
}

function formatEtapaDate(dateStr: string): string {
  return formatDateShortLocal(dateStr);
}

function buildPipeline(
  allContacts: Contact[],
  columnConfigs: PipelineStageColumnConfig[],
): PipelineColumn[] {
  return columnConfigs.map(({ id, title }) => {
    const columnContacts = allContacts.filter((l) => l.etapa === id);
    return {
      id,
      title,
      contacts: columnContacts,
      totalValue: columnContacts.reduce((sum, l) => sum + l.estimatedValue, 0),
    };
  });
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00').getTime();
  const d2 = new Date(b + 'T00:00:00').getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/** Por encima de esto se virtualiza la columna (menos DOM; drag sigue con overlay + droppable en el scroll). */
const PIPELINE_VIRTUAL_MIN_CARDS = 16;
/** Altura base por fila (px); `measureElement` ajusta con el contenido real. */
const PIPELINE_CARD_ESTIMATE_PX = 132;
const PIPELINE_CARD_GAP_PX = 8;

const activityTypeIconMap: Record<ActivityType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  whatsapp: MessageSquare,
};

// --- Draggable card: useDraggable hace menos trabajo por frame que useSortable + SortableContext.
//    Misma LeadCard en lista y en DragOverlay (UX); colisión solo contra columnas (pipelineCollisionDetection).

interface PipelineLeadCardProps {
  lead: Contact;
  overlay?: boolean;
  onCardClick?: (contact: Contact) => void;
  /** Primera oportunidad API vinculada a este contacto (si existe). */
  pipelineOpportunity?: Opportunity | null;
}

const PipelineLeadCard = memo(function PipelineLeadCard({
  lead,
  overlay,
  onCardClick,
  pipelineOpportunity,
}: PipelineLeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead, type: 'lead' },
  });

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.35 } : undefined}
      className={cn(
        'touch-none cursor-grab select-none active:cursor-grabbing',
        isDragging && 'will-change-transform',
      )}
      {...attributes}
      {...listeners}
    >
      <LeadCard
        lead={lead}
        isDragging={isDragging}
        overlay={overlay}
        onCardClick={onCardClick}
        pipelineOpportunity={pipelineOpportunity}
      />
    </div>
  );
});

// --- Lead Card ---

interface LeadCardProps {
  lead: Contact;
  isDragging?: boolean;
  overlay?: boolean;
  onCardClick?: (contact: Contact) => void;
  pipelineOpportunity?: Opportunity | null;
}

const LeadCard = memo(function LeadCard({
  lead,
  isDragging,
  overlay,
  onCardClick,
  pipelineOpportunity,
}: LeadCardProps) {
  const navigate = useNavigate();
  const opportunity = pipelineOpportunity;
  const company = getPrimaryCompany(lead);

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (opportunity) {
      navigate(opportunityDetailHref(opportunity));
    } else if (onCardClick) {
      onCardClick(lead);
    }
  };

  return (
    <div
      className={cn(
        'group relative select-none rounded-lg border border-border bg-[var(--pipeline-kanban-surface)] p-3.5 text-card-foreground shadow-none',
        !overlay && [
          'transition-[box-shadow,border-color,opacity] duration-150',
          'dark:shadow-md dark:shadow-black/35',
          'hover:border-primary/30 dark:hover:shadow-lg dark:hover:shadow-black/40',
        ],
        isDragging && 'opacity-40',
        overlay && 'pointer-events-none rotate-2 shadow-xl border-primary/40',
      )}
    >
      {onCardClick && !overlay && (
        <button
          type="button"
          className="absolute right-2 top-2 z-[1] rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onCardClick(lead);
          }}
          aria-label="Ver detalle del proceso"
        >
          <Info className="size-4" />
        </button>
      )}
      <div className="space-y-2.5">
        <div>
          {overlay ? (
            <span className="block w-full truncate text-left text-sm font-semibold text-foreground">
              {opportunity?.title ?? lead.name}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleNameClick}
              className={cn(
                'block w-full truncate text-left text-sm font-semibold text-foreground',
                (opportunity || onCardClick) && 'cursor-pointer hover:underline hover:text-primary',
              )}
            >
              {opportunity?.title ?? lead.name}
            </button>
          )}
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Building2 className="size-3 shrink-0" />
            {company?.name ?? '—'}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <User className="size-3 shrink-0" />
            {lead.name}
          </p>
          {(company?.rubro || company?.tipo) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {company?.rubro && <Badge variant="outline" className="text-[10px] px-1 py-0">{companyRubroLabels[company.rubro]}</Badge>}
              {company?.tipo && <Badge variant="secondary" className="text-[10px] px-1 py-0">Tipo {company.tipo}</Badge>}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">
            {formatCurrencyShort(opportunity?.amount ?? lead.estimatedValue)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <User className="size-3 shrink-0" />
            <span className="truncate">{lead.assignedToName.split(' ')[0]}</span>
          </span>
        </div>
      </div>
    </div>
  );
});

// --- Card Detail Dialog ---

interface CardDetailDialogProps {
  contact: Contact | null;
  /** Oportunidad desde API (primera vinculada al contacto), si existe. */
  pipelineOpportunity?: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeEtapa: () => void;
  onOpenAssign: () => void;
  /** Columnas del pipeline (orden y nombres desde configuración). */
  stageColumns: PipelineStageColumnConfig[];
}

function CardDetailDialog({
  contact,
  pipelineOpportunity,
  open,
  onOpenChange,
  onOpenChangeEtapa,
  onOpenAssign,
  stageColumns,
}: CardDetailDialogProps) {
  const navigate = useNavigate();
  const opportunity = pipelineOpportunity;
  const company = contact ? getPrimaryCompany(contact) : undefined;

  if (!contact) return null;

  const currentIndex = stageColumns.findIndex((c) => c.id === contact.etapa);
  const history = contact.etapaHistory ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const recentActivities = activities
    .filter((a) => a.contactId === contact.id)
    .sort((a, b) => {
      const da = a.completedAt ?? a.createdAt;
      const db = b.completedAt ?? b.createdAt;
      return db.localeCompare(da);
    })
    .slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {opportunity?.title ?? contact.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.2fr]">
          {/* Columna izquierda: Progreso en el pipeline */}
          <div className="border-b pb-4 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Progreso en el pipeline</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto sm:max-h-[calc(90vh-10rem)]">
              {stageColumns.map((col, idx) => {
                const isCurrent = col.id === contact.etapa;
                const isPast = currentIndex >= 0 && idx < currentIndex;
                const etapaEntry = history.find((e) => e.etapa === col.id);
                const nextEntry = history[history.findIndex((e) => e.etapa === col.id) + 1];
                const fecha = etapaEntry ? formatEtapaDate(etapaEntry.fecha) : (isPast || isCurrent ? '—' : 'Pendiente');
                const dias = etapaEntry && nextEntry ? daysBetween(etapaEntry.fecha, nextEntry.fecha) : (etapaEntry && isCurrent ? daysBetween(etapaEntry.fecha, today) : null);
                const diasLabel = dias !== null ? (dias === 0 ? '<1 día' : dias === 1 ? '1 día' : `${dias} días`) : null;
                return (
                  <div
                    key={col.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs',
                      isCurrent && 'bg-primary/10 font-medium text-primary',
                      isPast && 'text-muted-foreground',
                      !isCurrent && !isPast && 'text-muted-foreground/70',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full',
                          isPast && 'bg-primary/20 text-primary',
                          !isPast && !isCurrent && 'bg-muted',
                        )}
                        style={isCurrent ? { backgroundColor: col.accentColor } : undefined}
                      >
                        {isPast ? <Check className="size-3" /> : isCurrent ? <span className="size-2 rounded-full bg-background" /> : <span className="size-1.5 rounded-full bg-current opacity-50" />}
                      </div>
                      {isCurrent && <ChevronRight className="size-3.5 shrink-0" />}
                      <span className={cn(isCurrent && 'font-semibold')}>{col.title}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className={cn('tabular-nums', (!isPast && !isCurrent) && 'text-muted-foreground/60')}>{fecha}</span>
                      {diasLabel && (isPast || isCurrent) && (
                        <span className="text-[10px] text-muted-foreground/80">{diasLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna derecha: Info, actividades, métricas, acciones */}
          <div className="flex flex-col gap-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" />
              {company?.name ?? '—'}
            </p>
            <p className="flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              {contact.name}
            </p>
          </div>

          {recentActivities.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Actividades recientes</p>
              <div className="space-y-1.5">
                {recentActivities.map((act) => {
                  const Icon = activityTypeIconMap[act.type as ActivityType] ?? Phone;
                  return (
                    <div key={act.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{act.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {activityTypeLabels[act.type] ?? act.type} · {formatEtapaDate(act.completedAt ?? act.dueDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t pt-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Valor</p>
              <p className="text-sm font-semibold">{formatCurrencyShort(opportunity?.amount ?? contact.estimatedValue)}</p>
            </div>
            {opportunity && (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground">Probabilidad</p>
                  <p className="text-sm font-medium">{opportunity.probability}%</p>
                </div>
                {opportunity.expectedCloseDate && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Cierre esperado</p>
                    <p className="flex items-center gap-1 text-sm">
                      <Calendar className="size-3.5" />
                      {formatFullDate(opportunity.expectedCloseDate)}
                    </p>
                  </div>
                )}
              </>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground">Asignado</p>
              <p className="text-sm">{contact.assignedToName}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onOpenChangeEtapa}>
              <RefreshCw className="mr-1 size-3.5" />
              Cambiar etapa
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onOpenAssign}>
              <UserPlus className="mr-1 size-3.5" />
              Asignar
            </Button>
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              if (opportunity) {
                navigate(opportunityDetailHref(opportunity));
              } else {
                navigate(contactDetailHref(contact));
              }
            }}
          >
            Ver detalle completo
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Droppable Column ---

interface KanbanColumnProps {
  column: PipelineColumn;
  accentColor: string;
  onCardClick?: (contact: Contact) => void;
  pipelineOpportunityFor: (contactId: string) => Opportunity | undefined;
  /** Zona de suelta visual (estilo HubSpot): solo UI, sin persistir aquí. */
  showDropPlaceholder?: boolean;
}

function ColumnDropSlot({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="mb-2 min-h-[4.5rem] shrink-0 rounded-lg border-2 border-dashed bg-muted/40"
      style={{ borderColor: accentColor }}
      aria-hidden
    >
      <div className="flex h-full min-h-[4.5rem] items-center justify-center px-2 text-center text-[11px] font-medium text-muted-foreground">
        Soltar aquí
      </div>
    </div>
  );
}

/** Placeholder mientras llegan contactos y oportunidades (evita confundir con pipeline vacío). */
function PipelineKanbanSkeleton({ columns }: { columns: PipelineStageColumnConfig[] }) {
  return (
    <div
      className="scrollbar-thin -mx-2 flex h-[calc(100dvh-13rem)] min-h-[32rem] w-full max-w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden px-2 pb-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando datos del pipeline"
    >
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex h-full min-h-0 min-w-[280px] max-w-[320px] shrink-0 flex-col"
        >
          <div className="h-1 rounded-t-lg opacity-70" style={{ backgroundColor: col.accentColor }} />
          <div className="flex items-center justify-between gap-3 rounded-t-none border-x border-t border-border bg-[var(--pipeline-kanban-column-header)] px-3.5 py-3 backdrop-blur-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-5 max-w-[9rem] flex-1" />
              <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-4 w-[4.5rem] shrink-0" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-b-lg border-x border-b bg-muted/30 p-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  column,
  accentColor,
  onCardClick,
  pipelineOpportunityFor,
  showDropPlaceholder = false,
}: KanbanColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef } = useDroppable({ id: column.id });

  const setScrollAndDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const contacts = column.contacts;
  const useVirtual = contacts.length >= PIPELINE_VIRTUAL_MIN_CARDS;

  const virtualizer = useVirtualizer({
    count: useVirtual ? contacts.length : 0,
    enabled: useVirtual,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PIPELINE_CARD_ESTIMATE_PX,
    gap: PIPELINE_CARD_GAP_PX,
    overscan: 8,
  });

  return (
    <div className="flex h-full min-h-0 min-w-[280px] max-w-[320px] shrink-0 flex-col">
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: accentColor }} />

      <div className="flex items-center justify-between gap-3 rounded-t-none border-x border-t border-border bg-[var(--pipeline-kanban-column-header)] px-3.5 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{column.title}</h3>
          <Badge variant="secondary" className="shrink-0 font-bold tabular-nums">
            {column.contacts.length}
          </Badge>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {formatCurrencyShort(column.totalValue)}
        </span>
      </div>

      <div
        ref={setScrollAndDropRef}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border-x border-b bg-muted/30 p-2"
      >
        {showDropPlaceholder && <ColumnDropSlot accentColor={accentColor} />}

        {contacts.length === 0 && !showDropPlaceholder ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-xs text-muted-foreground">
            Sin contactos
          </div>
        ) : useVirtual ? (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
              const contact = contacts[v.index];
              if (!contact) return null;
              return (
                <div
                  key={contact.id}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <PipelineLeadCard
                    lead={contact}
                    onCardClick={onCardClick}
                    pipelineOpportunity={pipelineOpportunityFor(contact.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          contacts.map((contact) => (
            <PipelineLeadCard
              key={contact.id}
              lead={contact}
              onCardClick={onCardClick}
              pipelineOpportunity={pipelineOpportunityFor(contact.id)}
            />
          ))
        )}
      </div>
    </div>
  );
});

// --- Pipeline Page ---

interface PipelineFilters {
  assignedTo: string;
  rubro: string;
  etapas: Etapa[];
}

const emptyFilters: PipelineFilters = { assignedTo: '', rubro: '', etapas: [] };

/** Fusiona PATCH de detalle en la fila de lista (evita `contactListAll` tras cada movimiento). */
function mergeListRowFromContactDetail(
  row: ApiContactListRow,
  detail: ApiContactDetail,
): ApiContactListRow {
  return {
    ...row,
    etapa: detail.etapa,
    updatedAt: detail.updatedAt,
    etapaHistory: detail.etapaHistory ?? row.etapaHistory,
    assignedTo: detail.assignedTo ?? row.assignedTo,
    user: detail.user ?? row.user,
  };
}

/** Primera oportunidad de la lista API por contacto (orden de `opportunityListAll`). */
function buildOpportunityByContactId(rows: ApiOpportunityListRow[]): Map<string, Opportunity> {
  const map = new Map<string, Opportunity>();
  for (const row of rows) {
    const o = mapApiOpportunityToOpportunity(row);
    const cid = o.contactId;
    if (cid && !map.has(cid)) {
      map.set(cid, o);
    }
  }
  return map;
}

export default function Pipeline() {
  const { hasPermission } = usePermissions();
  const currentUserId = useAppStore((s) => s.currentUser.id);
  const canSeeAllAdvisors = hasPermission('equipo.datos_completos');
  const { activeAdvisors } = useUsers();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const setBundle = useCrmConfigStore((s) => s.setBundle);

  useEffect(() => {
    let cancelled = false;
    void fetchCrmConfig()
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setBundle]);

  const [apiRows, setApiRows] = useState<ApiContactListRow[]>([]);
  const [oppsApiRows, setOppsApiRows] = useState<ApiOpportunityListRow[]>([]);
  /** Solo la primera carga: refetch tras crear oportunidad no vuelve a tapar el tablero. */
  const [initialPipelineLoad, setInitialPipelineLoad] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Columna bajo el puntero durante el drag: solo feedback visual (tipo HubSpot). */
  const [dropTargetColumnId, setDropTargetColumnId] = useState<Etapa | null>(null);

  const loadPipelineData = useCallback(async () => {
    try {
      const [contacts, opps] = await Promise.all([contactListAll(), opportunityListAll()]);
      setApiRows(contacts);
      setOppsApiRows(opps);
    } catch {
      setApiRows([]);
      setOppsApiRows([]);
    } finally {
      setInitialPipelineLoad(false);
    }
  }, []);

  useEffect(() => {
    void loadPipelineData();
  }, [loadPipelineData]);

  const opportunityByContactId = useMemo(
    () => buildOpportunityByContactId(oppsApiRows),
    [oppsApiRows],
  );

  const pipelineOpportunityFor = useCallback(
    (contactId: string) => opportunityByContactId.get(contactId),
    [opportunityByContactId],
  );

  const allContacts = useMemo(
    () => apiRows.map(mapApiContactRowToContact),
    [apiRows],
  );

  const catalogStageColumns = useMemo(
    () => stagesFromCatalog(bundle?.catalog.stages),
    [bundle?.catalog.stages],
  );

  const displayColumns = useMemo(
    () => mergePipelineColumns(catalogStageColumns, allContacts),
    [catalogStageColumns, allContacts],
  );

  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);

  async function handleCreateOpportunityFromPipeline(data: NewOpportunityFormValues) {
    const body = buildOpportunityCreateBody(data);
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loadPipelineData();
      toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear la oportunidad en el servidor',
      );
      throw e;
    }
  }
  const [filters, setFilters] = useState<PipelineFilters>(emptyFilters);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!canSeeAllAdvisors && filters.assignedTo === '') {
      setFilters((f) => ({ ...f, assignedTo: currentUserId }));
    }
  }, [canSeeAllAdvisors, currentUserId, filters.assignedTo]);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [changeEtapaOpen, setChangeEtapaOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function applyEtapaUpdate(contactId: string, etapa: Etapa): Promise<void> {
    if (!isLikelyContactCuid(contactId)) {
      toast.error('Solo se puede actualizar la etapa de contactos guardados en el servidor');
      throw new Error('INVALID_CONTACT_ID');
    }

    let previousEtapa: string | undefined;
    let hadRow = false;
    setApiRows((prev) => {
      const cur = prev.find((r) => r.id === contactId);
      if (!cur) return prev;
      hadRow = true;
      previousEtapa = cur.etapa;
      return prev.map((r) => (r.id === contactId ? { ...r, etapa } : r));
    });

    try {
      const updated = await contactUpdate(contactId, { etapa });
      setApiRows((prev) => {
        const idx = prev.findIndex((r) => r.id === contactId);
        if (idx === -1) {
          void loadPipelineData();
          return prev;
        }
        return prev.map((r, i) =>
          i === idx ? mergeListRowFromContactDetail(r, updated) : r,
        );
      });
    } catch (e) {
      if (hadRow && previousEtapa !== undefined) {
        setApiRows((prev) =>
          prev.map((r) => (r.id === contactId ? { ...r, etapa: previousEtapa! } : r)),
        );
      }
      toast.error(e instanceof Error ? e.message : 'Error al actualizar etapa');
      throw e;
    }
  }

  async function applyAssignUpdate(contactId: string, assignedTo: string): Promise<void> {
    if (!isLikelyContactCuid(contactId)) {
      toast.error('Solo se puede asignar contactos guardados en el servidor');
      throw new Error('INVALID_CONTACT_ID');
    }

    let previousAssigned: string | null | undefined;
    let previousUser: ApiContactListRow['user'];
    let hadRow = false;
    setApiRows((prev) => {
      const cur = prev.find((r) => r.id === contactId);
      if (!cur) return prev;
      hadRow = true;
      previousAssigned = cur.assignedTo;
      previousUser = cur.user;
      return prev.map((r) =>
        r.id === contactId
          ? { ...r, assignedTo: assignedTo || null, user: null }
          : r,
      );
    });

    try {
      const updated = await contactUpdate(contactId, { assignedTo });
      setApiRows((prev) => {
        const idx = prev.findIndex((r) => r.id === contactId);
        if (idx === -1) {
          void loadPipelineData();
          return prev;
        }
        return prev.map((r, i) =>
          i === idx ? mergeListRowFromContactDetail(r, updated) : r,
        );
      });
    } catch (e) {
      if (hadRow) {
        setApiRows((prev) =>
          prev.map((r) =>
            r.id === contactId
              ? { ...r, assignedTo: previousAssigned, user: previousUser }
              : r,
          ),
        );
      }
      toast.error(e instanceof Error ? e.message : 'Error al asignar');
      throw e;
    }
  }

  const advisorFilterIsActive = canSeeAllAdvisors
    ? Boolean(filters.assignedTo)
    : false;
  const activeFilterCount =
    (advisorFilterIsActive ? 1 : 0) +
    (filters.rubro ? 1 : 0) +
    (filters.etapas.length > 0 ? 1 : 0);

  const filteredContacts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allContacts.filter((c) => {
      if (term && !c.name.toLowerCase().includes(term) &&
          !getPrimaryCompany(c)?.name?.toLowerCase().includes(term) &&
          !c.telefono?.includes(term) &&
          !c.correo?.toLowerCase().includes(term)) return false;
      if (filters.assignedTo && c.assignedTo !== filters.assignedTo) return false;
      if (filters.etapas.length > 0 && !filters.etapas.includes(c.etapa)) return false;
      if (filters.rubro) {
        const company = getPrimaryCompany(c);
        if (!company?.rubro || company.rubro !== filters.rubro) return false;
      }
      return true;
    });
  }, [allContacts, filters, searchTerm]);

  const pipeline = useMemo(() => {
    const all = buildPipeline(filteredContacts, displayColumns);
    if (filters.etapas.length > 0) return all.filter((col) => filters.etapas.includes(col.id));
    return all;
  }, [filteredContacts, filters.etapas, displayColumns]);

  const activeLead = useMemo(
    () => (activeId ? allContacts.find((l) => l.id === activeId) : undefined),
    [activeId, allContacts],
  );

  const totalPipelineValue = useMemo(
    () => filteredContacts.reduce((sum, l) => sum + l.estimatedValue, 0),
    [filteredContacts],
  );

  const columnIdsForCollision = useMemo(
    () => new Set(displayColumns.map((c) => c.id as string)),
    [displayColumns],
  );

  /** Solo columnas como “over”: evita medir cientos de rects de tarjetas en cada frame. */
  const pipelineCollisionDetection = useCallback<CollisionDetection>(
    (args) =>
      closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          columnIdsForCollision.has(String(c.id)),
        ),
      }),
    [columnIdsForCollision],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handlePipelineCardClick = useCallback((c: Contact) => {
    setSelectedContact(c);
  }, []);

  function findColumnByContactId(contactId: string): Etapa | undefined {
    const lead = allContacts.find((l) => l.id === contactId);
    return lead?.etapa;
  }

  function resolveOverColumn(overId: string): Etapa | undefined {
    if (displayColumns.some((c) => c.id === overId)) {
      return overId as Etapa;
    }
    return findColumnByContactId(overId);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveId(id);
    setDropTargetColumnId(findColumnByContactId(id) ?? null);
  }

  /**
   * Solo UI: placeholder / anillo en la columna objetivo. `setState` solo si cambia la etapa
   * (evita re-renders por frame). No llamar APIs aquí.
   */
  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setDropTargetColumnId((prev) => (prev === null ? prev : null));
      return;
    }
    const col = resolveOverColumn(over.id as string);
    if (!col) {
      setDropTargetColumnId((prev) => (prev === null ? prev : null));
      return;
    }
    setDropTargetColumnId((prev) => (prev === col ? prev : col));
  }

  function clearDragUi() {
    setActiveId(null);
    setDropTargetColumnId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeContactId = active.id as string;
    clearDragUi();
    if (!over) return;

    const overId = over.id as string;

    const overColumn = resolveOverColumn(overId);

    if (!overColumn) return;

    const fromColumn = findColumnByContactId(activeContactId);
    if (fromColumn === overColumn) return;

    void applyEtapaUpdate(activeContactId, overColumn);
  }

  function handleDragCancel() {
    clearDragUi();
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Pipeline Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arrastra las tarjetas entre columnas para cambiar la etapa del contacto.
          </p>
        </div>
<div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Valor total:{' '}
            {initialPipelineLoad ? (
              <Skeleton className="inline-block h-4 w-[7.5rem] align-middle" />
            ) : (
              <span className="text-foreground">{formatCurrencyShort(totalPipelineValue)}</span>
            )}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('bg-white dark:bg-gray-900', activeFilterCount > 0 && 'border-primary text-primary')}>
                <Filter className="size-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 size-5 justify-center rounded-full p-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Filtros</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs"
                      onClick={() =>
                        setFilters(
                          canSeeAllAdvisors
                            ? emptyFilters
                            : { ...emptyFilters, assignedTo: currentUserId },
                        )
                      }
                    >
                      <X className="mr-1 size-3" />
                      Limpiar
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs bg-white dark:bg-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Asesor</Label>
                  <Select
                    value={filters.assignedTo}
                    onValueChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        assignedTo: v === '_all' ? '' : v,
                      }))
                    }
                    disabled={!canSeeAllAdvisors}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      {activeAdvisors.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Rubro</Label>
                  <Select value={filters.rubro} onValueChange={(v) => setFilters((f) => ({ ...f, rubro: v === '_all' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      {Object.entries(companyRubroLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Etapa</Label>
                    {filters.etapas.length > 0 && (
                      <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => setFilters((f) => ({ ...f, etapas: [] }))}>
                        Deseleccionar
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {displayColumns.map((col) => (
                      <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                        <Checkbox
                          checked={filters.etapas.includes(col.id)}
                          onCheckedChange={(checked) => {
                            setFilters((f) => ({
                              ...f,
                              etapas: checked
                                ? [...f.etapas, col.id]
                                : f.etapas.filter((e) => e !== col.id),
                            }));
                          }}
                        />
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: col.accentColor }}
                        />
                        {col.title}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={() => setNewOpportunityOpen(true)}>
            <Plus className="size-4" />
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      {initialPipelineLoad ? (
        <PipelineKanbanSkeleton columns={displayColumns} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pipelineCollisionDetection}
          autoScroll={{ threshold: { x: 0.16, y: 0.12 } }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="scrollbar-thin -mx-2 flex h-[calc(100dvh-13rem)] min-h-[32rem] w-full max-w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden px-2 pb-4">
            {pipeline.map((column) => {
              const colConfig = displayColumns.find((c) => c.id === column.id)!;
              const sourceCol = activeId ? findColumnByContactId(activeId) : undefined;
              const showSlot =
                Boolean(activeId) &&
                dropTargetColumnId === column.id &&
                sourceCol !== undefined &&
                dropTargetColumnId !== sourceCol;
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  accentColor={colConfig.accentColor}
                  onCardClick={handlePipelineCardClick}
                  pipelineOpportunityFor={pipelineOpportunityFor}
                  showDropPlaceholder={showSlot}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <div className="w-[280px]">
                <LeadCard
                  lead={activeLead}
                  overlay
                  pipelineOpportunity={pipelineOpportunityFor(activeLead.id)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <NewOpportunityFormDialog
        open={newOpportunityOpen}
        onOpenChange={setNewOpportunityOpen}
        title="Nueva Oportunidad"
        description="Registra una oportunidad en el pipeline. Vincula contacto y empresa ya existentes; no se crean desde aquí."
        onCreate={handleCreateOpportunityFromPipeline}
      />

      <CardDetailDialog
        contact={selectedContact ? allContacts.find((c) => c.id === selectedContact.id) ?? selectedContact : null}
        pipelineOpportunity={
          selectedContact ? pipelineOpportunityFor(selectedContact.id) : undefined
        }
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
        onOpenChangeEtapa={() => setChangeEtapaOpen(true)}
        onOpenAssign={() => setAssignOpen(true)}
        stageColumns={displayColumns}
      />

      {selectedContact && (() => {
        const freshContact = allContacts.find((c) => c.id === selectedContact.id) ?? selectedContact;
        return (
        <>
          <ChangeEtapaDialog
            open={changeEtapaOpen}
            onOpenChange={setChangeEtapaOpen}
            entityName={pipelineOpportunityFor(selectedContact.id)?.title ?? selectedContact.name}
            currentEtapa={freshContact.etapa}
            onEtapaChange={(newEtapa) => {
              void applyEtapaUpdate(selectedContact.id, newEtapa as Etapa)
                .then(() => {
                  setChangeEtapaOpen(false);
                  toast.success('Etapa actualizada');
                })
                .catch(() => {});
            }}
          />
          <AssignDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            entityName={pipelineOpportunityFor(selectedContact.id)?.title ?? selectedContact.name}
            currentAssigneeId={freshContact.assignedTo}
            onAssignChange={(newAssigneeId) => {
              void applyAssignUpdate(selectedContact.id, newAssigneeId)
                .then(() => {
                  setAssignOpen(false);
                  toast.success('Asesor asignado');
                })
                .catch(() => {});
            }}
          />
        </>
        );
      })()}
    </div>
  );
}
