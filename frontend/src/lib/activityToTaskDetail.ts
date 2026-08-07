import type { TaskDetailTask } from '@/components/shared/TaskDetailDialog';
import { taskAssociationsFromActivity } from '@/lib/taskAssociationsFromActivity';
import { effectiveTaskStatus } from '@/lib/taskStatus';
import type { Activity, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';

export function activityToTaskDetail(a: Activity): TaskDetailTask {
  const kind: TaskKind =
    a.taskKind && TASK_KINDS.includes(a.taskKind) ? a.taskKind : 'llamada';
  const assocs = taskAssociationsFromActivity(a);
  const company =
    assocs.find((x) => x.type === 'empresa')?.name ??
    (a.companyName?.trim() || undefined);

  return {
    id: a.id,
    title: a.title,
    status: effectiveTaskStatus(a),
    type: kind,
    priority: a.priority ?? 'media',
    company,
    dueDate: a.dueDate,
    startDate: a.startDate,
    startTime: a.startTime,
    assignee: a.assignedToName,
    associations: assocs.length > 0 ? assocs : undefined,
    description: a.description,
  };
}
