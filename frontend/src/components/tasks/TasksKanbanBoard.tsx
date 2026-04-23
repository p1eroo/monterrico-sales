import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Calendar,
  CheckSquare,
  CircleDot,
  Flag,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  User,
  Users,
} from 'lucide-react';
import type { Activity, ActivityStatus, ActivityType, ContactPriority, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import { priorityLabels } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';

const activityIcons: Record<ActivityType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  whatsapp: MessageCircle,
};

const KANBAN_STATUS_ORDER: ActivityStatus[] = [
  'pendiente',
  'en_progreso',
  'vencida',
  'completada',
];

const columnTheme: Record<
  ActivityStatus,
  { accent: string; headerBg: string; badgeClass: string }
> = {
  pendiente: {
    accent: '#f59e0b',
    headerBg: 'bg-amber-50/90 dark:bg-amber-950/35',
    badgeClass:
      'border-amber-200/80 bg-amber-100/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-100',
  },
  en_progreso: {
    accent: '#3b82f6',
    headerBg: 'bg-blue-50/90 dark:bg-blue-950/35',
    badgeClass:
      'border-blue-200/80 bg-blue-100/90 text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/60 dark:text-blue-100',
  },
  vencida: {
    accent: '#ef4444',
    headerBg: 'bg-red-50/90 dark:bg-red-950/35',
    badgeClass:
      'border-red-200/80 bg-red-100/90 text-red-900 dark:border-red-800/50 dark:bg-red-950/60 dark:text-red-100',
  },
  completada: {
    accent: '#13944C',
    headerBg: 'bg-emerald-50/90 dark:bg-emerald-950/30',
    badgeClass:
      'border-emerald-200/80 bg-emerald-100/90 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100',
  },
};

const statusLabelUpper: Record<ActivityStatus, string> = {
  pendiente: 'PENDIENTE',
  en_progreso: 'EN PROGRESO',
  vencida: 'VENCIDA',
  completada: 'COMPLETADA',
};

const taskKindAriaLabel: Record<TaskKind, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

/** Solo empresa u oportunidad bajo el título (evita “contacto · contacto”). */
function kanbanCompanySubtitle(a: Activity): string | undefined {
  const raw = a.contactName?.trim();
  if (raw?.includes(' - ')) {
    const rest = raw.split(' - ').slice(1).join(' - ').trim();
    return rest || undefined;
  }
  if (a.companyId && !a.contactId && raw) return raw;
  if (a.opportunityTitle?.trim()) return a.opportunityTitle.trim();
  return undefined;
}

function priorityFlagClass(p: ContactPriority): string {
  if (p === 'alta') return 'text-red-600 dark:text-red-400';
  if (p === 'media') return 'text-blue-600 dark:text-blue-400';
  return 'text-muted-foreground';
}

export type TasksKanbanBoardProps = {
  tasks: Activity[];
  loading?: boolean;
  onTaskClick: (task: Activity) => void;
  onAddTask: (defaultStatus?: ActivityStatus) => void;
  onStatusChange: (taskId: string, next: ActivityStatus) => Promise<void>;
  onCompleteToggle: (taskId: string) => void;
  onReschedule: (taskId: string) => void;
  onEdit: (task: Activity) => void;
  onDelete: (taskId: string) => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
  isOverdue: (dueDate: string, status: ActivityStatus) => boolean;
};

function useTasksKanbanCollision(columnIds: Set<string>): CollisionDetection {
  return useCallback(
    (args) =>
      closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          columnIds.has(String(c.id)),
        ),
      }),
    [columnIds],
  );
}

