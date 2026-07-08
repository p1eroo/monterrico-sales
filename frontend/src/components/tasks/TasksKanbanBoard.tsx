import { memo, useCallback, useMemo, useState, type ReactNode, type ComponentType } from 'react';
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
  Building2,
  Calendar,
  CheckSquare,
  MoreHorizontal,
  Plus,
  Target,
  UserCircle,
} from 'lucide-react';
import type { Activity, ActivityStatus, ActivityType, ContactPriority, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import { UserHandUpIcon } from '@/components/icons/UserHandUpIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { ReunionSvgIcon } from '@/components/icons/ReunionSvgIcon';
import { CorreoSvgIcon } from '@/components/icons/CorreoSvgIcon';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';
import { PrioritySvgIcon } from '@/components/icons/PrioritySvgIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  llamada: LlamadaSvgIcon,
  reunion: ReunionSvgIcon,
  tarea: CheckSquare,
  correo: CorreoSvgIcon,
  whatsapp: WhatsAppSvgIcon,
};

const KANBAN_STATUS_ORDER: ActivityStatus[] = [
  'pendiente',
  'en_progreso',
  'vencida',
  'completada',
];

const columnTheme: Record<
  ActivityStatus,
  { headerBg: string; textColor: string; countBg: string; countText: string }
> = {
  pendiente: {
    headerBg: 'bg-amber-50/90 dark:bg-amber-950/35',
    textColor: 'text-amber-700 dark:text-amber-300',
    countBg: 'bg-amber-100 dark:bg-amber-900/40',
    countText: 'text-amber-900 dark:text-amber-100',
  },
  en_progreso: {
    headerBg: 'bg-blue-50/90 dark:bg-blue-950/35',
    textColor: 'text-blue-700 dark:text-blue-300',
    countBg: 'bg-blue-100 dark:bg-blue-900/40',
    countText: 'text-blue-900 dark:text-blue-100',
  },
  vencida: {
    headerBg: 'bg-red-50/90 dark:bg-red-950/35',
    textColor: 'text-red-700 dark:text-red-300',
    countBg: 'bg-red-100 dark:bg-red-900/40',
    countText: 'text-red-900 dark:text-red-100',
  },
  completada: {
    headerBg: 'bg-emerald-50/90 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    countBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    countText: 'text-emerald-900 dark:text-emerald-100',
  },
};

