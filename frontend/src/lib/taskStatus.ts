import { isBefore, startOfDay } from 'date-fns';
import type { ActivityStatus } from '@/types';

const DATE_ONLY_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de vencimiento al inicio del día (zona Perú). */
export function taskDueDay(dueDate: string): Date | null {
  const t = dueDate?.trim();
  if (!t || !DATE_ONLY_YMD.test(t)) return null;
  const d = startOfDay(new Date(`${t}T12:00:00-05:00`));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function taskTodayStart(): Date {
  return startOfDay(new Date());
}

/** Días hasta el vencimiento (0 = hoy, 1 = mañana, negativo = vencida). */
export function taskDaysUntilDue(dueDate: string): number | null {
  const day = taskDueDay(dueDate);
  if (!day) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((day.getTime() - taskTodayStart().getTime()) / msPerDay);
}

export function isTaskPastDue(dueDate: string): boolean {
  const day = taskDueDay(dueDate);
  if (!day) return false;
  return isBefore(day, taskTodayStart());
}

type TaskStatusInput = {
  status: ActivityStatus;
  dueDate: string;
};

/** Estado mostrado en listas, filtros y kanban (vencida se deriva de la fecha). */
export function effectiveTaskStatus(task: TaskStatusInput): ActivityStatus {
  if (task.status === 'completada') return 'completada';
  if (isTaskPastDue(task.dueDate)) return 'vencida';
  if (task.status === 'en_progreso') return 'en_progreso';
  return 'pendiente';
}

export function isTaskOverdue(task: TaskStatusInput): boolean {
  return effectiveTaskStatus(task) === 'vencida';
}

export type TaskDueUrgencyFilter = 'overdue' | 'today' | 'tomorrow' | 'week';

export function matchesTaskDueUrgencyFilter(
  task: TaskStatusInput,
  filter: TaskDueUrgencyFilter | null,
): boolean {
  if (!filter) return true;
  if (task.status === 'completada') return false;

  const days = taskDaysUntilDue(task.dueDate);
  if (days == null) return false;

  switch (filter) {
    case 'overdue':
      return isTaskOverdue(task);
    case 'today':
      return days === 0;
    case 'tomorrow':
      return days === 1;
    case 'week':
      return days >= 0 && days <= 7;
    default:
      return true;
  }
}

export function countTasksByDueUrgency(
  tasks: readonly TaskStatusInput[],
): Record<TaskDueUrgencyFilter, number> {
  const counts: Record<TaskDueUrgencyFilter, number> = {
    overdue: 0,
    today: 0,
    tomorrow: 0,
    week: 0,
  };
  for (const task of tasks) {
    if (task.status === 'completada') continue;
    for (const key of Object.keys(counts) as TaskDueUrgencyFilter[]) {
      if (matchesTaskDueUrgencyFilter(task, key)) counts[key] += 1;
    }
  }
  return counts;
}

const TASK_DUE_ROW_OVERDUE =
  'border-l-[3px] border-l-red-500 bg-red-50 hover:bg-red-100/90 dark:border-l-red-400 dark:bg-red-950/25 dark:hover:bg-red-950/35';
const TASK_DUE_ROW_TODAY =
  'border-l-[3px] border-l-yellow-500 bg-yellow-100 hover:bg-yellow-200/90 dark:border-l-yellow-400 dark:bg-yellow-950/35 dark:hover:bg-yellow-950/45';
const TASK_DUE_ROW_TOMORROW =
  'border-l-[3px] border-l-orange-600 bg-orange-100 hover:bg-orange-200/90 dark:border-l-orange-400 dark:bg-orange-950/30 dark:hover:bg-orange-950/40';

/** Resaltado de fila/tarjeta según proximidad del vencimiento. */
export function taskDueRowHighlightClass(task: TaskStatusInput): string | undefined {
  if (task.status === 'completada') return undefined;
  if (isTaskOverdue(task)) return TASK_DUE_ROW_OVERDUE;
  const days = taskDaysUntilDue(task.dueDate);
  if (days === 0) return TASK_DUE_ROW_TODAY;
  if (days === 1) return TASK_DUE_ROW_TOMORROW;
  return undefined;
}

export function taskDueDateTextClass(task: TaskStatusInput): string | undefined {
  if (task.status === 'completada') return undefined;
  if (isTaskOverdue(task)) return 'font-semibold text-red-600 dark:text-red-400';
  const days = taskDaysUntilDue(task.dueDate);
  if (days === 0) return 'font-semibold text-yellow-800 dark:text-yellow-200';
  if (days === 1) return 'font-semibold text-orange-800 dark:text-orange-200';
  return undefined;
}