const TaskKanbanCard = memo(function TaskKanbanCard({
  task,
  overlay,
  onCardClick,
  formatDueDate,
  isOverdue,
  onCompleteToggle,
  onReschedule,
  onEdit,
  onDelete,
}: {
  task: Activity;
  overlay?: boolean;
  onCardClick: () => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
  isOverdue: (dueDate: string, status: ActivityStatus) => boolean;
  onCompleteToggle: () => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind: TaskKind =
    task.taskKind && TASK_KINDS.includes(task.taskKind) ? task.taskKind : 'llamada';
  const TypeIcon = activityIcons[kind];
  const circle = activityTypeIconCircleClass(kind);
  const overdue = isOverdue(task.dueDate, task.status);
  const priority: ContactPriority = task.priority ?? 'media';
  const companySubtitle = kanbanCompanySubtitle(task);

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-sm',
        !overlay && 'transition-[box-shadow,border-color] duration-150 hover:border-primary/25 hover:shadow-md',
        overlay && 'pointer-events-none rotate-1 cursor-grabbing shadow-xl ring-2 ring-primary/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCardClick();
          }}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <div
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
              ACTIVITY_ICON_INHERIT,
              circle ?? 'bg-muted text-muted-foreground [&_svg]:size-3.5',
            )}
            role="img"
            aria-label={taskKindAriaLabel[kind]}
          >
            <TypeIcon className="size-3.5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug text-foreground" title={task.title}>
              {task.title}
            </p>
            {companySubtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={companySubtitle}>
                {companySubtitle}
              </p>
            ) : null}
          </div>
        </button>
        {!overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {task.status !== 'completada' && (
                <DropdownMenuItem onClick={onCompleteToggle}>Completar</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onReschedule}>Reprogramar</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2.5 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{task.assignedToName || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className={cn('truncate', overdue && 'font-medium text-red-600 dark:text-red-400')}>
            {formatDueDate(task.dueDate, task.startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Flag className={cn('size-3.5 shrink-0', priorityFlagClass(priority))} aria-hidden />
          <span className={cn('font-medium', priorityFlagClass(priority))}>
            {priorityLabels[priority]}
          </span>
        </div>
      </div>
    </div>
  );
});

const DraggableTaskCard = memo(function DraggableTaskCard({
  task,
  onCardClick,
  formatDueDate,
  isOverdue,
  onCompleteToggle,
  onReschedule,
  onEdit,
  onDelete,
}: {
  task: Activity;
  onCardClick: () => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
  isOverdue: (dueDate: string, status: ActivityStatus) => boolean;
  onCompleteToggle: () => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.4 } : undefined}
      className={cn(
        'touch-none cursor-grab select-none active:cursor-grabbing',
        isDragging && 'will-change-transform',
      )}
      {...attributes}
      {...listeners}
    >
      <TaskKanbanCard
        task={task}
        onCardClick={onCardClick}
        formatDueDate={formatDueDate}
        isOverdue={isOverdue}
        onCompleteToggle={onCompleteToggle}
        onReschedule={onReschedule}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
});

const KanbanColumnShell = memo(function KanbanColumnShell({
  status,
  count,
  children,
  onAddTask,
  showDropHint,
}: {
  status: ActivityStatus;
  count: number;
  children: ReactNode;
  onAddTask: () => void;
  showDropHint: boolean;
}) {
  const theme = columnTheme[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-full min-h-0 min-w-[10.5rem] max-w-full flex-1 basis-0 flex-col">
      <div className="h-1 shrink-0 rounded-t-xl" style={{ backgroundColor: theme.accent }} />
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-x border-t border-border/80 px-3 py-2.5 backdrop-blur-sm',
          theme.headerBg,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              theme.badgeClass,
            )}
          >
            <CircleDot className="size-3 opacity-80" aria-hidden />
            <span className="max-w-[9rem] truncate">{statusLabelUpper[status]}</span>
          </Badge>
          <span className="tabular-nums text-sm font-bold text-foreground">{count}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
          aria-label={`Nueva tarea en ${statusLabelUpper[status]}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-b-xl border-x border-b border-border/80 bg-muted/25 p-2 [-webkit-overflow-scrolling:touch] dark:bg-muted/15',
          (isOver || showDropHint) && 'ring-2 ring-inset ring-primary/35',
        )}
      >
        {children}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-9 shrink-0 justify-start gap-2 rounded-lg border border-dashed border-border/80 text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground"
        onClick={onAddTask}
      >
        <Plus className="size-4" />
        Añadir tarea
      </Button>
    </div>
  );
});

export const TasksKanbanBoard = memo(function TasksKanbanBoard({
  tasks,
  loading,
  onTaskClick,
  onAddTask,
  onStatusChange,
  onCompleteToggle,
  onReschedule,
  onEdit,
  onDelete,
  formatDueDate,
  isOverdue,
}: TasksKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ActivityStatus | null>(null);

  const columnIds = useMemo(() => new Set(KANBAN_STATUS_ORDER.map(String)), []);

  const collisionDetection = useTasksKanbanCollision(columnIds);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const tasksByStatus = useMemo(() => {
    const map = new Map<ActivityStatus, Activity[]>();
    for (const s of KANBAN_STATUS_ORDER) {
      map.set(s, []);
    }
    for (const t of tasks) {
      const list = map.get(t.status);
      if (list) list.push(t);
    }
    return map;
  }, [tasks]);

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) ?? null : null),
    [activeId, tasks],
  );

  const sourceStatus = activeTask?.status ?? null;

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    const task = e.active.data.current?.task as Activity | undefined;
    setDropTarget(task?.status ?? null);
  }, []);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const { over } = e;
    if (!over) {
      setDropTarget(null);
      return;
    }
    const id = String(over.id);
    if (KANBAN_STATUS_ORDER.includes(id as ActivityStatus)) {
      setDropTarget(id as ActivityStatus);
    }
  }, []);

  const clearDrag = useCallback(() => {
    setActiveId(null);
    setDropTarget(null);
  }, []);

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      clearDrag();
      if (!over) return;
      const overId = String(over.id) as ActivityStatus;
      if (!KANBAN_STATUS_ORDER.includes(overId)) return;
      const taskId = String(active.id);
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === overId) return;
      await onStatusChange(taskId, overId);
    },
    [clearDrag, onStatusChange, tasks],
  );

  const handleDragCancel = useCallback(() => {
    clearDrag();
  }, [clearDrag]);

  if (loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
        Cargando tablero…
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={{ threshold: { x: 0.18, y: 0.12 } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2">
        <div
          className={cn(
            'scrollbar-thin flex h-[min(calc(100dvh-15rem),72rem)] min-h-[22rem] w-full min-w-0 flex-row gap-3',
            'overflow-x-auto overflow-y-hidden overscroll-x-contain',
            'items-stretch pb-2 pt-0.5 [-webkit-overflow-scrolling:touch]',
          )}
        >
          {KANBAN_STATUS_ORDER.map((status) => {
            const columnTasks = tasksByStatus.get(status) ?? [];
            const showHint =
              Boolean(activeId) &&
              dropTarget === status &&
              sourceStatus !== null &&
              sourceStatus !== status;

            return (
              <KanbanColumnShell
                key={status}
                status={status}
                count={columnTasks.length}
                onAddTask={() => onAddTask(status)}
                showDropHint={showHint}
              >
                {columnTasks.length === 0 ? (
                  showHint ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 py-10 text-xs font-medium text-primary">
                      Soltar aquí
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 py-10 text-center text-xs text-muted-foreground">
                      Sin tareas
                    </div>
                  )
                ) : (
                  columnTasks.map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onCardClick={() => onTaskClick(task)}
                      formatDueDate={formatDueDate}
                      isOverdue={isOverdue}
                      onCompleteToggle={() => onCompleteToggle(task.id)}
                      onReschedule={() => onReschedule(task.id)}
                      onEdit={() => onEdit(task)}
                      onDelete={() => onDelete(task.id)}
                    />
                  ))
                )}
              </KanbanColumnShell>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[min(92vw,20rem)]">
            <TaskKanbanCard
              task={activeTask}
              overlay
              onCardClick={() => {}}
              formatDueDate={formatDueDate}
              isOverdue={isOverdue}
              onCompleteToggle={() => {}}
              onReschedule={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