const statusLabel: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  vencida: 'Vencida',
  completada: 'Completada',
};


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
  onStatusChange: (taskId: string, next: ActivityStatus) => void | Promise<void>;
  onCompleteToggle: (taskId: string) => void;
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
  onEdit,
  onDelete,
}: {
  task: Activity;
  overlay?: boolean;
  onCardClick: () => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
  isOverdue: (dueDate: string, status: ActivityStatus) => boolean;
  onCompleteToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind: TaskKind =
    task.taskKind && TASK_KINDS.includes(task.taskKind) ? task.taskKind : 'llamada';
  const TypeIcon = activityIcons[kind];
  const overdue = isOverdue(task.dueDate, task.status);
  const priority: ContactPriority = task.priority ?? 'media';

  const hasContact = task.contactId && task.contactName?.trim();
  const hasCompany = task.companyId && task.companyName?.trim();
  const hasOpportunity = task.opportunityId && task.opportunityTitle?.trim();

  return (
    <div
      className={cn(
        'relative rounded-xl bg-white dark:bg-gray-800 p-2.5',
        overlay && 'pointer-events-none rotate-1 cursor-grabbing ring-2 ring-primary/20',
      )}
    >
      <PrioritySvgIcon className={cn('absolute right-2 top-2 size-4', priorityFlagClass(priority))} />
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCardClick();
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left pr-7"
        >
          <TypeIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          <span className="block w-full truncate text-sm text-foreground">{task.title}</span>
        </button>
        {!overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="absolute right-2 bottom-2 z-[1] size-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {task.status !== 'completada' && (
                <DropdownMenuItem onClick={onCompleteToggle}>Completar</DropdownMenuItem>
              )}
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
          <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className={cn('truncate', overdue && 'font-medium text-red-600 dark:text-red-400')}>
            {formatDueDate(task.dueDate, task.startTime)}
          </span>
        </div>
        {hasContact && (
          <div className="flex items-center gap-2">
            <UserCircle className="size-3.5 shrink-0 opacity-50" aria-hidden />
            <span className="truncate">{task.contactName?.trim()}{task.contactPhone ? ` · ${task.contactPhone}` : ''}</span>
          </div>
        )}
        {hasCompany && (
          <div className="flex items-center gap-2">
            <Building2 className="size-3.5 shrink-0 opacity-50" aria-hidden />
            <span className="truncate">{task.companyName?.trim()}</span>
          </div>
        )}
        {hasOpportunity && (
          <div className="flex items-center gap-2">
            <Target className="size-3.5 shrink-0 opacity-50" aria-hidden />
            <span className="truncate">{task.opportunityTitle?.trim()}</span>
          </div>
        )}
        <div className="inline-flex items-center gap-1 rounded-md border border-[#d0d5dd]/50 dark:border-gray-600/50 bg-white/60 dark:bg-gray-800/60 px-2 py-0.5 text-[13px] text-muted-foreground">
          <UserHandUpIcon className="size-3.5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
          <span className="truncate">{task.assignedToName || '—'}</span>
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
  onEdit,
  onDelete,
}: {
  task: Activity;
  onCardClick: () => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
  isOverdue: (dueDate: string, status: ActivityStatus) => boolean;
  onCompleteToggle: () => void;
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
    <div className="flex h-full min-h-0 min-w-[20rem] max-w-full flex-1 basis-0 flex-col overflow-hidden rounded-t-xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-x border-t border-border/80 px-3 py-2.5 bg-[#e8ecf0] dark:bg-gray-800/50">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn('inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded-full px-1.5 text-xs font-bold tabular-nums', theme.countBg, theme.countText)}>
            {count}
          </span>
          <span className={cn('text-sm font-semibold truncate', theme.textColor)}>
            {statusLabel[status]}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
          aria-label={`Nueva tarea en ${statusLabel[status]}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-b-xl border-x border-b border-border/80 bg-[#e8ecf0] p-1 [-webkit-overflow-scrolling:touch] dark:bg-gray-800/50',
          (isOver || showDropHint) && 'ring-2 ring-inset ring-primary/35',
        )}
      >
        {children}
      </div>
    </div>
  );
});

function TasksKanbanSkeleton() {
  return (
    <div
      className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando tablero de tareas"
    >
      <div
        className={cn(
          'scrollbar-thin flex min-h-[22rem] w-full min-w-0 flex-1 flex-row gap-3',
          'overflow-x-auto overflow-y-hidden overscroll-x-contain',
          'items-stretch pb-2 pt-0.5 [-webkit-overflow-scrolling:touch]',
        )}
      >
        {KANBAN_STATUS_ORDER.map((status) => {
          const theme = columnTheme[status];
          return (
            <div
              key={status}
              className="flex h-full min-h-0 min-w-[20rem] max-w-full flex-1 basis-0 flex-col overflow-hidden rounded-t-xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-x border-t border-border/80 px-3 py-2.5 bg-[#e8ecf0] dark:bg-gray-800/50">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className={cn('h-6 w-6 shrink-0 rounded-full', theme.countBg)} />
                  <Skeleton className="h-4 max-w-[7rem] flex-1" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-md" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-b-xl border-x border-b border-border/80 bg-[#e8ecf0] p-2 dark:bg-gray-800/50">
                {Array.from({ length: status === 'pendiente' ? 3 : 2 }, (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-[7.5rem] w-full shrink-0 rounded-xl bg-white dark:bg-gray-900"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TasksKanbanBoard = memo(function TasksKanbanBoard({
  tasks,
  loading,
  onTaskClick,
  onAddTask,
  onStatusChange,
  onCompleteToggle,
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
    return <TasksKanbanSkeleton />;
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
      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2">
        <div
          className={cn(
            'scrollbar-thin flex min-h-[22rem] w-full min-w-0 flex-1 flex-row gap-3',
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
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
