import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePermissions } from "@/hooks/usePermissions";
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
} from "@dnd-kit/core";
import { useNavigate, Link } from "react-router-dom";
import {
  Filter,
  Kanban,
  List,
  Plus,
  Calendar,
  User,
  Building2,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
} from "lucide-react";
import { toast } from '@/lib/notify';
import type { Contact, Etapa, Opportunity, PipelineColumn } from "@/types";
import {
  etapaLabels,
  activities,
  activityTypeLabels,
} from "@/data/mock";
import { api } from "@/lib/api";
import { fetchCrmConfig } from "@/lib/crmConfigApi";
import type { CrmCatalogDto } from "@/lib/crmConfigApi";
import { useCrmConfigStore, getRubroLabelFromCatalog } from "@/store/crmConfigStore";
import { contactDetailHref, opportunityDetailHref } from "@/lib/detailRoutes";
import { getPrimaryCompany } from "@/lib/utils";
import {
  type ApiContactDetail,
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactUpdate,
  contactListAll,
} from "@/lib/contactApi";
import {
  type ApiOpportunityListRow,
  mapApiOpportunityToOpportunity,
  opportunityUpdate,
} from "@/lib/opportunityApi";
import { useOpportunityCacheStore } from "@/store/opportunityCacheStore";
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from "@/components/shared/NewOpportunityFormDialog";
import { MultiAdvisorFilter } from "@/components/shared/MultiAdvisorFilter";
import { MultiCheckboxFilterActions } from "@/components/shared/MultiCheckboxFilterActions";
import { useMultiAdvisorFilter } from "@/hooks/useMultiAdvisorFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartSquareIcon } from "@/components/icons/ChartSquareIcon";
import { UserHandUpIcon } from "@/components/icons/UserHandUpIcon";
import { ChangeEtapaDialog } from "@/components/shared/ChangeEtapaDialog";
import { AssignDialog } from "@/components/shared/AssignDialog";
import { cn } from "@/lib/utils";
import { comercialProPopoverClass, comercialProCommandClass } from "@/lib/comercialFilterSurface";
import { formatCurrencyShort, formatDateShortLocal } from "@/lib/formatters";
import type { ActivityType } from "@/types";

export type PipelineStageColumnConfig = {
  id: Etapa;
  title: string;
  /** Color de acento (hex) para barras y puntos; inline para que funcione con cualquier valor del catálogo. */
  accentColor: string;
};

/** Orden y colores por defecto si aún no hay catálogo CRM en memoria. */
const FALLBACK_PIPELINE_COLUMNS: PipelineStageColumnConfig[] = [
  { id: "lead", title: "Lead", accentColor: "#64748b" },
  { id: "contacto", title: "Contacto", accentColor: "#3b82f6" },
  { id: "reunion_agendada", title: "Reunión Agendada", accentColor: "#6366f1" },
  { id: "reunion_efectiva", title: "Reunión Efectiva", accentColor: "#06b6d4" },
  {
    id: "propuesta_economica",
    title: "Propuesta Económica",
    accentColor: "#a855f7",
  },
  { id: "negociacion", title: "Negociación", accentColor: "#f97316" },
  { id: "licitacion", title: "Licitación", accentColor: "#f59e0b" },
  {
    id: "licitacion_etapa_final",
    title: "Licitación Etapa Final",
    accentColor: "#d97706",
  },
  { id: "cierre_ganado", title: "Cierre Ganado", accentColor: "#22c55e" },
  { id: "firma_contrato", title: "Firma de Contrato", accentColor: "#16a34a" },
  { id: "activo", title: "Activo", accentColor: "#15803d" },
  { id: "cierre_perdido", title: "Cierre Perdido", accentColor: "#ef4444" },
  { id: "inactivo", title: "Inactivo", accentColor: "#6b7280" },
];

function normalizeHexColor(raw: string, fallback: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t) || /^#[0-9A-Fa-f]{3}$/.test(t)) return t;
  return fallback;
}

function stagesFromCatalog(
  stages: CrmCatalogDto["stages"] | undefined,
): PipelineStageColumnConfig[] {
  if (!stages?.length) return FALLBACK_PIPELINE_COLUMNS;
  const sorted = [...stages]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!sorted.length) return FALLBACK_PIPELINE_COLUMNS;
  return sorted.map((s) => ({
    id: s.slug as Etapa,
    title: s.name,
    accentColor: normalizeHexColor(s.color, "#64748b"),
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
        accentColor: "#94a3b8",
      },
    );
  }
  return [...base, ...tail];
}

