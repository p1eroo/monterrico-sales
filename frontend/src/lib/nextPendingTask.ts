import type { Activity } from '@/types';
import { TASK_KINDS, type TaskKind } from '@/types';

/** Misma noción de “tarea” que en TasksTab: type tarea + taskKind válido y no completada. */
export function isPendingTaskActivity(a: Activity): boolean {
  if (
    a.type !== 'tarea' ||
    !a.taskKind ||
    !TASK_KINDS.includes(a.taskKind as TaskKind)
  ) {
    return false;
  }
  if (a.status === 'completada' || a.completedAt) return false;
  return true;
}

function sortByDueDateThenCreated(acts: Activity[]): Activity[] {
  return [...acts].sort((a, b) => {
    const byDue = a.dueDate.localeCompare(b.dueDate);
    if (byDue !== 0) return byDue;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export type NextPendingTaskSummary = Pick<Activity, 'title' | 'dueDate'>;

/** Próxima tarea pendiente vinculada al contacto (por dueDate). */
export function nextPendingTaskForContact(
  list: Activity[],
  contactId: string | undefined,
): NextPendingTaskSummary | null {
  if (!contactId) return null;
  const candidates = list.filter(
    (a) => isPendingTaskActivity(a) && a.contactId === contactId,
  );
  const first = sortByDueDateThenCreated(candidates)[0];
  return first ? { title: first.title, dueDate: first.dueDate } : null;
}

/**
 * Próxima tarea en ámbito empresa: vinculada a la empresa o a alguno de sus contactos.
 * Alineado con el filtro de TasksTab en vista empresa.
 */
export function nextPendingTaskForCompanyScope(
  list: Activity[],
  opts: { companyId?: string; contactIds: Iterable<string> },
): NextPendingTaskSummary | null {
  const contactSet = new Set(opts.contactIds);
  const { companyId } = opts;
  const candidates = list.filter((a) => {
    if (!isPendingTaskActivity(a)) return false;
    if (companyId && a.companyId === companyId) return true;
    if (a.contactId && contactSet.has(a.contactId)) return true;
    return false;
  });
  const first = sortByDueDateThenCreated(candidates)[0];
  return first ? { title: first.title, dueDate: first.dueDate } : null;
}
