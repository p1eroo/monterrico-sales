import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  CheckSquare,
  Plus,
} from 'lucide-react';
import type { Activity, ActivityStatus, ActivityType, ContactPriority, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { SuitcaseSvgIcon } from '@/components/icons/SuitcaseSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { ReunionSvgIcon } from '@/components/icons/ReunionSvgIcon';
import { CorreoSvgIcon } from '@/components/icons/CorreoSvgIcon';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { priorityLabels } from '@/data/mock';
import { useUsersStore } from '@/store/usersStore';
import {
  effectiveTaskStatus,
  taskDueDateTextClass,
  taskDueRowHighlightClass,
} from '@/lib/taskStatus';

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  llamada: LlamadaSvgIcon,
  reunion: ReunionSvgIcon,
  tarea: CheckSquare,
  correo: CorreoSvgIcon,
  whatsapp: WhatsAppSvgIcon,
};

const kanbanMetaIconClass = 'size-4 shrink-0 text-[#72808f] dark:text-gray-500';

const kanbanPriorityBadgeClass: Record<ContactPriority, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const TaskKanbanAssigneeAvatar = memo(function TaskKanbanAssigneeAvatar({ task }: { task: Activity }) {
  const users = useUsersStore((s) => s.users);
  const assignee = users.find((u) => u.id === task.assignedTo);
  const name = task.assignedToName?.trim() || assignee?.name || 'Sin asignar';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  if (assignee?.avatar) {
    return (
      <span
        className="inline-flex size-6 shrink-0 overflow-hidden rounded-full"
        title={name}
      >
        <img src={assignee.avatar} alt="" className="size-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-[10px] font-medium text-white dark:bg-teal-600"
      title={name}
    >
      {initials}
    </span>
  );
});

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


export type TasksKanbanBoardProps = {
  tasks: Activity[];
  loading?: boolean;
  onTaskClick: (task: Activity) => void;
  onAddTask: (defaultStatus?: ActivityStatus) => void;
  onStatusChange: (taskId: string, next: ActivityStatus) => void | Promise<void>;
  formatDueDate: (dueDate: string, startTime?: string) => string;
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

const KANBAN_DRAG_ACTIVATION_PX = 8;

const TaskKanbanCard = memo(function TaskKanbanCard({
  task,
  overlay,
  formatDueDate,
}: {
  task: Activity;
  overlay?: boolean;
  formatDueDate: (dueDate: string, startTime?: string) => string;
}) {
  const kind: TaskKind =
    task.taskKind && TASK_KINDS.includes(task.taskKind) ? task.taskKind : 'llamada';
  const TypeIcon = activityIcons[kind];
  const dateTextClass = taskDueDateTextClass(task);
  const priority: ContactPriority = task.priority ?? 'media';

  const hasContact = task.contactId && task.contactName?.trim();
  const hasCompany = task.companyId && task.companyName?.trim();
  const hasOpportunity = task.opportunityId && task.opportunityTitle?.trim();

  return (
    <div
      className={cn(
        'relative rounded-lg bg-white dark:bg-gray-800 p-2.5',
        taskDueRowHighlightClass(task),
        overlay && 'pointer-events-none rotate-1 cursor-grabbing ring-2 ring-primary/20',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded px-2 py-1 text-xs font-medium leading-none',
            kanbanPriorityBadgeClass[priority],
          )}
        >
          {priorityLabels[priority]}
        </span>
        <TaskKanbanAssigneeAvatar task={task} />
      </div>
      <div className="flex w-full items-start gap-2 text-left">
        <TypeIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-sm leading-snug text-foreground break-words">
          {task.title}
        </span>
      </div>

      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarSvgIcon className={kanbanMetaIconClass} aria-hidden />
          <span className={cn('min-w-0 break-words', dateTextClass)}>
            {formatDueDate(task.dueDate, task.startTime)}
          </span>
        </div>
        {hasContact && (
          <div className="flex items-center gap-2">
            <UsersGroupTwoRoundedSvgIcon className={kanbanMetaIconClass} aria-hidden />
            <span className="truncate">
              {task.contactName?.trim()}
              {task.contactPhone ? ` · ${task.contactPhone}` : ''}
            </span>
          </div>
        )}
        {hasCompany && (
          <div className="flex items-center gap-2">
            <Buildings2SvgIcon className={kanbanMetaIconClass} aria-hidden />
            <span className="truncate">{task.companyName?.trim()}</span>
          </div>
        )}
        {hasOpportunity && (
          <div className="flex items-center gap-2">
            <SuitcaseSvgIcon className={kanbanMetaIconClass} aria-hidden />
            <span className="truncate">{task.opportunityTitle?.trim()}</span>
          </div>
        )}
      </div>
    </div>
  );
});

const DraggableTaskCard = memo(function DraggableTaskCard({
  task,
  onCardClick,
  formatDueDate,
}: {
  task: Activity;
  onCardClick: () => void;
  formatDueDate: (dueDate: string, startTime?: string) => string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  const dragActivatedRef = useRef(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isDragging) dragActivatedRef.current = true;
  }, [isDragging]);

  const {
    onPointerDown: dndPointerDown,
    onPointerUp: dndPointerUp,
    ...restListeners
  } = listeners ?? {};

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerOriginRef.current = { x: event.clientX, y: event.clientY };
      dragActivatedRef.current = false;
      dndPointerDown?.(event);
    },
    [dndPointerDown],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dndPointerUp?.(event);

      if (dragActivatedRef.current) {
        dragActivatedRef.current = false;
        pointerOriginRef.current = null;
        return;
      }

      const origin = pointerOriginRef.current;
      pointerOriginRef.current = null;
      if (!origin) return;

      const dx = Math.abs(event.clientX - origin.x);
      const dy = Math.abs(event.clientY - origin.y);
      if (dx < KANBAN_DRAG_ACTIVATION_PX && dy < KANBAN_DRAG_ACTIVATION_PX) {
        onCardClick();
      }
    },
    [dndPointerUp, onCardClick],
  );

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.4 } : undefined}
      className={cn(
        'touch-none select-none',
        isDragging ? 'cursor-grabbing' : 'cursor-pointer',
        isDragging && 'will-change-transform',
      )}
      {...attributes}
      {...restListeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <TaskKanbanCard task={task} formatDueDate={formatDueDate} />
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
          <span className={cn('text-sm font-medium truncate', theme.textColor)}>
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
          'scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-b-xl border-x border-b border-border/80 bg-[#e8ecf0] px-2.5 py-2 [-webkit-overflow-scrolling:touch] dark:bg-gray-800/50',
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
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-b-xl border-x border-b border-border/80 bg-[#e8ecf0] px-2.5 py-2 dark:bg-gray-800/50">
                {Array.from({ length: status === 'pendiente' ? 3 : 2 }, (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-[7.5rem] w-full shrink-0 rounded-lg bg-white dark:bg-gray-900"
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
  formatDueDate,
}: TasksKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ActivityStatus | null>(null);

  const columnIds = useMemo(() => new Set(KANBAN_STATUS_ORDER.map(String)), []);

  const collisionDetection = useTasksKanbanCollision(columnIds);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: KANBAN_DRAG_ACTIVATION_PX },
    }),
  );

  const tasksByStatus = useMemo(() => {
    const map = new Map<ActivityStatus, Activity[]>();
    for (const s of KANBAN_STATUS_ORDER) {
      map.set(s, []);
    }
    for (const t of tasks) {
      const effective = effectiveTaskStatus(t);
      const list = map.get(effective);
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
      if (!task || effectiveTaskStatus(task) === overId) return;
      if (overId === 'vencida') return;
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
              formatDueDate={formatDueDate}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