function formatEtapaDate(dateStr: string): string {
  return formatDateShortLocal(dateStr);
}

function buildPipelineFromOpportunities(
  allOpps: Opportunity[],
  columnConfigs: PipelineStageColumnConfig[],
): PipelineColumn[] {
  return columnConfigs.map(({ id, title }) => {
    const columnOpps = allOpps.filter((o) => o.etapa === id);
    return {
      id,
      title,
      contacts: [],
      opportunities: columnOpps,
      totalValue: columnOpps.reduce((sum, o) => sum + (o.amount ?? 0), 0),
    };
  });
}

function mergePipelineColumnsFromOpportunities(
  base: PipelineStageColumnConfig[],
  opps: Opportunity[],
): PipelineStageColumnConfig[] {
  const seen = new Set(base.map((c) => c.id));
  const tail: PipelineStageColumnConfig[] = [];
  for (const opp of opps) {
    const e = opp.etapa;
    if (seen.has(e)) continue;
    seen.add(e);
    const fb = FALLBACK_PIPELINE_COLUMNS.find((x) => x.id === e);
    tail.push(
      fb ?? {
        id: e,
        title: etapaLabels[e] ?? e,
        accentColor: "#94a3b8",
      },
    );
  }
  return [...base, ...tail];
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
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date(b + "T00:00:00").getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/** Por encima de esto se virtualiza la columna (menos DOM; drag sigue con overlay + droppable en el scroll). */
const PIPELINE_VIRTUAL_MIN_CARDS = 16;
/** Altura base por fila (px); `measureElement` ajusta con el contenido real. */
const PIPELINE_CARD_ESTIMATE_PX = 150;
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

interface PipelineOppCardProps {
  opportunity: Opportunity;
  accentColor?: string;
  overlay?: boolean;
  onCardClick?: (opportunity: Opportunity) => void;
}

const PipelineOppCard = memo(function PipelineOppCard({
  opportunity,
  accentColor,
  overlay,
  onCardClick,
}: PipelineOppCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity, type: "opportunity" },
  });

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.35 } : undefined}
      className={cn(
        "touch-none cursor-grab select-none active:cursor-grabbing",
        isDragging && "will-change-transform",
      )}
      {...attributes}
      {...listeners}
    >
      <OpportunityCard
        opportunity={opportunity}
        accentColor={accentColor}
        isDragging={isDragging}
        overlay={overlay}
        onCardClick={onCardClick}
      />
    </div>
  );
});

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
    data: { lead, type: "lead" },
  });

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.35 } : undefined}
      className={cn(
        "touch-none cursor-grab select-none active:cursor-grabbing",
        isDragging && "will-change-transform",
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
  const bundle = useCrmConfigStore((s) => s.bundle);
  const opportunity = pipelineOpportunity;
  const company = getPrimaryCompany(lead);
  const title = opportunity?.title ?? lead.name;

  return (
    <div
      className={cn(
        "group relative select-none rounded-[14px] border border-border bg-card p-3.5 text-card-foreground shadow-[0_1px_4px_rgba(15,23,42,0.04)]",
        !overlay && [
          "transition-all duration-150",
          "hover:border-border/80 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5",
        ],
        isDragging && "opacity-40",
        overlay && "pointer-events-none rotate-2 shadow-xl border-primary/40",
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
              {title}
            </span>
          ) : opportunity ? (
            <Link
              to={opportunityDetailHref(opportunity)}
              onClick={(e) => e.stopPropagation()}
              className="block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
            >
              {title}
            </Link>
          ) : onCardClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick(lead);
              }}
              className="block w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
            >
              {title}
            </button>
          ) : (
            <span className="block w-full truncate text-left text-sm font-semibold text-foreground">
              {title}
            </span>
          )}
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground mt-1">
            <Building2 className="size-3 shrink-0" />
            {company?.name ?? "—"}
          </p>
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            <User className="size-3 shrink-0" />
            {lead.name}
          </p>
          {(company?.rubro || company?.tipo) && (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              {company?.rubro && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {getRubroLabelFromCatalog(company.rubro, bundle)}
                </span>
              )}
              {company?.tipo && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Tipo {company.tipo}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-base font-bold text-foreground">
            {formatCurrencyShort(opportunity?.amount ?? lead.estimatedValue)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[13px] text-muted-foreground/60">
          <span className="flex items-center gap-1 truncate">
            <User className="size-3 shrink-0" />
            <span className="truncate">
              {lead.assignedToName.split(" ")[0]}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});

// --- Opportunity Card for Pipeline ---

interface OpportunityCardProps {
  opportunity: Opportunity;
  accentColor?: string;
  isDragging?: boolean;
  overlay?: boolean;
  onCardClick?: (opp: Opportunity) => void;
}

const OpportunityCard = memo(function OpportunityCard({
  opportunity,
  accentColor,
  isDragging,
  overlay,
  onCardClick,
}: OpportunityCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onCardClick) {
      onCardClick(opportunity);
    }
  };

  return (
    <div
      className={cn(
        "relative select-none rounded-[4px] bg-white/40 dark:bg-gray-800/40 p-3 border border-[#d0d5dd]/70 dark:border-gray-600/70",
        !overlay && ["transition-all duration-150", "hover:border-[#d0d5dd] dark:hover:border-gray-600"],
        isDragging && "opacity-40",
        overlay && "pointer-events-none rotate-2 border-primary/40",
      )}
      onClick={onCardClick ? handleCardClick : undefined}
    >
      {accentColor && (
        <div
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ backgroundColor: accentColor }}
        />
      )}
      {onCardClick && !overlay && (
        <button
          type="button"
          className="absolute right-2 top-2 z-[1] rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onCardClick(opportunity);
          }}
          aria-label="Ver detalle del proceso"
        >
          <Info className="size-4" />
        </button>
      )}
      <div className="space-y-2 pr-7">
        <div>
          {overlay ? (
            <span className="block w-full truncate text-left text-[13px] font-semibold text-[#13944C] dark:text-green-400">
              {opportunity.title}
            </span>
          ) : (
            <Link
              to={opportunityDetailHref(opportunity)}
              onClick={(e) => e.stopPropagation()}
              className="block w-full truncate text-left text-[13px] font-semibold text-[#13944C] hover:text-[#0f7a3d] dark:text-green-400 dark:hover:text-green-500"
            >
              {opportunity.title}
            </Link>
          )}
          <p className="text-sm font-bold text-foreground mt-0.5">
            {formatCurrencyShort(opportunity.amount ?? 0)}
          </p>
        </div>

        <div className="border-t border-[#d0d5dd]/60 dark:border-gray-600/60" />

        <div className="space-y-1">
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            <Building2 className="size-3 shrink-0" />
            {opportunity.clientName ?? "—"}
          </p>
          {opportunity.contactName && (
            <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
              <User className="size-3 shrink-0" />
              {opportunity.contactName}
            </p>
          )}
          <div className="inline-flex items-center gap-1 rounded-md border border-[#d0d5dd]/50 dark:border-gray-600/50 bg-white/60 dark:bg-gray-800/60 px-2 py-0.5 text-[13px] text-muted-foreground">
            <UserHandUpIcon className="size-3.5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
            <span className="truncate">
              {(opportunity.assignedToName ?? "").split(" ")[0] || "—"}
            </span>
          </div>
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

  if (!contact && !opportunity) return null;

  const currentEtapa = opportunity?.etapa ?? contact?.etapa;
  const currentIndex = stageColumns.findIndex((c) => c.id === currentEtapa);
  const history = contact?.etapaHistory ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const opportunityId = opportunity?.id ?? contact?.id;
  const recentActivities = activities
    .filter(
      (a) => a.contactId === opportunityId || a.opportunityId === opportunityId,
    )
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
            {opportunity?.title ?? contact?.name ?? ""}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.2fr]">
          {/* Columna izquierda: Progreso en el pipeline */}
          <div className="border-b pb-4 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">
              Progreso en el pipeline
            </p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto sm:max-h-[calc(90vh-10rem)]">
              {stageColumns.map((col, idx) => {
                const isCurrent = col.id === currentEtapa;
                const isPast = currentIndex >= 0 && idx < currentIndex;
                const etapaEntry = history.find(
                  (e) => (e as { etapa: string }).etapa === col.id,
                );
                const nextEntry =
                  history[
                    history.findIndex(
                      (e) => (e as { etapa: string }).etapa === col.id,
                    ) + 1
                  ];
                const fecha = etapaEntry
                  ? formatEtapaDate(etapaEntry.fecha)
                  : isPast || isCurrent
                    ? "—"
                    : "Pendiente";
                const dias =
                  etapaEntry && nextEntry
                    ? daysBetween(etapaEntry.fecha, nextEntry.fecha)
                    : etapaEntry && isCurrent
                      ? daysBetween(etapaEntry.fecha, today)
                      : null;
                const diasLabel =
                  dias !== null
                    ? dias === 0
                      ? "<1 día"
                      : dias === 1
                        ? "1 día"
                        : `${dias} días`
                    : null;
                return (
                  <div
                    key={col.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px]",
                      isCurrent && "bg-primary/10 font-medium text-primary",
                      isPast && "text-muted-foreground",
                      !isCurrent && !isPast && "text-muted-foreground/70",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full",
                          isPast && "bg-primary/20 text-primary",
                          !isPast && !isCurrent && "bg-muted",
                        )}
                        style={
                          isCurrent
                            ? { backgroundColor: col.accentColor }
                            : undefined
                        }
                      >
                        {isPast ? (
                          <Check className="size-3" />
                        ) : isCurrent ? (
                          <span className="size-2 rounded-full bg-background" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current opacity-50" />
                        )}
                      </div>
                      {isCurrent && (
                        <ChevronRight className="size-3.5 shrink-0" />
                      )}
                      <span className={cn(isCurrent && "font-semibold")}>
                        {col.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "tabular-nums",
                          !isPast && !isCurrent && "text-muted-foreground/60",
                        )}
                      >
                        {fecha}
                      </span>
                      {diasLabel && (isPast || isCurrent) && (
                        <span className="text-[10px] text-muted-foreground/80">
                          {diasLabel}
                        </span>
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
                {opportunity?.clientName ?? company?.name ?? "—"}
              </p>
              <p className="flex items-center gap-1.5">
                <User className="size-3.5 shrink-0" />
                {opportunity?.contactName ?? contact?.name ?? "—"}
              </p>
            </div>

            {recentActivities.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted-foreground">
                  Actividades recientes
                </p>
                <div className="space-y-1.5">
                  {recentActivities.map((act) => {
                    const Icon =
                      activityTypeIconMap[act.type as ActivityType] ?? Phone;
                    return (
                      <div
                        key={act.id}
                        className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-[13px]"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{act.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {activityTypeLabels[act.type] ?? act.type} ·{" "}
                            {formatEtapaDate(act.completedAt ?? act.dueDate)}
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
                <p className="text-sm font-semibold">
                  {formatCurrencyShort(
                    opportunity?.amount ?? contact?.estimatedValue ?? 0,
                  )}
                </p>
              </div>
              {opportunity && (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Probabilidad
                    </p>
                    <p className="text-sm font-medium">
                      {opportunity.probability}%
                    </p>
                  </div>
                  {opportunity.expectedCloseDate && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Cierre esperado
                      </p>
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
                <p className="text-sm">
                  {opportunity?.assignedToName ??
                    contact?.assignedToName ??
                    "—"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onOpenChangeEtapa}
              >
                <RefreshCw className="mr-1 size-3.5" />
                Cambiar etapa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onOpenAssign}
              >
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
                } else if (contact) {
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
  onCardClick?: (opp: Opportunity) => void;
  pipelineOpportunityFor?: (contactId: string) => Opportunity | undefined;
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
function PipelineKanbanSkeleton({
  columns,
}: {
  columns: PipelineStageColumnConfig[];
}) {
  return (
    <div
      className="scrollbar-thin scrollbar-rounded -mx-3 flex h-[calc(100dvh-11rem)] min-h-[36rem] w-full max-w-full min-w-0 gap-4 overflow-x-auto overflow-y-hidden px-3 pb-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando datos del pipeline"
    >
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex h-full min-h-0 min-w-[300px] flex-1 flex-col"
        >
          <div
            className="h-1.5 rounded-t-[16px] opacity-70"
            style={{ backgroundColor: col.accentColor }}
          />
          <div className="flex items-center justify-between gap-3 rounded-t-none border-x border-t border-border bg-[var(--pipeline-kanban-column-header)] px-4 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Skeleton className="h-5 max-w-[9rem] flex-1" />
              <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-4 w-[4.5rem] shrink-0" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-b-[16px] border-x border-b border-border bg-muted/30 p-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-32 w-full shrink-0 rounded-[14px] bg-white dark:bg-gray-900"
              />
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
  const [collapsed, setCollapsed] = useState(false);

  const setScrollAndDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const contacts = column.contacts ?? [];
  const opportunities = column.opportunities ?? [];
  const items = opportunities.length > 0 ? opportunities : contacts;
  const useVirtual = items.length >= PIPELINE_VIRTUAL_MIN_CARDS;

  const virtualizer = useVirtualizer({
    count: useVirtual ? items.length : 0,
    enabled: useVirtual,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PIPELINE_CARD_ESTIMATE_PX,
    gap: PIPELINE_CARD_GAP_PX,
    overscan: 8,
  });

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[16px] border border-border/30 bg-white/20 dark:bg-gray-950/40 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-all duration-200",
        collapsed ? "w-14" : "min-w-[300px] flex-1",
      )}
    >
      <div
        className={cn(
          "cursor-pointer select-none",
          collapsed
            ? "flex flex-col items-center gap-2 px-2 py-3"
            : "flex items-center justify-between gap-2 px-3 py-2.5",
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <>
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-[13px] font-bold text-muted-foreground tabular-nums [writing-mode:vertical-lr] tracking-widest">
              {column.title}
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground tabular-nums">
              {items.length}
            </span>
            <ChevronLeft className="size-4 text-muted-foreground" />
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                {column.title}
              </h3>
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
                {formatCurrencyShort(column.totalValue)}
              </span>
              <ChevronLeft className="size-4 text-muted-foreground" />
            </div>
          </>
        )}
      </div>

      {!collapsed && <div className="border-t border-[#d0d5dd]/60 dark:border-gray-600/60 mx-3 mb-2" />}

      {!collapsed && (
        <div
          ref={setScrollAndDropRef}
          className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-[16px] px-2 pb-2 pt-0.5"
        >
          {showDropPlaceholder && <ColumnDropSlot accentColor={accentColor} />}

          {items.length === 0 && !showDropPlaceholder ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/30 py-8 text-[13px] text-muted-foreground">
              Sin oportunidades
            </div>
          ) : opportunities.length > 0 ? (
            useVirtual ? (
              <div
                className="relative w-full"
                style={{ height: virtualizer.getTotalSize() }}
              >
                {virtualizer.getVirtualItems().map((v) => {
                  const opp = opportunities[v.index];
                  if (!opp) return null;
                  return (
                    <div
                      key={opp.id}
                      data-index={v.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${v.start}px)` }}
                    >
                      <PipelineOppCard
                        opportunity={opp}
                        accentColor={accentColor}
                        onCardClick={
                          onCardClick as unknown as (opp: Opportunity) => void
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              opportunities.map((opp) => (
                <PipelineOppCard
                  key={opp.id}
                  opportunity={opp}
                  accentColor={accentColor}
                  onCardClick={
                    onCardClick as unknown as (opp: Opportunity) => void
                  }
                />
              ))
            )
          ) : useVirtual ? (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
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
                      onCardClick={
                        onCardClick as unknown as (contact: Contact) => void
                      }
                      pipelineOpportunity={pipelineOpportunityFor?.(contact.id)}
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
                onCardClick={
                  onCardClick as unknown as (contact: Contact) => void
                }
                pipelineOpportunity={pipelineOpportunityFor?.(contact.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

// --- Pipeline Page ---

interface PipelineFilters {
  etapas: Etapa[];
}

const emptyFilters: PipelineFilters = { etapas: [] };

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
function buildOpportunityByContactId(
  rows: ApiOpportunityListRow[],
): Map<string, Opportunity> {
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
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    matchesAssignee,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const setBundle = useCrmConfigStore((s) => s.setBundle);

  useEffect(() => {
    if (bundle) return;
    let cancelled = false;
    void fetchCrmConfig()
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setBundle, bundle]);

  const [apiRows, setApiRows] = useState<ApiContactListRow[]>([]);
  const [oppsApiRows, setOppsApiRows] = useState<ApiOpportunityListRow[]>([]);
  /** Solo la primera carga: refetch tras crear oportunidad no vuelve a tapar el tablero. */
  const [initialPipelineLoad, setInitialPipelineLoad] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<Etapa | null>(
    null,
  );

  useEffect(() => {
    if (!useOpportunityCacheStore.getState().isStale()) {
      setOppsApiRows(useOpportunityCacheStore.getState().opportunities);
      setInitialPipelineLoad(false);
      return;
    }
    useOpportunityCacheStore
      .getState()
      .load()
      .then((list) => {
        setOppsApiRows(list);
      })
      .finally(() => {
        setInitialPipelineLoad(false);
      });
  }, []);

  const reloadFromCache = useCallback(async () => {
    const list = await useOpportunityCacheStore.getState().load();
    setOppsApiRows(list);
  }, []);

  const opportunityByContactId = useMemo(
    () => buildOpportunityByContactId(oppsApiRows),
    [oppsApiRows],
  );

  const pipelineOpportunityFor = useCallback(
    (contactId: string) => opportunityByContactId.get(contactId),
    [opportunityByContactId],
  );

  const allOpportunities = useMemo(
    () => oppsApiRows.map(mapApiOpportunityToOpportunity),
    [oppsApiRows],
  );

  const catalogStageColumns = useMemo(
    () => stagesFromCatalog(bundle?.catalog.stages),
    [bundle?.catalog.stages],
  );

  const displayColumns = useMemo(() => {
    const oppsOnly = mergePipelineColumnsFromOpportunities(
      catalogStageColumns,
      allOpportunities,
    );
    return oppsOnly;
  }, [catalogStageColumns, allOpportunities]);

  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);

  async function handleCreateOpportunityFromPipeline(
    data: NewOpportunityFormValues,
  ) {
    const body = buildOpportunityCreateBody(data);
    try {
      await api("/opportunities", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await reloadFromCache();
      toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo crear la oportunidad",
      );
      throw e;
    }
  }
  const [filters, setFilters] = useState<PipelineFilters>(emptyFilters);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [changeEtapaOpen, setChangeEtapaOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function applyOppEtapaUpdate(
    oppId: string,
    etapa: Etapa,
  ): Promise<void> {
    let previousEtapa: string | undefined;
    let hadRow = false;
    setOppsApiRows((prev) => {
      const cur = prev.find((r) => r.id === oppId);
      if (!cur) return prev;
      hadRow = true;
      previousEtapa = cur.etapa;
      return prev.map((r) => (r.id === oppId ? { ...r, etapa } : r));
    });

    try {
      const updated = await opportunityUpdate(oppId, { etapa });
      setOppsApiRows((prev) => {
        const idx = prev.findIndex((r) => r.id === oppId);
        if (idx === -1) {
          void reloadFromCache();
          return prev;
        }
        return prev.map((r, i) =>
          i === idx ? { ...r, etapa: updated.etapa } : r,
        );
      });
    } catch (e) {
      if (hadRow && previousEtapa !== undefined) {
        setOppsApiRows((prev) =>
          prev.map((r) =>
            r.id === oppId ? { ...r, etapa: previousEtapa! } : r,
          ),
        );
      }
      toast.error(e instanceof Error ? e.message : "Error al actualizar etapa");
      throw e;
    }
  }

  async function applyOppAssignUpdate(
    oppId: string,
    assignedTo: string,
  ): Promise<void> {
    let previousAssigned: string | undefined;
    let hadRow = false;
    setOppsApiRows((prev) => {
      const cur = prev.find((r) => r.id === oppId);
      if (!cur) return prev;
      hadRow = true;
      previousAssigned = cur.assignedTo ?? undefined;
      return prev.map((r) =>
        r.id === oppId
          ? { ...r, assignedTo: assignedTo || null, user: null }
          : r,
      );
    });

    try {
      await opportunityUpdate(oppId, { assignedTo });
    } catch (e) {
      if (hadRow && previousAssigned !== undefined) {
        setOppsApiRows((prev) =>
          prev.map((r) =>
            r.id === oppId ? { ...r, assignedTo: previousAssigned } : r,
          ),
        );
      }
      toast.error(e instanceof Error ? e.message : "Error al asignar");
      throw e;
    }
  }

  async function applyEtapaUpdate(
    contactId: string,
    etapa: Etapa,
  ): Promise<void> {
    if (!isLikelyContactCuid(contactId)) {
      toast.error("Solo se puede actualizar la etapa de contactos guardados");
      throw new Error("INVALID_CONTACT_ID");
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
          void reloadFromCache();
          return prev;
        }
        return prev.map((r, i) =>
          i === idx ? mergeListRowFromContactDetail(r, updated) : r,
        );
      });
    } catch (e) {
      if (hadRow && previousEtapa !== undefined) {
        setApiRows((prev) =>
          prev.map((r) =>
            r.id === contactId ? { ...r, etapa: previousEtapa! } : r,
          ),
        );
      }
      toast.error(e instanceof Error ? e.message : "Error al actualizar etapa");
      throw e;
    }
  }

  async function applyAssignUpdate(
    contactId: string,
    assignedTo: string,
  ): Promise<void> {
    if (!isLikelyContactCuid(contactId)) {
      toast.error("Solo se puede asignar contactos guardados");
      throw new Error("INVALID_CONTACT_ID");
    }

    let previousAssigned: string | null | undefined;
    let previousUser: ApiContactListRow["user"];
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
          void reloadFromCache();
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
      toast.error(e instanceof Error ? e.message : "Error al asignar");
      throw e;
    }
  }

  const activeFilterCount =
    (advisorFilterIsActive ? 1 : 0) + (filters.etapas.length > 0 ? 1 : 0);

  const filteredOpportunities = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allOpportunities.filter((o) => {
      if (
        term &&
        !o.title.toLowerCase().includes(term) &&
        !o.clientName?.toLowerCase().includes(term) &&
        !o.contactName?.toLowerCase().includes(term)
      )
        return false;
      if (!matchesAssignee(o.assignedTo)) return false;
      if (filters.etapas.length > 0 && !filters.etapas.includes(o.etapa))
        return false;
      return true;
    });
  }, [allOpportunities, filters.etapas, searchTerm, matchesAssignee]);

  const pipeline = useMemo(() => {
    const all = buildPipelineFromOpportunities(
      filteredOpportunities,
      displayColumns,
    );
    if (filters.etapas.length > 0)
      return all.filter((col) => filters.etapas.includes(col.id));
    return all;
  }, [filteredOpportunities, filters.etapas, displayColumns]);

  const activeOpp = useMemo(
    () =>
      activeId ? allOpportunities.find((o) => o.id === activeId) : undefined,
    [activeId, allOpportunities],
  );

  const totalPipelineValue = useMemo(
    () => filteredOpportunities.reduce((sum, o) => sum + (o.amount ?? 0), 0),
    [filteredOpportunities],
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

  const handlePipelineCardClick = useCallback((o: Opportunity) => {
    setSelectedOpp(o);
  }, []);

  function findColumnByOppId(oppId: string): Etapa | undefined {
    const opp = allOpportunities.find((o) => o.id === oppId);
    return opp?.etapa;
  }

  function resolveOverColumn(overId: string): Etapa | undefined {
    if (displayColumns.some((c) => c.id === overId)) {
      return overId as Etapa;
    }
    return findColumnByOppId(overId);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveId(id);
    setDropTargetColumnId(findColumnByOppId(id) ?? null);
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
    const activeOppId = active.id as string;
    clearDragUi();
    if (!over) return;

    const overId = over.id as string;

    const overColumn = resolveOverColumn(overId);

    if (!overColumn) return;

    const fromColumn = findColumnByOppId(activeOppId);
    if (fromColumn === overColumn) return;

    void applyOppEtapaUpdate(activeOppId, overColumn);
  }

  function handleDragCancel() {
    clearDragUi();
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative w-full min-w-0 max-w-[400px]">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!h-11 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-10 text-[15px] text-black placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
          />
        </div>

        {/* Etapa */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`!h-11 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate ${filters.etapas.length > 0 ? "text-black dark:text-gray-100" : "text-[#8a9aab] dark:text-gray-400"}`}
            >
              <ChartSquareIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
              <span className="truncate flex-1">
                {filters.etapas.length === 0
                  ? "Etapa"
                  : filters.etapas
                      .map(
                        (k) => etapaLabels[k as keyof typeof etapaLabels] || k,
                      )
                      .join(", ")}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className={cn(comercialProPopoverClass, "w-[220px] p-1.5")} align="start" sideOffset={8}>
            <Command className={comercialProCommandClass}>
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandGroup>
                  {displayColumns.map((col) => {
                    const selected = filters.etapas.includes(col.id);
                    return (
                      <CommandItem
                        key={col.id}
                        onSelect={() => {
                          setFilters((f) => ({
                            ...f,
                            etapas: selected
                              ? f.etapas.filter((e) => e !== col.id)
                              : [...f.etapas, col.id],
                          }));
                        }}
                      >
                        <span className="[&_svg]:!text-primary-foreground">
                          <Checkbox
                            checked={selected}
                            className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                          />
                        </span>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: col.accentColor }}
                        />
                        <span>{col.title}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              <MultiCheckboxFilterActions
                allSelected={
                  displayColumns.length > 0 &&
                  displayColumns.every((col) => filters.etapas.includes(col.id))
                }
                noneSelected={filters.etapas.length === 0}
                onSelectAll={() => {
                  setFilters((f) => ({
                    ...f,
                    etapas: displayColumns.map((col) => col.id),
                  }));
                }}
                onClear={() => {
                  setFilters((f) => ({ ...f, etapas: [] }));
                }}
              />
            </Command>
          </PopoverContent>
        </Popover>

        {/* Asesor */}
        <MultiAdvisorFilter
          value={advisorFilter}
          onChange={setAdvisorFilter}
          advisors={activeAdvisors}
          disabled={!canSeeAllAdvisors}
          isActive={advisorFilterIsActive}
          isInitialized={advisorFilterInitialized}
          className="!h-11 w-[190px]"
        />

        {/* Limpiar */}
        {(activeFilterCount > 0 || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setFilters(emptyFilters);
              resetAdvisorFilter();
            }}
          >
            <X className="size-4" /> Limpiar
          </Button>
        )}

        {/* Toggle + Nueva */}
        <div className="ml-auto hidden sm:flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {initialPipelineLoad ? (
              <Skeleton className="inline-block h-4 w-[7.5rem] align-middle" />
            ) : (
              <span className="text-foreground">
                {formatCurrencyShort(totalPipelineValue)}
              </span>
            )}
          </span>
          <div className="flex items-center rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-0.5">
            <button
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[#647789] dark:text-gray-400 hover:text-[#1f2933] dark:hover:text-gray-100 transition-colors cursor-pointer"
              onClick={() => navigate("/opportunities")}
            >
              Lista
            </button>
            <button className="rounded-md px-3 py-1.5 text-sm font-medium bg-[#e8f5e9] dark:bg-green-900/30 text-[#13944C] dark:text-green-400">
              Pipeline
            </button>
          </div>
          <Button
            onClick={() => setNewOpportunityOpen(true)}
            className="h-9 w-[110px] text-sm font-normal shadow-md"
          >
            <Plus /> Nueva
          </Button>
        </div>
      </div>

      <div className="min-h-0">
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
            <div className="scrollbar-thin scrollbar-rounded -mx-3 flex h-[calc(100dvh-11rem)] min-h-[36rem] w-full max-w-full min-w-0 gap-4 overflow-x-auto overflow-y-hidden px-3 pb-4">
              {pipeline.map((column) => {
                const colConfig = displayColumns.find(
                  (c) => c.id === column.id,
                )!;
                const sourceCol = activeId
                  ? findColumnByOppId(activeId)
                  : undefined;
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
                    onCardClick={
                      handlePipelineCardClick as unknown as (
                        opp: Opportunity,
                      ) => void
                    }
                    showDropPlaceholder={showSlot}
                  />
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeOpp ? (
                <div className="w-[280px]">
                  <OpportunityCard opportunity={activeOpp} isDragging overlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <NewOpportunityFormDialog
        open={newOpportunityOpen}
        onOpenChange={setNewOpportunityOpen}
        title="Nueva Oportunidad"
        description="Registra una oportunidad en el pipeline. Vincula contacto y empresa ya existentes; no se crean desde aquí."
        onCreate={handleCreateOpportunityFromPipeline}
      />

      <CardDetailDialog
        contact={null}
        pipelineOpportunity={selectedOpp ?? undefined}
        open={!!selectedOpp}
        onOpenChange={(open) => !open && setSelectedOpp(null)}
        onOpenChangeEtapa={() => setChangeEtapaOpen(true)}
        onOpenAssign={() => setAssignOpen(true)}
        stageColumns={displayColumns}
      />

      {selectedOpp &&
        (() => {
          const freshOpp = selectedOpp;
          return (
            <>
              <ChangeEtapaDialog
                open={changeEtapaOpen}
                onOpenChange={setChangeEtapaOpen}
                entityName={freshOpp.title}
                currentEtapa={freshOpp.etapa}
                onEtapaChange={(newEtapa) => {
                  void applyOppEtapaUpdate(freshOpp.id, newEtapa as Etapa)
                    .then(() => {
                      setChangeEtapaOpen(false);
                      toast.success("Etapa actualizada");
                    })
                    .catch(() => {});
                }}
              />
              <AssignDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                entityName={freshOpp.title}
                currentAssigneeId={freshOpp.assignedTo ?? ""}
                onAssignChange={(newAssigneeId) => {
                  void applyOppAssignUpdate(freshOpp.id, newAssigneeId)
                    .then(() => {
                      setAssignOpen(false);
                      toast.success("Asesor asignado");
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
